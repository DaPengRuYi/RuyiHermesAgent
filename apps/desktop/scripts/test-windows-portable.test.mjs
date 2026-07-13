import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { assertProbe, portableArtifactName } from './test-windows-portable.mjs'

test('portable artifact uses the target-specific product name', () => {
  assert.equal(
    portableArtifactName({ version: '1.2.3', build: { portable: { artifactName: 'App-Portable-${version}-${arch}.${ext}' } } }, 'x64'),
    'App-Portable-1.2.3-x64.exe'
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
