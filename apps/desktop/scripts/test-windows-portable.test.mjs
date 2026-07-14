import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertPortableSmokeEnvironment,
  PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS,
  PORTABLE_SMOKE_ENV_OVERRIDES,
  preparePortableSmokeEnvironment,
  sanitizePortableSmokeDiagnosticText
} from './portable-smoke-env.mjs'
import {
  assertProbe,
  bestEffortRegistryComparison,
  classifyPortableLaunchFailure,
  finalizePortableSmokeDirectory,
  launchResultDetails,
  PORTABLE_SMOKE_COMPLETED_MARKER,
  PORTABLE_SMOKE_ERROR_CODES,
  PORTABLE_SMOKE_RETAINED_FAILURES,
  PortableSmokeError,
  portableArtifactName,
  validatePortableMetadata,
  writeFailureDiagnostics
} from './test-windows-portable.mjs'

test('portable smoke seals inherited runtime and path overrides', () => {
  const probePath = path.resolve('tmp', 'portable-probe.json')
  const sourceEnv = {
    Path: 'C:\\Windows\\System32',
    SystemRoot: 'C:\\Windows',
    TEMP: 'C:\\Temp',
    HERMES_HOME: 'C:\\Users\\test\\AppData\\Local\\hermes',
    ELECTRON_RUN_AS_NODE: '1',
    PORTABLE_EXECUTABLE_DIR: 'C:\\stale-portable',
    HERMES_DESKTOP_USER_DATA_DIR: 'C:\\stale-user-data',
    HERMES_DESKTOP_PORTABLE_PROBE: 'C:\\stale-probe.json'
  }
  const originalEnv = { ...sourceEnv }

  const prepared = preparePortableSmokeEnvironment({ sourceEnv, probePath })

  assert.deepEqual(sourceEnv, originalEnv)
  assert.deepEqual(prepared.removedEnvironmentVariables, PORTABLE_SMOKE_ENV_OVERRIDES)
  for (const name of PORTABLE_SMOKE_ENV_OVERRIDES) assert.equal(prepared.env[name], undefined)
  assert.equal(prepared.env.HERMES_DESKTOP_PORTABLE_PROBE, probePath)
  assert.equal(prepared.env.Path, sourceEnv.Path)
  assert.equal(prepared.env.SystemRoot, sourceEnv.SystemRoot)
  assert.equal(prepared.env.TEMP, sourceEnv.TEMP)
})

test('portable smoke removes overrides case-insensitively', () => {
  const probePath = path.resolve('tmp', 'portable-probe.json')
  const prepared = preparePortableSmokeEnvironment({
    sourceEnv: {
      hermes_home: 'C:\\hermes',
      electron_run_as_node: '1',
      portable_executable_dir: 'C:\\portable',
      hermes_desktop_user_data_dir: 'C:\\user-data'
    },
    probePath
  })

  assert.deepEqual(prepared.removedEnvironmentVariables, PORTABLE_SMOKE_ENV_OVERRIDES)
  assert.deepEqual(Object.keys(prepared.env), ['HERMES_DESKTOP_PORTABLE_PROBE'])
})

test('portable smoke preflight rejects a reintroduced override', () => {
  const probePath = path.resolve('tmp', 'portable-probe.json')
  assert.throws(
    () =>
      assertPortableSmokeEnvironment(
        { HERMES_DESKTOP_PORTABLE_PROBE: probePath, ELECTRON_RUN_AS_NODE: '1' },
        probePath
      ),
    /still contains inherited overrides: ELECTRON_RUN_AS_NODE/
  )
})

test('portable smoke preflight requires an absolute probe path', () => {
  assert.throws(
    () => preparePortableSmokeEnvironment({ sourceEnv: {}, probePath: 'portable-probe.json' }),
    /probe path must be absolute/
  )
})

