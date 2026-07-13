import { en } from './en'
import { brandTranslations } from './brand'
import { ja } from './ja'
import type { Locale, Translations } from './types'
import { zh } from './zh'
import { zhHant } from './zh-hant'

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: brandTranslations('en', en),
  zh: brandTranslations('zh', zh),
  'zh-hant': brandTranslations('zh-hant', zhHant),
  ja: brandTranslations('ja', ja)
}
