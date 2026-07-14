import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  acquireBuildLock,
  artifactSummary,
  discardStagedArtifact,
  nodeVersionSupported,
  PACKAGE_ENV_OVERRIDES,
  parseArgs,
  PortablePackageError,
  portablePackagePhases,
  publicPreflight,
  recoverUnverifiedArtifact,
  resolveDesktopDependencyPackage,
  resolveNpmCli,
  restoreStagedArtifact,
  runPhaseSequence,
  sanitizePackageEnvironment,
  serializePortablePackageFailure,
  stagePreviousArtifact
} from './package-windows-portable.mjs'

const TEST_NODE = 'C:\\Program Files\\nodejs\\node.exe'
const TEST_NPM_CLI = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'

function testPortablePackagePhases() {
  return portablePackagePhases({ nodeExecutable: TEST_NODE, npmCli: TEST_NPM_CLI })
}

test('package environment isolation is case-insensitive and does not mutate its input', () => {
  const sourceEnv = {
    Path: 'C:\\Windows\\System32',
    Hermes_Home: 'C:\\host-hermes',
    electron_run_as_node: '1',
    portable_executable_dir: 'C:\\stale-portable',
    HERMES_DESKTOP_USER_DATA_DIR: 'C:\\stale-user-data',
    hermes_desktop_portable_probe: 'C:\\stale-probe.json',
    HERMES_REQUIRE_SIGNED_BUILD: '1'
  }
  const original = { ...sourceEnv }

  const prepared = sanitizePackageEnvironment(sourceEnv)

  assert.deepEqual(sourceEnv, original)
  assert.equal(prepared.env.Path, sourceEnv.Path)
  assert.equal(prepared.env.HERMES_REQUIRE_SIGNED_BUILD, '1')
  assert.equal(Object.keys(prepared.env).some(name => PACKAGE_ENV_OVERRIDES.includes(name.toUpperCase())), false)
  assert.deepEqual(prepared.removedEnvironmentVariables, PACKAGE_ENV_OVERRIDES.toSorted())
})

test('portable package phases are ordered, non-recursive, and execute once', () => {
  const phases = testPortablePackagePhases()
  assert.deepEqual(phases.map(phase => phase.id), [
    'verify-install-source',
    'desktop-check',
    'build-portable',
    'validate-app-bundle',
    'validate-portable'
  ])
  assert.deepEqual(phases.map(phase => phase.classification), [
    'source-verification',
    'quality-gate',
    'build-package',
    'bundle-validation',
    'runtime-smoke'
  ])
  assert.equal(
    phases.some(phase => phase.args.join(' ').includes('desktop:package:portable:win')),
    false
  )
  assert.equal(phases.every(phase => phase.command === TEST_NODE), true)
  assert.equal(phases.every(phase => phase.args[0] === TEST_NPM_CLI), true)

  const calls = []
  const results = runPhaseSequence(phases, {
    baseEnv: { Path: 'C:\\Windows' },
    runner(command, args, options) {
      calls.push({ command, args, env: options.env })
      return { status: 0, signal: null }
    },
    now: (() => {
      let value = 1_000
      return () => (value += 10)
    })()
  })

  assert.equal(calls.length, phases.length)
  assert.deepEqual(results.map(result => result.id), phases.map(phase => phase.id))
  assert.equal(calls[2].env.HERMES_REQUIRE_CLEAN_BUILD, '1')
})

test('phase failure short-circuits without retrying or running later phases', () => {
  const phases = testPortablePackagePhases()
  const calls = []

  assert.throws(
    () =>
      runPhaseSequence(phases, {
        baseEnv: {},
        runner(_command, _args) {
          calls.push(phases[calls.length].id)
          return { status: calls.length === 2 ? 17 : 0, signal: null }
        }
      }),
    error =>
      error instanceof PortablePackageError &&
      error.code === 'PHASE_FAILED' &&
      error.exitCode === 17 &&
      error.phaseId === 'desktop-check' &&
      error.classification === 'quality-gate'
  )
  assert.deepEqual(calls, ['verify-install-source', 'desktop-check'])
})

