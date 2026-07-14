import path from 'node:path'

const PORTABLE_SMOKE_ENV_OVERRIDES = Object.freeze([
  'ELECTRON_RUN_AS_NODE',
  'HERMES_DESKTOP_USER_DATA_DIR',
  'HERMES_HOME',
  'PORTABLE_EXECUTABLE_DIR'
])

const PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS = 8 * 1024
const SECRET_ENV_SUFFIXES = [
  '_API_KEY',
  '_TOKEN',
  '_SECRET',
  '_PASSWORD',
  '_CREDENTIALS',
  '_ACCESS_KEY',
  '_PRIVATE_KEY',
  '_OAUTH_TOKEN'
]
const SECRET_ENV_NAMES = new Set([
  'ANTHROPIC_BASE_URL',
  'GEMINI_BASE_URL',
  'GROQ_BASE_URL',
  'OLLAMA_BASE_URL',
  'OPENAI_BASE_URL',
  'OPENROUTER_BASE_URL',
  'XAI_BASE_URL'
])

const canonicalOverrideName = new Map(
  PORTABLE_SMOKE_ENV_OVERRIDES.map(name => [name.toUpperCase(), name])
)

function assertAbsoluteProbePath(probePath, pathModule = path) {
  if (typeof probePath !== 'string' || !probePath.trim() || !pathModule.isAbsolute(probePath)) {
    throw new Error(`portable smoke probe path must be absolute: ${probePath || '<empty>'}`)
  }
}

function assertPortableSmokeEnvironment(env, probePath, pathModule = path) {
  assertAbsoluteProbePath(probePath, pathModule)

  const inheritedOverrides = Object.keys(env).filter(name => canonicalOverrideName.has(name.toUpperCase()))
  if (inheritedOverrides.length > 0) {
    throw new Error(
      `portable smoke launch environment still contains inherited overrides: ${inheritedOverrides.join(', ')}`
    )
  }
  if (env.HERMES_DESKTOP_PORTABLE_PROBE !== probePath) {
    throw new Error('portable smoke launch environment does not contain the expected probe path')
  }
}

function preparePortableSmokeEnvironment({ sourceEnv = process.env, probePath, pathModule = path } = {}) {
  assertAbsoluteProbePath(probePath, pathModule)

  const env = {}
  const removed = new Set()

  for (const [name, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue

    const canonicalName = canonicalOverrideName.get(name.toUpperCase())
    if (canonicalName) {
      // This removes only the host's value. electron-builder's portable
      // launcher injects the real PORTABLE_EXECUTABLE_DIR into the app it
      // starts, so the executable still discovers its own adjacent data dir.
      removed.add(canonicalName)
      continue
    }

    // A stale value from the parent must never redirect this run's probe.
    if (name.toUpperCase() === 'HERMES_DESKTOP_PORTABLE_PROBE') continue
    env[name] = value
  }

  env.HERMES_DESKTOP_PORTABLE_PROBE = probePath
  assertPortableSmokeEnvironment(env, probePath, pathModule)

  return {
    env,
    removedEnvironmentVariables: PORTABLE_SMOKE_ENV_OVERRIDES.filter(name => removed.has(name))
  }
}

function sanitizePortableSmokeDiagnosticText(
  text,
  sourceEnv = process.env,
  maxChars = PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS
) {
  let sanitized = text == null ? '' : String(text)
  const replacements = []

  for (const [name, value] of Object.entries(sourceEnv)) {
    const upperName = name.toUpperCase()
    const secretName =
      SECRET_ENV_NAMES.has(upperName) || SECRET_ENV_SUFFIXES.some(suffix => upperName.endsWith(suffix))
    if (!secretName || typeof value !== 'string' || value.length === 0) continue
    replacements.push({ name, value })
  }

  // Longest first prevents a short credential that is a prefix of another
  // credential from leaving a secret suffix behind.
  replacements.sort((left, right) => right.value.length - left.value.length)
  for (const { name, value } of replacements) {
    sanitized = sanitized.split(value).join(`[REDACTED:${name}]`)
  }

  sanitized = sanitized
    .replace(/\b(?:Bearer|Basic)\s+[^\s]+/gi, match => `${match.split(/\s/, 1)[0]} [REDACTED]`)
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/gi, '$1[REDACTED]@')
  const limit = Number.isFinite(maxChars) ? Math.max(64, Math.floor(maxChars)) : PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS
  if (sanitized.length <= limit) return sanitized

  const suffix = '\n...[truncated]'
  return `${sanitized.slice(0, limit - suffix.length)}${suffix}`
}

export {
  assertPortableSmokeEnvironment,
  PORTABLE_SMOKE_DIAGNOSTIC_MAX_CHARS,
  PORTABLE_SMOKE_ENV_OVERRIDES,
  preparePortableSmokeEnvironment,
  sanitizePortableSmokeDiagnosticText
}
