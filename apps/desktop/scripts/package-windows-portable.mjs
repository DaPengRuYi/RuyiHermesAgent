#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { renderArtifactName } from './desktop-product.mjs'
import { PORTABLE_SMOKE_ENV_OVERRIDES } from './portable-smoke-env.mjs'
import { normalizeGitHubRepository } from './release-source.mjs'
import { isMain } from './utils.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const REPORT_ROOT = path.join(REPO_ROOT, 'tmp', 'desktop-portable-package')
const LOCK_PATH = path.join(REPORT_ROOT, 'active.lock')
const MIN_FREE_BYTES = 2 * 1024 ** 3
const desktopRequire = createRequire(path.join(DESKTOP_ROOT, 'package.json'))
const PACKAGE_ENV_OVERRIDES = Object.freeze([
  ...PORTABLE_SMOKE_ENV_OVERRIDES,
  'HERMES_DESKTOP_PORTABLE_PROBE'
])

class PortablePackageError extends Error {
  constructor(code, message, { exitCode = 1, phaseId = null, classification = null, cause } = {}) {
    super(message, { cause })
    this.name = 'PortablePackageError'
    this.code = code
    this.exitCode = exitCode
    this.phaseId = phaseId
    this.classification = classification
  }
}

function contextualizePortablePackageError(cause, phase, fallbackCode = 'PHASE_FAILED') {
  if (cause instanceof PortablePackageError) {
    cause.phaseId ||= phase.id
    cause.classification ||= phase.classification
    return cause
  }
  return new PortablePackageError(
    fallbackCode,
    cause instanceof Error ? cause.message : String(cause),
    {
      phaseId: phase.id,
      classification: phase.classification,
      cause
    }
  )
}

function resolveNpmCli({
  sourceEnv = process.env,
  nodeExecutable = process.execPath,
  existsSync = fs.existsSync
} = {}) {
  const inheritedNpmCli = Object.entries(sourceEnv).find(([name]) => name.toLowerCase() === 'npm_execpath')?.[1]
  const candidates = [
    inheritedNpmCli,
    path.join(path.dirname(nodeExecutable), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  ].filter(Boolean)
  const resolved = candidates.map(candidate => path.resolve(candidate)).find(candidate => existsSync(candidate))

  if (!resolved) {
    throw new PortablePackageError(
      'NPM_CLI_MISSING',
      `npm CLI was not found; checked: ${candidates.map(candidate => path.resolve(candidate)).join(', ')}`
    )
  }
  return resolved
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { allowDirty: false, preflightOnly: false }
  for (const arg of argv) {
    if (arg === '--allow-dirty') options.allowDirty = true
    else if (arg === '--preflight-only') options.preflightOnly = true
    else throw new PortablePackageError('INVALID_ARGUMENT', `unknown argument: ${arg}`)
  }
  return options
}

function matchingEnvironmentKeys(env, names = PACKAGE_ENV_OVERRIDES) {
  const blocked = new Set(names.map(name => name.toUpperCase()))
  return Object.keys(env).filter(name => blocked.has(name.toUpperCase()))
}

function sanitizePackageEnvironment(sourceEnv = process.env) {
  const removedEnvironmentVariables = matchingEnvironmentKeys(sourceEnv)
  const removed = new Set(removedEnvironmentVariables.map(name => name.toUpperCase()))
  const env = {}

  for (const [name, value] of Object.entries(sourceEnv)) {
    if (value === undefined || removed.has(name.toUpperCase())) continue
    env[name] = value
  }

  return {
    env,
    removedEnvironmentVariables: [...new Set(removedEnvironmentVariables.map(name => name.toUpperCase()))].sort()
  }
}

function portablePackagePhases({
  nodeExecutable = process.execPath,
  npmCli = resolveNpmCli({ nodeExecutable })
} = {}) {
  const npmArgs = args => [npmCli, ...args]
  return [
    {
      id: 'verify-install-source',
      classification: 'source-verification',
      command: nodeExecutable,
      args: npmArgs(['run', 'verify:install-source', '--workspace', 'apps/desktop'])
    },
    {
      id: 'desktop-check',
      classification: 'quality-gate',
      command: nodeExecutable,
      args: npmArgs(['run', 'desktop:check'])
    },
    {
      id: 'build-portable',
      classification: 'build-package',
      command: nodeExecutable,
      args: npmArgs(['run', 'dist:win:portable:prechecked', '--workspace', 'apps/desktop']),
      cleanBuild: true
    },
    {
      id: 'validate-app-bundle',
      classification: 'bundle-validation',
      command: nodeExecutable,
      args: npmArgs(['run', 'test:desktop:app-bundle', '--workspace', 'apps/desktop'])
    },
    {
      id: 'validate-portable',
      classification: 'runtime-smoke',
      command: nodeExecutable,
      args: npmArgs(['run', 'test:desktop:portable:win', '--workspace', 'apps/desktop'])
    }
  ]
}

function runCommand(command, args, { cwd = REPO_ROOT, env = process.env, timeout } = {}) {
  return spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    timeout,
    windowsHide: true
  })
}