test('phase callback failures short-circuit with structured phase context for the summary', () => {
  const phases = testPortablePackagePhases()
  const calls = []
  let captured

  try {
    runPhaseSequence(phases, {
      baseEnv: {},
      runner() {
        calls.push(phases[calls.length].id)
        return { status: 0, signal: null }
      },
      onPhase(event) {
        if (event.type === 'complete' && event.phase.id === 'verify-install-source') {
          throw new Error('summary write failed')
        }
      }
    })
  } catch (error) {
    captured = error
  }

  assert.equal(captured instanceof PortablePackageError, true)
  assert.equal(captured.code, 'PHASE_CALLBACK_FAILED')
  assert.equal(captured.phaseId, 'verify-install-source')
  assert.equal(captured.classification, 'source-verification')
  assert.deepEqual(calls, ['verify-install-source'])
  assert.deepEqual(serializePortablePackageFailure(captured), {
    code: 'PHASE_CALLBACK_FAILED',
    phaseId: 'verify-install-source',
    classification: 'source-verification',
    message: 'summary write failed',
    exitCode: 1
  })
})

test('allow-dirty is explicit and only relaxes the build stamp phase', () => {
  const calls = []
  runPhaseSequence(testPortablePackagePhases(), {
    baseEnv: { HERMES_REQUIRE_SIGNED_BUILD: '1' },
    allowDirty: true,
    runner(_command, _args, options) {
      calls.push(options.env)
      return { status: 0, signal: null }
    }
  })

  assert.equal(calls[2].HERMES_REQUIRE_CLEAN_BUILD, '0')
  assert.equal(calls.every(env => env.HERMES_REQUIRE_SIGNED_BUILD === '1'), true)
  assert.deepEqual(parseArgs(['--allow-dirty']), { allowDirty: true, preflightOnly: false })
  assert.throws(() => parseArgs(['--unknown']), /unknown argument/)
})

test('artifact validation immediately after build blocks later smoke phases', () => {
  const phases = testPortablePackagePhases()
  const calls = []
  const missingArtifact = path.join(os.tmpdir(), `missing-portable-${process.pid}.exe`)
  let buildStartedAtMs = 0

  assert.throws(
    () =>
      runPhaseSequence(phases, {
        baseEnv: {},
        runner(_command, _args) {
          calls.push(phases[calls.length].id)
          return { status: 0, signal: null }
        },
        onPhase(event) {
          if (event.type === 'start' && event.phase.id === 'build-portable') {
            buildStartedAtMs = event.startedAtMs
          }
          if (event.type === 'complete' && event.phase.id === 'build-portable') {
            artifactSummary(missingArtifact, { buildStartedAtMs })
          }
        }
      }),
    error =>
      error instanceof PortablePackageError &&
      error.code === 'ARTIFACT_MISSING' &&
      error.phaseId === 'build-portable' &&
      error.classification === 'build-package'
  )
  assert.deepEqual(calls, ['verify-install-source', 'desktop-check', 'build-portable'])
})

test('artifact summary rejects stale files and hashes a fresh artifact', t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-package-artifact-'))
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))
  const artifact = path.join(tempRoot, 'portable.exe')
  fs.writeFileSync(artifact, 'portable-artifact')
  const stat = fs.statSync(artifact)

  assert.throws(
    () => artifactSummary(artifact, { buildStartedAtMs: stat.mtimeMs + 5_000 }),
    error => error instanceof PortablePackageError && error.code === 'ARTIFACT_STALE'
  )
  const summary = artifactSummary(artifact, { buildStartedAtMs: stat.mtimeMs - 1_000 })
  assert.equal(summary.bytes, 'portable-artifact'.length)
  assert.match(summary.sha256, /^[A-F0-9]{64}$/)
})

