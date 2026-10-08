/**
 * Web binding for `@servisapp/i18n`.
 *
 * The UI language is Turkish and there is no locale switcher in V1 (SRS §7 item 11),
 * so this is a re-export rather than a provider. When a switcher is needed, only this
 * file changes: components already call `t()` and never hold a literal string.
 */
export { DEFAULT_LOCALE, t, type Locale, type TranslationKey } from '@servisapp/i18n';