function runCaptured(command, args, { cwd = REPO_ROOT, env = process.env, timeout = 10_000 } = {}) {
  return spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout,
    windowsHide: true
  })
}

function commandText(command, args) {
  return [command, ...args].join(' ')
}

function resultExitCode(result) {
  if (Number.isInteger(result?.status)) return result.status
  if (result?.signal === 'SIGINT') return 130
  if (result?.signal === 'SIGTERM') return 143
  return 1
}

function serializePortablePackageFailure(error) {
  return {
    code: error.code,
    phaseId: error.phaseId,
    classification: error.classification,
    message: error.message,
    exitCode: error.exitCode
  }
}

function runPhaseSequence(phases, {
  baseEnv,
  allowDirty = false,
  runner = runCommand,
  onPhase = () => {},
  now = () => Date.now()
} = {}) {
  const results = []

  for (const phase of phases) {
    const startedAtMs = now()
    const phaseEnv = { ...baseEnv }
    if (phase.cleanBuild) phaseEnv.HERMES_REQUIRE_CLEAN_BUILD = allowDirty ? '0' : '1'

    try {
      onPhase({ type: 'start', phase, startedAtMs })
    } catch (cause) {
      throw contextualizePortablePackageError(cause, phase, 'PHASE_CALLBACK_FAILED')
    }
    const result = runner(phase.command, phase.args, { cwd: REPO_ROOT, env: phaseEnv })
    const completedAtMs = now()
    const record = {
      id: phase.id,
      classification: phase.classification,
      command: commandText(phase.command, phase.args),
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: Math.max(0, completedAtMs - startedAtMs),
      status: result?.status ?? null,
      signal: result?.signal ?? null
    }
    results.push(record)
    try {
      onPhase({ type: 'complete', phase, record, result })
    } catch (cause) {
      throw contextualizePortablePackageError(cause, phase, 'PHASE_CALLBACK_FAILED')
    }

    if (result?.error) {
      throw new PortablePackageError(
        result.error.code === 'ETIMEDOUT' ? 'PHASE_TIMEOUT' : 'PHASE_SPAWN_FAILED',
        `${phase.id} could not run: ${result.error.message}`,
        {
          exitCode: resultExitCode(result),
          phaseId: phase.id,
          classification: phase.classification,
          cause: result.error
        }
      )
    }
    if (result?.status !== 0) {
      throw new PortablePackageError(
        'PHASE_FAILED',
        `${phase.id} failed with exit code ${resultExitCode(result)}`,
        {
          exitCode: resultExitCode(result),
          phaseId: phase.id,
          classification: phase.classification
        }
      )
    }
  }

  return results
}

function readDesktopPackage() {
  return JSON.parse(fs.readFileSync(path.join(DESKTOP_ROOT, 'package.json'), 'utf8'))
}

function resolveDesktopDependencyPackage(
  packageName,
  resolver = specifier => desktopRequire.resolve(specifier)
) {
  try {
    return path.resolve(resolver(`${packageName}/package.json`))
  } catch (cause) {
    throw new PortablePackageError(
      'PREREQUISITE_MISSING',
      `${packageName} cannot be resolved from the desktop workspace`,
      { cause }
    )
  }
}

