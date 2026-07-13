import { describe, expect, it } from 'vitest'

import { brandText, brandTranslations } from './brand'
import { en } from './en'

describe('RuyiHermesAgent product branding', () => {
  it('brands product names without changing technical hermes identifiers', () => {
    expect(brandText('en', 'Hermes Desktop uses Hermes Agent via `hermes` and HERMES_HOME.')).toBe(
      'RuyiHermesAgent Desktop uses RuyiHermesAgent via `hermes` and HERMES_HOME.'
    )
    expect(brandText('zh', 'Hermes Desktop 正在启动 Hermes Agent。')).toBe('如意智能体桌面端 正在启动 如意智能体。')
  })

  it('brands strings returned by parameterized translations', () => {
    const translations = brandTranslations('en', en)

    expect(translations.shell.statusbar.desktopVersion('1.2.3')).toBe('RuyiHermesAgent Desktop v1.2.3')
  })
})
