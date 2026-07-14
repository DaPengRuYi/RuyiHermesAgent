#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { packagedAppLayout, renderArtifactName } from './desktop-product.mjs'
import {
  preparePortableSmokeEnvironment,
  sanitizePortableSmokeDiagnosticText
} from './portable-smoke-env.mjs'
import { readPeMachine, validateInstalledMetadata } from './test-windows-installer.mjs'
import { isMain } from './utils.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const SMOKE_ROOT = path.join(REPO_ROOT, 'tmp', 'desktop-portable-smoke')
const PORTABLE_SMOKE_COMPLETED_MARKER = '.diagnostics-complete'
const PORTABLE_SMOKE_RETAINED_FAILURES = 5
const desktopPackage = JSON.parse(fs.readFileSync(path.join(DESKTOP_ROOT, 'package.json'), 'utf8'))

const PORTABLE_SMOKE_ERROR_CODES = Object.freeze({
  ARTIFACT_COPY_FAILED: 'ARTIFACT_COPY_FAILED',
  ARTIFACT_MISSING: 'ARTIFACT_MISSING',
  CHILD_EXITED: 'CHILD_EXITED',
  CONTRACT_MISMATCH: 'CONTRACT_MISMATCH',
  PROBE_INVALID: 'PROBE_INVALID',
  PROBE_MISSING: 'PROBE_MISSING',
  REGISTRY_SIDE_EFFECT: 'REGISTRY_SIDE_EFFECT',
  REGISTRY_SNAPSHOT_FAILED: 'REGISTRY_SNAPSHOT_FAILED',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  SPAWN_FAILED: 'SPAWN_FAILED',
  TIMEOUT: 'TIMEOUT',
  UNEXPECTED: 'UNEXPECTED',
  UNPACKED_APP_MISSING: 'UNPACKED_APP_MISSING',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM'
})

class PortableSmokeError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'PortableSmokeError'
    this.code = code
  }
}

function asPortableSmokeError(error, fallbackCode = PORTABLE_SMOKE_ERROR_CODES.UNEXPECTED) {
  if (error instanceof PortableSmokeError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new PortableSmokeError(fallbackCode, message, error)
}

function portableArtifactName(packageJson = desktopPackage, arch = process.arch === 'arm64' ? 'arm64' : 'x64') {
  const template = packageJson?.build?.portable?.artifactName

  if (!template) throw new Error('build.portable.artifactName is not configured')

  return renderArtifactName(template, {
    version: packageJson.version,
    os: 'win',
    arch,
    ext: 'exe'
  })
}

function runPowerShell(script) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', timeout: 30_000, windowsHide: true }
  )

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || `PowerShell exited ${result.status}`)
  return result.stdout.trim()
}

function registrySnapshot() {
  return runPowerShell(String.raw`
$protocolKey = 'HKCU:\Software\Classes\hermes'
$protocolCommandKey = Join-Path $protocolKey 'shell\open\command'
$protocol = if (Test-Path -LiteralPath $protocolKey) {
  $item = Get-ItemProperty -LiteralPath $protocolKey
  [pscustomobject]@{
    Exists = $true
    Default = (Get-Item -LiteralPath $protocolKey).GetValue('')
    UrlProtocol = $item.'URL Protocol'
    Command = if (Test-Path -LiteralPath $protocolCommandKey) { (Get-Item -LiteralPath $protocolCommandKey).GetValue('') } else { $null }
  }
} else { [pscustomobject]@{ Exists = $false } }
$uninstall = @()
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
if (Test-Path -LiteralPath $uninstallRoot) {
  $uninstall = @(Get-ChildItem -LiteralPath $uninstallRoot -ErrorAction SilentlyContinue | ForEach-Object {
    $item = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
    if ($item.DisplayName -in @('RuyiHermesAgent', 'Ruyi Agent', 'Hermes')) {
      [pscustomobject]@{ Key = $_.PSChildName; DisplayName = $item.DisplayName; UninstallString = $item.UninstallString }
    }
  })
}
$shortcuts = @(
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'RuyiHermesAgent.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'RuyiHermesAgent.lnk')
) | Where-Object { Test-Path -LiteralPath $_ }
[pscustomobject]@{ Protocol = $protocol; Uninstall = @($uninstall); Shortcuts = @($shortcuts) } | ConvertTo-Json -Compress -Depth 5
`)
}