function portableArtifactPath(packageJson = readDesktopPackage(), arch = process.arch === 'arm64' ? 'arm64' : 'x64') {
  const template = packageJson?.build?.portable?.artifactName
  if (!template) throw new PortablePackageError('PORTABLE_CONFIG_INVALID', 'build.portable.artifactName is missing')
  const name = renderArtifactName(template, {
    version: packageJson.version,
    os: 'win',
    arch,
    ext: 'exe'
  })
  return path.join(DESKTOP_ROOT, 'release', name)
}

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase()
}

function artifactSummary(filePath, { buildStartedAtMs = 0 } = {}) {
  if (!fs.existsSync(filePath)) {
    throw new PortablePackageError('ARTIFACT_MISSING', `portable artifact was not produced: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size === 0) {
    throw new PortablePackageError('ARTIFACT_INVALID', `portable artifact is empty or not a file: ${filePath}`)
  }
  if (buildStartedAtMs > 0 && stat.mtimeMs < buildStartedAtMs) {
    throw new PortablePackageError(
      'ARTIFACT_STALE',
      `portable artifact predates this build: ${filePath}`
    )
  }
  return {
    path: filePath,
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    sha256: fileSha256(filePath)
  }
}

function stagePreviousArtifact(filePath, reportDir) {
  const staged = {
    artifactPath: filePath,
    backupPath: null,
    previousArtifact: null
  }
  if (!fs.existsSync(filePath)) return staged

  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    throw new PortablePackageError('ARTIFACT_PREVIOUS_INVALID', `existing artifact path is not a file: ${filePath}`)
  }

  const backupDir = path.join(reportDir, 'previous-artifact')
  const backupPath = path.join(backupDir, path.basename(filePath))
  fs.mkdirSync(backupDir, { recursive: true })
  try {
    fs.renameSync(filePath, backupPath)
  } catch (cause) {
    throw new PortablePackageError(
      'ARTIFACT_STAGE_FAILED',
      `failed to stage the previous portable artifact: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause }
    )
  }

  return {
    artifactPath: filePath,
    backupPath,
    previousArtifact: {
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    }
  }
}

function discardStagedArtifact(staged) {
  if (!staged?.backupPath || !fs.existsSync(staged.backupPath)) return false
  fs.rmSync(staged.backupPath, { force: true })
  return true
}

function restoreStagedArtifact(staged) {
  if (!staged?.backupPath || !fs.existsSync(staged.backupPath)) return false
  fs.rmSync(staged.artifactPath, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(staged.artifactPath), { recursive: true })
  fs.renameSync(staged.backupPath, staged.artifactPath)
  return true
}

function recoverUnverifiedArtifact(staged) {
  if (!staged) return { previousArtifactRestored: false, partialArtifactRemoved: false }
  if (staged.backupPath && fs.existsSync(staged.backupPath)) {
    return {
      previousArtifactRestored: restoreStagedArtifact(staged),
      partialArtifactRemoved: false
    }
  }

  const partialArtifactRemoved = fs.existsSync(staged.artifactPath)
  if (partialArtifactRemoved) {
    fs.rmSync(staged.artifactPath, { recursive: true, force: true })
  }
  return { previousArtifactRestored: false, partialArtifactRemoved }
}

function parseVersion(value) {
  return String(value || '')
    .replace(/^v/, '')
    .split('.')
    .slice(0, 3)
    .map(part => Number.parseInt(part, 10) || 0)
}

function nodeVersionSupported(version = process.versions.node) {
  const [major, minor] = parseVersion(version)
  if (major === 20) return minor >= 19
  if (major === 21) return false
  if (major === 22) return minor >= 12
  return major > 22
}

function gitValue(args, runner = runCaptured, env = process.env) {
  const result = runner('git', args, { cwd: REPO_ROOT, env })
  if (result.error || result.status !== 0) return null
  return result.stdout.trim() || null
}