test('portable smoke diagnostics are bounded and redact credential values', t => {
  const secret = 'sentinel-secret-that-must-not-leak'
  const sourceEnv = { TEST_API_KEY: secret }
  const oversizedOutput = `before ${secret} ${'x'.repeat(PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS * 2)}`
  const sanitized = sanitizePortableSmokeDiagnosticText(oversizedOutput, sourceEnv)

  assert.equal(sanitized.includes(secret), false)
  assert.match(sanitized, /\[REDACTED:TEST_API_KEY\]/)
  assert.ok(sanitized.length <= PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS)
  assert.match(sanitized, /\.\.\.\[truncated\]$/)

  const launcherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-smoke-diagnostics-'))
  t.after(() => fs.rmSync(launcherDir, { recursive: true, force: true }))
  const launcher = path.join(launcherDir, 'portable.exe')
  const artifact = path.join(launcherDir, 'artifact.exe')
  const probePath = path.join(launcherDir, 'probe.json')
  const artifactContents = Buffer.from('portable-artifact')
  fs.writeFileSync(artifact, artifactContents)
  const result = {
    status: 1,
    signal: null,
    stdout: oversizedOutput,
    stderr: `Bearer ${secret}`
  }
  const diagnosticsPath = writeFailureDiagnostics({
    launcherDir,
    launcher,
    artifact,
    probePath,
    result,
    elapsedMs: 25,
    removedEnvironmentVariables: PORTABLE_SMOKE_ENV_OVERRIDES,
    error: new PortableSmokeError(PORTABLE_SMOKE_ERROR_CODES.CHILD_EXITED, `failed with ${secret}`),
    sourceEnv
  })
  const diagnosticsText = fs.readFileSync(diagnosticsPath, 'utf8')
  const diagnostics = JSON.parse(diagnosticsText)

  assert.equal(diagnosticsText.includes(secret), false)
  assert.ok(diagnostics.stdout.length <= PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS)
  assert.equal(diagnostics.code, PORTABLE_SMOKE_ERROR_CODES.CHILD_EXITED)
  assert.equal(diagnostics.artifact.size, artifactContents.length)
  assert.equal(diagnostics.artifact.mtime.length > 0, true)
  assert.equal(
    diagnostics.artifact.sha256,
    createHash('sha256').update(artifactContents).digest('hex').toUpperCase()
  )
  assert.equal(Object.hasOwn(diagnostics, 'env'), false)
  assert.equal(Object.hasOwn(diagnostics, 'sourceEnv'), false)
  assert.equal(launchResultDetails(result, 25, sourceEnv).includes(secret), false)
})

test('portable smoke launch failures use stable error codes', () => {
  const timedOut = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })
  const spawnFailed = Object.assign(new Error('not found'), { code: 'ENOENT' })

  assert.equal(
    classifyPortableLaunchFailure({ error: timedOut, status: null }, 120_000).code,
    PORTABLE_SMOKE_ERROR_CODES.TIMEOUT
  )
  assert.equal(
    classifyPortableLaunchFailure({ error: spawnFailed, status: null }, 5).code,
    PORTABLE_SMOKE_ERROR_CODES.SPAWN_FAILED
  )
  assert.equal(
    classifyPortableLaunchFailure({ status: 7, signal: null, stdout: '', stderr: '' }, 10).code,
    PORTABLE_SMOKE_ERROR_CODES.CHILD_EXITED
  )
  assert.equal(classifyPortableLaunchFailure({ status: 0, signal: null }, 10), null)
})

test('portable smoke registry comparison is best effort and stores only digests', () => {
  const secret = 'sentinel-registry-secret'
  const changed = bestEffortRegistryComparison('before', () => 'after', { TEST_API_KEY: secret })
  const failed = bestEffortRegistryComparison(
    'before',
    () => {
      throw new Error(`registry failed with ${secret}`)
    },
    { TEST_API_KEY: secret }
  )

  assert.equal(changed.changed, true)
  assert.equal(changed.beforeSha256.length, 64)
  assert.equal(changed.afterSha256.length, 64)
  assert.equal(Object.hasOwn(changed, 'before'), false)
  assert.equal(Object.hasOwn(changed, 'after'), false)
  assert.equal(failed.changed, null)
  assert.equal(failed.error.includes(secret), false)
})