function fileMetadata(file) {
  const escaped = file.replaceAll("'", "''")
  const output = runPowerShell(
    `$item = Get-Item -LiteralPath '${escaped}'; $version = $item.VersionInfo; ` +
      `[pscustomobject]@{ProductName=$version.ProductName; FileDescription=$version.FileDescription; ` +
      `CompanyName=$version.CompanyName; InternalName=$version.InternalName; OriginalFilename=$version.OriginalFilename; ` +
      `FileVersion=$version.FileVersion; ProductVersion=$version.ProductVersion; ` +
      `SignatureStatus=(Get-AuthenticodeSignature -LiteralPath '${escaped}').Status.ToString()} | ConvertTo-Json -Compress`
  )
  return JSON.parse(output)
}

function assertProbe(probe, launcherDir) {
  const expectedData = path.join(launcherDir, 'data')

  if (probe.enabled !== true) throw new Error('portable probe did not enable portable mode')
  if (path.resolve(probe.executableDir) !== path.resolve(launcherDir))
    throw new Error(`portable launcher directory mismatch: ${probe.executableDir}`)
  if (path.resolve(probe.dataDir) !== path.resolve(expectedData))
    throw new Error(`portable data directory mismatch: ${probe.dataDir}`)
  if (path.resolve(probe.hermesHome) !== path.resolve(expectedData, 'hermes'))
    throw new Error(`portable HERMES_HOME mismatch: ${probe.hermesHome}`)
  if (path.resolve(probe.userDataDir) !== path.resolve(expectedData, 'RuyiHermesAgent'))
    throw new Error(`portable userData mismatch: ${probe.userDataDir}`)
  if (probe.registerDeepLinkProtocol !== false) throw new Error('portable build would register hermes://')
}

function validatePortableMetadata(metadata, packageJson = desktopPackage) {
  const companyName =
    typeof packageJson.author === 'string' ? packageJson.author : packageJson.author?.name
  const expected = {
    ProductName: packageJson.productName,
    FileDescription: packageJson.description,
    CompanyName: companyName
  }

  for (const [key, value] of Object.entries(expected)) {
    if (metadata?.[key] !== value) {
      throw new Error(`portable executable ${key} mismatch: expected ${value}, got ${metadata?.[key] ?? '<empty>'}`)
    }
  }
  for (const key of ['FileVersion', 'ProductVersion']) {
    if (!String(metadata?.[key] || '').startsWith(packageJson.version)) {
      throw new Error(
        `portable executable ${key} must start with ${packageJson.version}, got ${metadata?.[key] ?? '<empty>'}`
      )
    }
  }
}

function launchResultDetails(result, elapsedMs, sourceEnv = process.env) {
  const details = [
    `status=${result?.status ?? '<none>'}`,
    `signal=${result?.signal ?? '<none>'}`,
    `elapsedMs=${elapsedMs}`
  ]
  if (result?.error) {
    details.push(`spawnError=${sanitizePortableSmokeDiagnosticText(result.error.message, sourceEnv)}`)
  }
  if (result?.stdout?.trim()) {
    details.push(`stdout=${sanitizePortableSmokeDiagnosticText(result.stdout.trim(), sourceEnv)}`)
  }
  if (result?.stderr?.trim()) {
    details.push(`stderr=${sanitizePortableSmokeDiagnosticText(result.stderr.trim(), sourceEnv)}`)
  }
  return details.join('\n')
}

function classifyPortableLaunchFailure(result, elapsedMs, sourceEnv = process.env) {
  if (result?.error?.code === 'ETIMEDOUT') {
    return new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.TIMEOUT,
      `portable probe timed out\n${launchResultDetails(result, elapsedMs, sourceEnv)}`,
      result.error
    )
  }
  if (result?.error) {
    return new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.SPAWN_FAILED,
      `portable probe failed to start\n${launchResultDetails(result, elapsedMs, sourceEnv)}`,
      result.error
    )
  }
  if (result?.status !== 0) {
    return new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.CHILD_EXITED,
      `portable probe exited unsuccessfully\n${launchResultDetails(result, elapsedMs, sourceEnv)}`
    )
  }
  return null
}

