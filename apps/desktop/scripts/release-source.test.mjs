import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeGitHubRepository, rawInstallScriptUrl, validateRemoteInstallScript } from './release-source.mjs'

test('release source normalizes the fork origin and pins raw scripts by full SHA', () => {
  const commit = 'a'.repeat(40)
  assert.equal(
    normalizeGitHubRepository('git@github.com:DaPengRuYi/RuyiHermesAgent.git'),
    'DaPengRuYi/RuyiHermesAgent'
  )
  assert.equal(
    normalizeGitHubRepository('https://github.com/DaPengRuYi/RuyiHermesAgent.git'),
    'DaPengRuYi/RuyiHermesAgent'
  )
  assert.equal(
    rawInstallScriptUrl('DaPengRuYi/RuyiHermesAgent', commit, 'install.ps1'),
    `https://raw.githubusercontent.com/DaPengRuYi/RuyiHermesAgent/${commit}/scripts/install.ps1`
  )
})

test('release source rejects stale remote install scripts', () => {
  assert.throws(
    () => validateRemoteInstallScript('install.ps1', '# old installer', 'DaPengRuYi/RuyiHermesAgent'),
    /stale/
  )
  assert.doesNotThrow(() =>
    validateRemoteInstallScript(
      'install.ps1',
      '[string]$RepoSlug = "DaPengRuYi/RuyiHermesAgent"\nhttps://github.com/$RepoSlug\nRuyiHermesAgent.exe',
      'DaPengRuYi/RuyiHermesAgent'
    )
  )
})