test('portable smoke cleans successful runs and preserves completed failure diagnostics', t => {
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-smoke-finalize-'))
  const successDir = path.join(smokeRoot, 'portable-smoke-success')
  const failureDir = path.join(smokeRoot, 'portable-smoke-failure')
  fs.mkdirSync(successDir)
  fs.mkdirSync(failureDir)
  const messages = []
  t.after(() => fs.rmSync(smokeRoot, { recursive: true, force: true }))

  finalizePortableSmokeDirectory(successDir, true)
  finalizePortableSmokeDirectory(failureDir, false, {
    completedDiagnostics: true,
    smokeRoot,
    log: message => messages.push(message)
  })

  assert.equal(fs.existsSync(successDir), false)
  assert.equal(fs.existsSync(failureDir), true)
  assert.equal(fs.existsSync(path.join(failureDir, PORTABLE_SMOKE_COMPLETED_MARKER)), true)
  assert.deepEqual(messages, [`[portable-smoke] failure artifacts preserved: ${failureDir}`])
})

test('portable smoke retains only the newest five completed failure directories', t => {
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-smoke-retention-'))
  const messages = []
  t.after(() => fs.rmSync(smokeRoot, { recursive: true, force: true }))

  const timeoutDir = path.join(smokeRoot, 'portable-smoke-timeout')
  fs.mkdirSync(timeoutDir)
  fs.writeFileSync(path.join(timeoutDir, 'portable-smoke-diagnostics.json'), '{}')
  finalizePortableSmokeDirectory(timeoutDir, false, {
    completedDiagnostics: false,
    smokeRoot,
    log: message => messages.push(message)
  })

  for (let index = 0; index < PORTABLE_SMOKE_RETAINED_FAILURES + 2; index += 1) {
    const launcherDir = path.join(smokeRoot, `portable-smoke-${String(index).padStart(2, '0')}`)
    fs.mkdirSync(launcherDir)
    fs.writeFileSync(path.join(launcherDir, 'portable-smoke-diagnostics.json'), '{}')
    finalizePortableSmokeDirectory(launcherDir, false, {
      completedDiagnostics: true,
      smokeRoot,
      log: message => messages.push(message)
    })
  }

  const retained = fs.readdirSync(smokeRoot).filter(name => name.startsWith('portable-smoke-')).sort()
  assert.equal(retained.length, PORTABLE_SMOKE_RETAINED_FAILURES + 1)
  assert.deepEqual(retained, [
    'portable-smoke-02',
    'portable-smoke-03',
    'portable-smoke-04',
    'portable-smoke-05',
    'portable-smoke-06',
    'portable-smoke-timeout'
  ])
  assert.equal(fs.existsSync(path.join(timeoutDir, PORTABLE_SMOKE_COMPLETED_MARKER)), false)
  assert.equal(messages.filter(message => message.includes('pruned old failure artifacts')).length, 2)
})

test('portable artifact uses the target-specific product name', () => {
  assert.equal(
    portableArtifactName({ version: '1.2.3', build: { portable: { artifactName: 'App-Portable-${version}-${arch}.${ext}' } } }, 'x64'),
    'App-Portable-1.2.3-x64.exe'
  )
})

test('portable launcher metadata follows electron-builder package fields', () => {
  const packageJson = {
    version: '0.1.1',
    productName: 'RuyiHermesAgent',
    description: 'Native desktop application for RuyiHermesAgent, powered by the Hermes agent runtime.',
    author: 'Nous Research'
  }
  const metadata = {
    ProductName: packageJson.productName,
    FileDescription: packageJson.description,
    CompanyName: packageJson.author,
    InternalName: '',
    OriginalFilename: '',
    FileVersion: packageJson.version,
    ProductVersion: packageJson.version
  }

  assert.doesNotThrow(() => validatePortableMetadata(metadata, packageJson))
  assert.throws(
    () => validatePortableMetadata({ ...metadata, FileDescription: 'RuyiHermesAgent Desktop' }, packageJson),
    /FileDescription mismatch/
  )
})

test('portable probe requires adjacent desktop and Hermes data paths', () => {
  const launcherDir = 'D:\\Tools\\Ruyi'

  assert.doesNotThrow(() =>
    assertProbe(
      {
        enabled: true,
        executableDir: launcherDir,
        dataDir: path.win32.join(launcherDir, 'data'),
        hermesHome: path.win32.join(launcherDir, 'data', 'hermes'),
        userDataDir: path.win32.join(launcherDir, 'data', 'RuyiHermesAgent'),
        registerDeepLinkProtocol: false
      },
      launcherDir
    )
  )
})