function electronVersionProbe(electronBinary, env, runner = runCaptured) {
  const result = runner(electronBinary, ['--version'], { cwd: REPO_ROOT, env, timeout: 10_000 })
  if (result.error || result.status !== 0) {
    throw new PortablePackageError(
      'ELECTRON_PROBE_FAILED',
      `Electron version probe failed (${result.error?.message || result.stderr?.trim() || result.status})`
    )
  }
  const version = result.stdout.trim() || result.stderr.trim()
  if (!/^v?\d+\.\d+\.\d+/.test(version)) {
    throw new PortablePackageError('ELECTRON_PROBE_INVALID', `unexpected Electron version output: ${version}`)
  }
  return version.replace(/^v/, '')
}

function npmVersionProbe(nodeExecutable, npmCli, env, runner = runCaptured) {
  const result = runner(nodeExecutable, [npmCli, '--version'], { cwd: REPO_ROOT, env, timeout: 10_000 })
  if (result.error || result.status !== 0) {
    throw new PortablePackageError(
      'NPM_PROBE_FAILED',
      `npm CLI probe failed (${result.error?.message || result.stderr?.trim() || result.status})`
    )
  }
  const version = result.stdout.trim() || result.stderr.trim()
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new PortablePackageError('NPM_PROBE_INVALID', `unexpected npm version output: ${version}`)
  }
  return version
}

function collectPreflight({
  allowDirty = false,
  sourceEnv = process.env,
  platform = process.platform,
  nodeExecutable = process.execPath,
  npmCli,
  runner = runCaptured
} = {}) {
  if (platform !== 'win32') {
    throw new PortablePackageError('UNSUPPORTED_PLATFORM', 'Windows portable packaging requires win32')
  }
  if (!nodeVersionSupported()) {
    throw new PortablePackageError(
      'NODE_VERSION_UNSUPPORTED',
      `Node ${process.versions.node} does not satisfy ^20.19.0 || >=22.12.0`
    )
  }

  const vitePackage = resolveDesktopDependencyPackage('vite')
  const electronPackage = resolveDesktopDependencyPackage('electron')
  const electronBinary = path.join(path.dirname(electronPackage), 'dist', 'electron.exe')
  const requiredFiles = [path.join(REPO_ROOT, 'package-lock.json'), vitePackage, electronPackage, electronBinary]
  const missing = requiredFiles.filter(filePath => !fs.existsSync(filePath))
  if (missing.length > 0) {
    throw new PortablePackageError('PREREQUISITE_MISSING', `required files are missing: ${missing.join(', ')}`)
  }

  const prepared = sanitizePackageEnvironment(sourceEnv)
  const resolvedNpmCli = npmCli || resolveNpmCli({ sourceEnv, nodeExecutable })
  const npmVersion = npmVersionProbe(nodeExecutable, resolvedNpmCli, prepared.env, runner)

  const commit = gitValue(['rev-parse', 'HEAD'], runner, prepared.env)
  const branch = gitValue(['branch', '--show-current'], runner, prepared.env)
  const repository = normalizeGitHubRepository(gitValue(['remote', 'get-url', 'origin'], runner, prepared.env))
  const trackedStatus = gitValue(['status', '--porcelain', '--untracked-files=no'], runner, prepared.env) || ''
  if (!commit || !repository) {
    throw new PortablePackageError('GIT_SOURCE_UNAVAILABLE', 'Git commit or origin remote is unavailable')
  }
  if (trackedStatus && !allowDirty) {
    throw new PortablePackageError(
      'TRACKED_WORKTREE_DIRTY',
      'release packaging requires a clean tracked worktree; use --allow-dirty only for local validation'
    )
  }

  const disk = fs.statfsSync(REPO_ROOT)
  const freeBytes = Number(disk.bavail) * Number(disk.bsize)
  if (Number.isFinite(freeBytes) && freeBytes < MIN_FREE_BYTES) {
    throw new PortablePackageError(
      'DISK_SPACE_LOW',
      `portable packaging requires at least ${MIN_FREE_BYTES} free bytes; found ${freeBytes}`
    )
  }

  const electronVersion = electronVersionProbe(electronBinary, prepared.env, runner)

  return {
    platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    nodeExecutable,
    npmVersion,
    npmCli: resolvedNpmCli,
    electronVersion,
    commit,
    branch,
    repository,
    trackedWorktreeDirty: Boolean(trackedStatus),
    allowDirty,
    freeBytes,
    isolatedEnvironmentVariables: prepared.removedEnvironmentVariables,
    env: prepared.env
  }
}

