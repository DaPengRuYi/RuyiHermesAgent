import type { Locale, Translations } from './types'

export const PRODUCT_NAME = 'RuyiHermesAgent'
export const PRODUCT_NAME_ZH = '如意智能体'
export const PRODUCT_DESKTOP_NAME = 'RuyiHermesAgent Desktop'
export const PRODUCT_DESKTOP_NAME_ZH = '如意智能体桌面端'

function productName(locale: Locale): string {
  return locale === 'zh' || locale === 'zh-hant' ? PRODUCT_NAME_ZH : PRODUCT_NAME
}

function desktopName(locale: Locale): string {
  return locale === 'zh' || locale === 'zh-hant' ? PRODUCT_DESKTOP_NAME_ZH : PRODUCT_DESKTOP_NAME
}

/**
 * Rebrand user-visible copy while preserving the underlying `hermes` CLI,
 * HERMES_* environment variables, paths, URLs, and protocol identifiers.
 */
export function brandText(locale: Locale, value: string): string {
  return value
    .replaceAll('Hermes Desktop', desktopName(locale))
    .replaceAll('Hermes Agent', productName(locale))
    .replace(/\bHermes\b/g, productName(locale))
}

function brandValue(value: unknown, locale: Locale): unknown {
  if (typeof value === 'string') {
    return brandText(locale, value)
  }

  if (typeof value === 'function') {
    return (...args: unknown[]) => brandText(locale, (value as (...params: unknown[]) => string)(...args))
  }

  if (Array.isArray(value)) {
    return value.map(item => brandValue(item, locale))
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, brandValue(item, locale)]))
  }

  return value
}

export function brandTranslations(locale: Locale, translations: Translations): Translations {
  return brandValue(translations, locale) as Translations
}
