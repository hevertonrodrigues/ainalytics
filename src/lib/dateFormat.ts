/**
 * Locale-aware date formatting utility.
 *
 * Maps i18n language codes to BCP 47 locales so that dates follow the
 * user's selected language rather than the browser system locale.
 *
 *   en    → en-CA  (YYYY-MM-DD)
 *   pt-br → pt-BR  (DD/MM/YYYY)
 *   es    → es-ES  (DD/MM/YYYY)
 */
import i18n from '@/i18n';

// ─── BCP 47 locale mapping ────────────────────────────────
const LOCALE_MAP: Record<string, string> = {
  en: 'en-CA',
  'pt-br': 'pt-BR',
  es: 'es-ES',
};

/** Resolve BCP 47 locale from an i18n language code. */
function resolveLocale(lang?: string): string {
  const key = (lang ?? i18n.language ?? 'en').toLowerCase();
  return LOCALE_MAP[key] ?? LOCALE_MAP['en'] ?? 'en-CA';
}

// ─── Preset option sets ────────────────────────────────────
export const DATE_PRESETS = {
  /** e.g. 2026-03-25 / 25/03/2026 */
  dateOnly: {} as Intl.DateTimeFormatOptions,

  /** e.g. Mar 25, 2026, 08:30 PM / 25 de mar. de 2026 20:30 */
  dateTime: {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  } as Intl.DateTimeFormatOptions,

  /** e.g. Mar 25 / 25 de mar. */
  shortDate: {
    month: 'short', day: 'numeric',
  } as Intl.DateTimeFormatOptions,

  /** e.g. March 25, 2026 / 25 de março de 2026 */
  longDate: {
    year: 'numeric', month: 'long', day: 'numeric',
  } as Intl.DateTimeFormatOptions,

  /** e.g. Mar 25, 2026 / 25 de mar. de 2026 */
  shortDateYear: {
    month: 'short', day: 'numeric', year: 'numeric',
  } as Intl.DateTimeFormatOptions,

  /** e.g. 2026 March / março de 2026 */
  monthYear: {
    year: 'numeric', month: 'long',
  } as Intl.DateTimeFormatOptions,

  /** e.g. Mar 25, 08:30:15 */
  dateTimeSeconds: {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  } as Intl.DateTimeFormatOptions,
} as const;

// ─── Main formatter ────────────────────────────────────────

/**
 * Format a date value respecting the current i18n language.
 *
 * @param input  ISO string, timestamp, or Date object
 * @param opts   Intl.DateTimeFormatOptions or a preset key
 * @param lang   Override language (useful in non-React contexts like PDF generation)
 */
export function formatDate(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions | keyof typeof DATE_PRESETS,
  lang?: string,
): string {
  const date = input instanceof Date ? input : new Date(input);
  const locale = resolveLocale(lang);

  const options: Intl.DateTimeFormatOptions =
    typeof opts === 'string' ? DATE_PRESETS[opts] : (opts ?? {});

  return date.toLocaleDateString(locale, options);
}

/**
 * Format a date+time value (uses toLocaleString instead of toLocaleDateString).
 */
export function formatDateTime(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions | keyof typeof DATE_PRESETS,
  lang?: string,
): string {
  const date = input instanceof Date ? input : new Date(input);
  const locale = resolveLocale(lang);

  const options: Intl.DateTimeFormatOptions =
    typeof opts === 'string' ? DATE_PRESETS[opts] : (opts ?? {});

  return date.toLocaleString(locale, options);
}
