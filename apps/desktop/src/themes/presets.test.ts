import { describe, expect, it } from 'vitest'

import { BUILTIN_THEME_LIST, DEFAULT_SKIN_NAME, DEFAULT_TYPOGRAPHY, EMOJI_FALLBACK, ruyiTheme } from './presets'

// #40364: none of the UI text/mono fonts carry emoji glyphs, so every font
// stack must end with a color-emoji fallback or emoji render as tofu on
// platforms whose default font lacks them (e.g. Linux).
describe('theme typography emoji fallback (#40364)', () => {
  const stacks: Array<[string, string]> = [
    ['DEFAULT_TYPOGRAPHY.fontSans', DEFAULT_TYPOGRAPHY.fontSans],
    ['DEFAULT_TYPOGRAPHY.fontMono', DEFAULT_TYPOGRAPHY.fontMono],
    // A theme may override only fontMono (fontSans then falls back to the
    // default, which already carries the emoji stack), so skip undefined.
    ...BUILTIN_THEME_LIST.flatMap(theme =>
      (
        [
          [`${theme.name}.fontSans`, theme.typography?.fontSans],
          [`${theme.name}.fontMono`, theme.typography?.fontMono]
        ] as Array<[string, string | undefined]>
      ).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  ]

  it.each(stacks)('%s includes a color-emoji font', (_label, stack) => {
    expect(stack).toMatch(/Apple Color Emoji|Segoe UI Emoji|Noto Color Emoji|(^|,\s*)emoji\b/)
  })

  it('EMOJI_FALLBACK lists the major platform emoji fonts', () => {
    expect(EMOJI_FALLBACK).toContain('Apple Color Emoji')
    expect(EMOJI_FALLBACK).toContain('Segoe UI Emoji')
    expect(EMOJI_FALLBACK).toContain('Noto Color Emoji')
  })
})

describe('如意国风科技蓝主题契约', () => {
  it('是首次启动时的默认主题', () => {
    expect(DEFAULT_SKIN_NAME).toBe('ruyi')
  })

  it('映射品牌主色并保持稳定界面层级', () => {
    expect(ruyiTheme.darkColors).toMatchObject({
      background: '#061426',
      foreground: '#E7F9FF',
      midground: '#2F8CFF',
      primary: '#63E6D6',
      mutedForeground: '#8CB3C9',
      warm: '#D9B76E'
    })
    expect(ruyiTheme.darkColors?.sidebarBackground).not.toBe(ruyiTheme.darkColors?.background)
    expect(ruyiTheme.darkColors?.card).not.toBe(ruyiTheme.darkColors?.background)
    expect(ruyiTheme.darkColors?.popover).not.toBe(ruyiTheme.darkColors?.card)
  })

  it('为终端提供与品牌一致且可读的 ANSI 色板', () => {
    expect(ruyiTheme.darkTerminal).toMatchObject({
      foreground: '#E7F9FF',
      cursor: '#63E6D6',
      blue: '#2F8CFF',
      cyan: '#63E6D6',
      yellow: '#D9B76E'
    })
  })
})