function portableArtifactDiagnostics(artifact, sourceEnv = process.env) {
  const artifactPath = sanitizePortableSmokeDiagnosticText(artifact, sourceEnv)
  if (typeof artifact !== 'string' || artifact.length === 0) {
    return { path: artifactPath, exists: false, size: null, mtime: null, sha256: null }
  }
  if (!fs.existsSync(artifact)) {
    return { path: artifactPath, exists: false, size: null, mtime: null, sha256: null }
  }

  try {
    const stat = fs.statSync(artifact)
    return {
      path: artifactPath,
      exists: true,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      sha256: createHash('sha256').update(fs.readFileSync(artifact)).digest('hex').toUpperCase()
    }
  } catch (error) {
    return {
      path: artifactPath,
      exists: true,
      size: null,
      mtime: null,
      sha256: null,
      error: sanitizePortableSmokeDiagnosticText(error instanceof Error ? error.message : String(error), sourceEnv)
    }
  }
}

function bestEffortRegistryComparison(before, snapshot = registrySnapshot, sourceEnv = process.env) {
  if (before === undefined) return { attempted: false, changed: null }

  const comparison = {
    attempted: true,
    changed: null,
    beforeSha256: createHash('sha256').update(before).digest('hex').toUpperCase(),
    afterSha256: null,
    error: null
  }
  try {
    const after = snapshot()
    comparison.afterSha256 = createHash('sha256').update(after).digest('hex').toUpperCase()
    comparison.changed = after !== before
  } catch (error) {
    comparison.error = sanitizePortableSmokeDiagnosticText(
      error instanceof Error ? error.message : String(error),
      sourceEnv
    )
  }
  return comparison
}

function writeFailureDiagnostics({
  launcherDir,
  launcher,
  artifact,
  probePath,
  result,
  elapsedMs,
  removedEnvironmentVariables,
  error,
  registryComparison = { attempted: false, changed: null },
  sourceEnv = process.env
}) {
  const diagnosticsPath = path.join(launcherDir, 'portable-smoke-diagnostics.json')
  fs.writeFileSync(
    diagnosticsPath,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        code: error?.code || PORTABLE_SMOKE_ERROR_CODES.UNEXPECTED,
        artifact: portableArtifactDiagnostics(artifact, sourceEnv),
        launcher: sanitizePortableSmokeDiagnosticText(launcher, sourceEnv),
        probePath: sanitizePortableSmokeDiagnosticText(probePath, sourceEnv),
        probeExists: fs.existsSync(probePath),
        elapsedMs,
        removedEnvironmentVariables,
        status: result?.status ?? null,
        signal: result?.signal ?? null,
        spawnError: result?.error
          ? {
              message: sanitizePortableSmokeDiagnosticText(result.error.message, sourceEnv),
              code: result.error.code ?? null
            }
          : null,
        stdout: sanitizePortableSmokeDiagnosticText(result?.stdout, sourceEnv),
        stderr: sanitizePortableSmokeDiagnosticText(result?.stderr, sourceEnv),
        registryComparison,
        failure: sanitizePortableSmokeDiagnosticText(
          error instanceof Error ? error.message : String(error),
          sourceEnv
        )
      },
      null,
      2
    )
  )
  return diagnosticsPath
}