test('previous artifact is staged out of the build path and restored only after a failed build', t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-package-stage-'))
  const artifact = path.join(tempRoot, 'release', 'portable.exe')
  const reportDir = path.join(tempRoot, 'report')
  fs.mkdirSync(path.dirname(artifact), { recursive: true })
  fs.writeFileSync(artifact, 'previous-artifact')
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const stagedForFailure = stagePreviousArtifact(artifact, reportDir)
  assert.equal(fs.existsSync(artifact), false)
  assert.equal(fs.readFileSync(stagedForFailure.backupPath, 'utf8'), 'previous-artifact')
  fs.writeFileSync(artifact, 'partial-new-artifact')
  fs.rmSync(path.dirname(artifact), { recursive: true, force: true })
  assert.equal(restoreStagedArtifact(stagedForFailure), true)
  assert.equal(fs.readFileSync(artifact, 'utf8'), 'previous-artifact')

  const stagedForSuccess = stagePreviousArtifact(artifact, path.join(tempRoot, 'second-report'))
  fs.writeFileSync(artifact, 'verified-new-artifact')
  assert.equal(discardStagedArtifact(stagedForSuccess), true)
  assert.equal(fs.readFileSync(artifact, 'utf8'), 'verified-new-artifact')
  assert.equal(fs.existsSync(stagedForSuccess.backupPath), false)
})

test('a failed first build removes an unverified partial artifact when no previous artifact exists', t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-package-partial-'))
  const artifact = path.join(tempRoot, 'release', 'portable.exe')
  const reportDir = path.join(tempRoot, 'report')
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const staged = stagePreviousArtifact(artifact, reportDir)
  assert.equal(staged.backupPath, null)
  fs.mkdirSync(path.dirname(artifact), { recursive: true })
  fs.writeFileSync(artifact, 'unverified-partial-artifact')

  assert.deepEqual(recoverUnverifiedArtifact(staged), {
    previousArtifactRestored: false,
    partialArtifactRemoved: true
  })
  assert.equal(fs.existsSync(artifact), false)
})

test('desktop dependency resolution follows the workspace instead of assuming root hoisting', () => {
  const nestedPackage = path.join(os.tmpdir(), 'workspace', 'apps', 'desktop', 'node_modules', 'electron', 'package.json')
  const resolved = resolveDesktopDependencyPackage('electron', specifier => {
    assert.equal(specifier, 'electron/package.json')
    return nestedPackage
  })

  assert.equal(resolved, path.resolve(nestedPackage))
  assert.match(resolveDesktopDependencyPackage('electron'), /[\\/]electron[\\/]package\.json$/)
  assert.throws(
    () => resolveDesktopDependencyPackage('electron', () => { throw new Error('not installed') }),
    error => error instanceof PortablePackageError && error.code === 'PREREQUISITE_MISSING'
  )
})

test('public preflight report cannot serialize the child environment', () => {
  const report = publicPreflight({
    platform: 'win32',
    env: { OPENAI_API_KEY: 'sentinel-secret' },
    isolatedEnvironmentVariables: ['HERMES_HOME']
  })
  const serialized = JSON.stringify(report)
  assert.equal(Object.hasOwn(report, 'env'), false)
  assert.equal(serialized.includes('sentinel-secret'), false)
})

test('build lock rejects a live owner and recovers a stale owner', t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-package-lock-'))
  const lockPath = path.join(tempRoot, 'active.lock')
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

  const release = acquireBuildLock({ lockPath, pid: process.pid })
  assert.throws(
    () => acquireBuildLock({ lockPath, pid: process.pid }),
    error => error instanceof PortablePackageError && error.code === 'PACKAGING_ALREADY_RUNNING'
  )
  release()

  fs.writeFileSync(lockPath, JSON.stringify({ pid: 2_147_483_647 }))
  const releaseRecovered = acquireBuildLock({ lockPath, pid: process.pid })
  assert.equal(fs.existsSync(lockPath), true)
  releaseRecovered()
  assert.equal(fs.existsSync(lockPath), false)
})

test('Node engine predicate follows the desktop package contract', () => {
  assert.equal(nodeVersionSupported('20.18.0'), false)
  assert.equal(nodeVersionSupported('20.19.0'), true)
  assert.equal(nodeVersionSupported('21.9.0'), false)
  assert.equal(nodeVersionSupported('22.11.0'), false)
  assert.equal(nodeVersionSupported('22.12.0'), true)
  assert.equal(nodeVersionSupported('24.0.0'), true)
})

test('Windows npm CLI is resolved and launched through Node without a command shell', {
  skip: process.platform !== 'win32'
}, () => {
  const npmCli = resolveNpmCli()
  const result = spawnSync(process.execPath, [npmCli, '--version'], {
    encoding: 'utf8',
    windowsHide: true
  })

  assert.equal(result.error, undefined)
  assert.equal(result.status, 0)
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/)
})
