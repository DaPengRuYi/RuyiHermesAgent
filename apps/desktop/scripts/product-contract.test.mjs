import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { desktopProduct, packagedAppLayout, renderArtifactName } from './desktop-product.mjs'

const DESKTOP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')
const desktopPackage = JSON.parse(fs.readFileSync(path.join(DESKTOP_ROOT, 'package.json'), 'utf8'))
const rootPackage = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))

test('desktop product branding stays separate from the hermes CLI contract', () => {
  const product = desktopProduct(desktopPackage)

  assert.equal(desktopPackage.name, 'hermes', 'private workspace name stays compatible with the lockfile')
  assert.equal(desktopPackage.productName, 'RuyiHermesAgent')
  assert.equal(product.productName, 'RuyiHermesAgent')
  assert.equal(product.executableName, 'RuyiHermesAgent')
  assert.equal(product.artifactName, 'RuyiHermesAgent-${version}-${os}-${arch}.${ext}')
  assert.equal(desktopPackage.build.portable.artifactName, 'RuyiHermesAgent-Portable-${version}-${arch}.${ext}')
  assert.equal(desktopPackage.build.appId, 'com.nousresearch.hermes', 'upgrade identity remains compatible')
  assert.deepEqual(desktopPackage.build.protocols[0].schemes, ['hermes'], 'deep-link compatibility is preserved')

  const pyproject = fs.readFileSync(path.join(REPO_ROOT, 'pyproject.toml'), 'utf8')
  assert.match(pyproject, /^hermes\s*=\s*["']hermes_cli\.main:main["']/m, 'CLI command must remain hermes')
})

test('packaged app layout and artifact names derive from package.json', () => {
  const windows = packagedAppLayout({
    desktopRoot: DESKTOP_ROOT,
    packageJson: desktopPackage,
    platform: 'win32',
    arch: 'x64'
  })
  const mac = packagedAppLayout({
    desktopRoot: DESKTOP_ROOT,
    packageJson: desktopPackage,
    platform: 'darwin',
    arch: 'arm64'
  })

  assert.equal(windows.binary, path.join(DESKTOP_ROOT, 'release', 'win-unpacked', 'RuyiHermesAgent.exe'))
  assert.equal(
    mac.binary,
    path.join(DESKTOP_ROOT, 'release', 'mac-arm64', 'RuyiHermesAgent.app', 'Contents', 'MacOS', 'RuyiHermesAgent')
  )
  assert.equal(
    renderArtifactName(desktopPackage.build.artifactName, {
      version: desktopPackage.version,
      os: 'win',
      arch: 'x64',
      ext: 'exe'
    }),
    'RuyiHermesAgent-0.1.1-win-x64.exe'
  )
})

test('root package metadata and student command target the Ruyi fork', () => {
  assert.equal(rootPackage.repository.url, 'git+https://github.com/DaPengRuYi/RuyiHermesAgent.git')
  assert.match(rootPackage.scripts['desktop:package:win'], /HERMES_REQUIRE_CLEAN_BUILD=1/)
  assert.match(rootPackage.scripts['desktop:package:win'], /test:desktop:bundle/)
  assert.match(rootPackage.scripts['desktop:package:win'], /test:desktop:install:win/)
  assert.match(rootPackage.scripts['desktop:package:portable:win'], /dist:win:portable/)
  assert.match(rootPackage.scripts['desktop:package:portable:win'], /test:desktop:app-bundle/)
  assert.doesNotMatch(rootPackage.scripts['desktop:package:portable:win'], /test:desktop:bundle(?:\s|$)/)
  assert.match(rootPackage.scripts['desktop:package:portable:win'], /test:desktop:portable:win/)
})
