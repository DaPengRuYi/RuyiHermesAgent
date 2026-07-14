import { describe, expect, it } from 'vitest'

import { brandText, brandTranslations } from './brand'
import { en } from './en'

describe('如意助手 product branding', () => {
  it('brands product names without changing technical hermes identifiers', () => {
    expect(brandText('en', 'Hermes Desktop uses Hermes Agent via `hermes` and HERMES_HOME.')).toBe(
      '如意助手 uses 如意助手 via `hermes` and HERMES_HOME.'
    )
    expect(brandText('zh', 'Hermes Desktop 正在启动 Hermes Agent。')).toBe('如意助手 正在启动 如意助手。')
    expect(brandText('zh', 'Hermes 桌面版已就绪')).toBe('如意助手已就绪')
  })

  it('brands strings returned by parameterized translations', () => {
    const translations = brandTranslations('en', en)

    expect(translations.shell.statusbar.desktopVersion('1.2.3')).toBe('如意助手 v1.2.3')
  })
})