function pruneCompletedPortableSmokeFailures({
  smokeRoot = SMOKE_ROOT,
  retain = PORTABLE_SMOKE_RETAINED_FAILURES,
  currentDir,
  log = message => console.error(message)
} = {}) {
  if (!Number.isInteger(retain) || retain < 1) {
    throw new Error(`portable smoke failure retention must be a positive integer, received ${retain}`)
  }
  if (!fs.existsSync(smokeRoot)) return { retained: 0, pruned: [] }

  const resolvedRoot = path.resolve(smokeRoot)
  const resolvedCurrent = currentDir ? path.resolve(currentDir) : null
  const candidates = []
  for (const entry of fs.readdirSync(resolvedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('portable-smoke-')) continue
    const candidate = path.resolve(resolvedRoot, entry.name)
    if (path.dirname(candidate) !== resolvedRoot) continue
    const marker = path.join(candidate, PORTABLE_SMOKE_COMPLETED_MARKER)
    try {
      if (!fs.statSync(marker).isFile()) continue
      candidates.push({
        path: candidate,
        isCurrent: candidate === resolvedCurrent,
        completedAtMs: fs.statSync(marker).mtimeMs
      })
    } catch {}
  }

  candidates.sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1
    return right.completedAtMs - left.completedAtMs || right.path.localeCompare(left.path)
  })

  const pruned = []
  for (const candidate of candidates.slice(retain)) {
    try {
      fs.rmSync(candidate.path, { recursive: true, force: true })
      pruned.push(candidate.path)
      log(`[portable-smoke] pruned old failure artifacts: ${candidate.path}`)
    } catch (error) {
      log(
        `[portable-smoke] [WARN] failed to prune old failure artifacts ${candidate.path}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return { retained: candidates.length - pruned.length, pruned }
}

function finalizePortableSmokeDirectory(launcherDir, completed, {
  completedDiagnostics = false,
  smokeRoot = SMOKE_ROOT,
  retainFailures = PORTABLE_SMOKE_RETAINED_FAILURES,
  log = message => console.error(message)
} = {}) {
  if (completed) {
    fs.rmSync(launcherDir, { recursive: true, force: true })
    return
  }

  if (completedDiagnostics) {
    try {
      fs.writeFileSync(
        path.join(launcherDir, PORTABLE_SMOKE_COMPLETED_MARKER),
        JSON.stringify({ completedAt: new Date().toISOString() })
      )
      pruneCompletedPortableSmokeFailures({
        smokeRoot,
        retain: retainFailures,
        currentDir: launcherDir,
        log
      })
    } catch (error) {
      log(
        `[portable-smoke] [WARN] failed to update failure retention metadata: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
  log(`[portable-smoke] failure artifacts preserved: ${launcherDir}`)
}

function main() {
  if (process.platform !== 'win32') {
    throw new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.UNSUPPORTED_PLATFORM,
      'Windows portable smoke test requires Windows'
    )
  }

  const artifactName = portableArtifactName()
  const artifact = path.join(DESKTOP_ROOT, 'release', artifactName)
  const unpacked = packagedAppLayout({
    desktopRoot: DESKTOP_ROOT,
    packageJson: desktopPackage,
    platform: 'win32',
    arch: process.arch
  })
  if (!fs.existsSync(artifact)) {
    throw new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.ARTIFACT_MISSING,
      `missing portable artifact: ${artifact}`
    )
  }
  if (!fs.existsSync(unpacked.binary)) {
    throw new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.UNPACKED_APP_MISSING,
      `missing unpacked executable: ${unpacked.binary}`
    )
  }

  try {
    const expectedMachine = process.arch === 'arm64' ? 0xaa64 : 0x8664
    if (readPeMachine(unpacked.binary) !== expectedMachine) {
      throw new Error(`portable application has the wrong PE architecture for ${process.arch}`)
    }

    validateInstalledMetadata(fileMetadata(unpacked.binary))
    const metadata = fileMetadata(artifact)
    validatePortableMetadata(metadata)
    if (metadata.SignatureStatus !== 'Valid') {
      if (process.env.HERMES_REQUIRE_SIGNED_BUILD === '1') {
        throw new PortableSmokeError(
          PORTABLE_SMOKE_ERROR_CODES.SIGNATURE_INVALID,
          `portable Authenticode status is ${metadata.SignatureStatus}, expected Valid`
        )
      }
      console.log(
        `[portable-smoke] [WARN] Authenticode status is ${metadata.SignatureStatus}; signature enforcement is disabled`
      )
    }
  } catch (error) {
    if (error instanceof PortableSmokeError) throw error
    throw new PortableSmokeError(
      PORTABLE_SMOKE_ERROR_CODES.CONTRACT_MISMATCH,
      `portable artifact contract validation failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    )
  }

  fs.mkdirSync(SMOKE_ROOT, { recursive: true })
  const launcherDir = path.join(SMOKE_ROOT, `portable-smoke-${randomUUID().replaceAll('-', '')}`)
  const launcher = path.join(launcherDir, artifactName)
  const probePath = path.join(launcherDir, 'portable-probe.json')
  fs.mkdirSync(launcherDir)

  let completed = false
  let result
  let elapsedMs = 0
  let removedEnvironmentVariables = []
  let before
  let completedFailureDiagnostics = false

  try {
    try {
      fs.copyFileSync(artifact, launcher)
    } catch (error) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.ARTIFACT_COPY_FAILED,
        `failed to copy portable artifact into the smoke directory: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      )
    }
    try {
      before = registrySnapshot()
    } catch (error) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.REGISTRY_SNAPSHOT_FAILED,
        `failed to capture registry state before portable launch: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
    const prepared = preparePortableSmokeEnvironment({ sourceEnv: process.env, probePath })
    removedEnvironmentVariables = prepared.removedEnvironmentVariables
    const preflightDetail = removedEnvironmentVariables.length
      ? `removed inherited ${removedEnvironmentVariables.join(', ')}`
      : 'no inherited overrides detected'
    console.log(`[portable-smoke] preflight: launch environment sealed (${preflightDetail})`)

    const startedAt = Date.now()
    try {
      result = spawnSync(launcher, [], {
        cwd: launcherDir,
        env: prepared.env,
        encoding: 'utf8',
        timeout: 120_000,
        windowsHide: true
      })
    } catch (error) {
      elapsedMs = Date.now() - startedAt
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.SPAWN_FAILED,
        `portable probe spawn threw: ${sanitizePortableSmokeDiagnosticText(
          error instanceof Error ? error.message : String(error),
          process.env
        )}`,
        error
      )
    }
    elapsedMs = Date.now() - startedAt

    const launchFailure = classifyPortableLaunchFailure(result, elapsedMs)
    if (launchFailure) throw launchFailure
    if (!fs.existsSync(probePath)) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.PROBE_MISSING,
        `portable probe did not write its result\n${launchResultDetails(result, elapsedMs)}`
      )
    }

    let probe
    try {
      probe = JSON.parse(fs.readFileSync(probePath, 'utf8'))
    } catch (error) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.PROBE_INVALID,
        `portable probe result is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
    try {
      assertProbe(probe, launcherDir)
    } catch (error) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.CONTRACT_MISMATCH,
        error instanceof Error ? error.message : String(error),
        error
      )
    }

    let after
    try {
      after = registrySnapshot()
    } catch (error) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.REGISTRY_SNAPSHOT_FAILED,
        `failed to capture registry state after portable launch: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
    if (after !== before) {
      throw new PortableSmokeError(
        PORTABLE_SMOKE_ERROR_CODES.REGISTRY_SIDE_EFFECT,
        'portable launch changed hermes:// or uninstall registry state'
      )
    }

    console.log(`[portable-smoke] PASS: ${artifactName}`)
    console.log(`[portable-smoke] data root: ${path.join(launcherDir, 'data')}`)
    completed = true
  } catch (cause) {
    const error = asPortableSmokeError(cause)
    const registryComparison = bestEffortRegistryComparison(before)
    if (registryComparison.changed && error.code !== PORTABLE_SMOKE_ERROR_CODES.REGISTRY_SIDE_EFFECT) {
      error.message += '\nregistry state also changed during the failed portable launch'
    }
    if (registryComparison.error) {
      error.message += `\nfailed to compare registry state after the launch failure: ${registryComparison.error}`
    }
    try {
      const diagnosticsPath = writeFailureDiagnostics({
        launcherDir,
        launcher,
        artifact,
        probePath,
        result,
        elapsedMs,
        removedEnvironmentVariables,
        error,
        registryComparison
      })
      error.message += `\nportable smoke diagnostics: ${diagnosticsPath}`
      completedFailureDiagnostics = error.code !== PORTABLE_SMOKE_ERROR_CODES.TIMEOUT
    } catch (diagnosticsError) {
      const diagnosticsMessage = diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)
      error.message += `\nfailed to write portable smoke diagnostics: ${diagnosticsMessage}`
    }
    throw error
  } finally {
    finalizePortableSmokeDirectory(launcherDir, completed, {
      completedDiagnostics: completedFailureDiagnostics
    })
  }
}

export {
  assertProbe,
  bestEffortRegistryComparison,
  classifyPortableLaunchFailure,
  finalizePortableSmokeDirectory,
  launchResultDetails,
  PORTABLE_SMOKE_COMPLETED_MARKER,
  PORTABLE_SMOKE_ERROR_CODES,
  PORTABLE_SMOKE_RETAINED_FAILURES,
  PortableSmokeError,
  portableArtifactDiagnostics,
  portableArtifactName,
  pruneCompletedPortableSmokeFailures,
  validatePortableMetadata,
  writeFailureDiagnostics
}

if (isMain(import.meta.url)) {
  try {
    main()
  } catch (error) {
    const smokeError = asPortableSmokeError(error)
    console.error(
      `[portable-smoke] ${smokeError.code}: ${sanitizePortableSmokeDiagnosticText(smokeError.message, process.env)}`
    )
    process.exitCode = 1
  }
}