function publicPreflight(preflight) {
  const { env: _env, ...safe } = preflight
  return safe
}

function acquireBuildLock({ lockPath = LOCK_PATH, pid = process.pid } = {}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  try {
    const fd = fs.openSync(lockPath, 'wx')
    fs.writeFileSync(fd, JSON.stringify({ pid, startedAt: new Date().toISOString() }, null, 2))
    fs.closeSync(fd)
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    let owner = null
    try {
      owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    } catch {}
    const ownerPid = Number(owner?.pid)
    let alive = false
    if (Number.isInteger(ownerPid) && ownerPid > 0) {
      try {
        process.kill(ownerPid, 0)
        alive = true
      } catch (probeError) {
        alive = probeError?.code === 'EPERM'
      }
    }
    if (!alive) {
      fs.rmSync(lockPath, { force: true })
      return acquireBuildLock({ lockPath, pid })
    }
    throw new PortablePackageError(
      'PACKAGING_ALREADY_RUNNING',
      `another portable package run owns ${lockPath} (pid=${ownerPid})`
    )
  }
  return () => fs.rmSync(lockPath, { force: true })
}

function writeSummary(summary, reportDir) {
  fs.mkdirSync(reportDir, { recursive: true })
  const summaryPath = path.join(reportDir, 'summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  return summaryPath
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const runId = randomUUID().replaceAll('-', '')
  const reportDir = path.join(REPORT_ROOT, runId)
  const startedAtMs = Date.now()
  const summary = {
    schemaVersion: 1,
    runId,
    mode: options.allowDirty ? 'local-dirty-validation' : 'release',
    status: 'running',
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: null,
    preflight: null,
    phases: [],
    artifact: null,
    artifactPreparation: {
      previousArtifact: null,
      previousArtifactDiscarded: false,
      previousArtifactRestored: false,
      partialArtifactRemoved: false,
      recoveryFailure: null
    },
    failure: null
  }
  let releaseLock = () => {}
  let stagedPreviousArtifact = null
  let builtArtifactVerified = false

  try {
    releaseLock = acquireBuildLock()
    console.log(`[portable-package] run ${runId}`)
    console.log('[portable-package] phase 0/5: preflight')
    const preflight = collectPreflight(options)
    summary.preflight = publicPreflight(preflight)
    writeSummary(summary, reportDir)
    const isolated = preflight.isolatedEnvironmentVariables
    console.log(
      `[portable-package] preflight PASS; isolated: ${isolated.length ? isolated.join(', ') : '<none>'}`
    )

    if (options.preflightOnly) {
      summary.status = 'passed'
      summary.completedAt = new Date().toISOString()
      const summaryPath = writeSummary(summary, reportDir)
      console.log(`[portable-package] preflight-only PASS; summary: ${summaryPath}`)
      return summary
    }

    const phases = portablePackagePhases({
      nodeExecutable: preflight.nodeExecutable,
      npmCli: preflight.npmCli
    })
    const expectedArtifactPath = portableArtifactPath()
    let buildStartedAtMs = 0
    summary.phases = runPhaseSequence(phases, {
      baseEnv: preflight.env,
      allowDirty: options.allowDirty,
      onPhase(event) {
        if (event.type === 'start') {
          if (event.phase.id === 'build-portable') {
            buildStartedAtMs = event.startedAtMs
            try {
              stagedPreviousArtifact = stagePreviousArtifact(expectedArtifactPath, reportDir)
            } catch (cause) {
              throw contextualizePortablePackageError(cause, event.phase, 'ARTIFACT_STAGE_FAILED')
            }
            summary.artifactPreparation.previousArtifact = stagedPreviousArtifact.previousArtifact
            writeSummary(summary, reportDir)
          }
          console.log(`[portable-package] phase ${phases.indexOf(event.phase) + 1}/${phases.length}: ${event.phase.id}`)
        } else {
          summary.phases = [...summary.phases, event.record]
          if (
            event.phase.id === 'build-portable' &&
            !event.result?.error &&
            event.result?.status === 0
          ) {
            try {
              summary.artifact = artifactSummary(expectedArtifactPath, { buildStartedAtMs })
              builtArtifactVerified = true
              summary.artifactPreparation.previousArtifactDiscarded = discardStagedArtifact(stagedPreviousArtifact)
            } catch (cause) {
              throw contextualizePortablePackageError(cause, event.phase, 'ARTIFACT_VALIDATION_FAILED')
            }
          }
          writeSummary(summary, reportDir)
        }
      }
    })

    let finalArtifact
    try {
      finalArtifact = artifactSummary(expectedArtifactPath, { buildStartedAtMs })
    } catch (cause) {
      throw contextualizePortablePackageError(
        cause,
        { id: 'post-validation-artifact', classification: 'artifact-integrity' },
        'ARTIFACT_VALIDATION_FAILED'
      )
    }
    if (
      !summary.artifact ||
      summary.artifact.sha256 !== finalArtifact.sha256 ||
      summary.artifact.bytes !== finalArtifact.bytes
    ) {
      throw new PortablePackageError(
        'ARTIFACT_CHANGED_DURING_VALIDATION',
        'portable artifact changed after the build phase completed',
        { phaseId: 'post-validation-artifact', classification: 'artifact-integrity' }
      )
    }
    summary.artifact = finalArtifact
    summary.status = 'passed'
    summary.completedAt = new Date().toISOString()
    const summaryPath = writeSummary(summary, reportDir)
    console.log(`[portable-package] PASS: ${summary.artifact.path}`)
    console.log(`[portable-package] SHA256: ${summary.artifact.sha256}`)
    console.log(`[portable-package] summary: ${summaryPath}`)
    return summary
  } catch (cause) {
    if (!builtArtifactVerified && stagedPreviousArtifact) {
      try {
        const recovery = recoverUnverifiedArtifact(stagedPreviousArtifact)
        summary.artifactPreparation.previousArtifactRestored = recovery.previousArtifactRestored
        summary.artifactPreparation.partialArtifactRemoved = recovery.partialArtifactRemoved
      } catch (recoveryError) {
        summary.artifactPreparation.recoveryFailure = recoveryError instanceof Error
          ? recoveryError.message
          : String(recoveryError)
      }
    }
    const error = cause instanceof PortablePackageError
      ? cause
      : new PortablePackageError('UNEXPECTED_FAILURE', cause instanceof Error ? cause.message : String(cause), { cause })
    if (summary.artifactPreparation.recoveryFailure) {
      error.message += `; failed to restore previous artifact: ${summary.artifactPreparation.recoveryFailure}`
    }
    summary.status = 'failed'
    summary.completedAt = new Date().toISOString()
    summary.failure = serializePortablePackageFailure(error)
    const summaryPath = writeSummary(summary, reportDir)
    console.error(`[portable-package] ${error.code}: ${error.message}`)
    console.error(`[portable-package] summary: ${summaryPath}`)
    error.summaryPath = summaryPath
    throw error
  } finally {
    releaseLock()
  }
}

export {
  acquireBuildLock,
  artifactSummary,
  collectPreflight,
  discardStagedArtifact,
  main,
  matchingEnvironmentKeys,
  nodeVersionSupported,
  npmVersionProbe,
  PACKAGE_ENV_OVERRIDES,
  parseArgs,
  PortablePackageError,
  portableArtifactPath,
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
}

if (isMain(import.meta.url)) {
  try {
    main()
  } catch (error) {
    process.exitCode = error instanceof PortablePackageError ? error.exitCode : 1
  }
}
