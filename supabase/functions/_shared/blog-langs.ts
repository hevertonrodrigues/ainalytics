/**
 * Lang/locale helpers for the blog API.
 *
 * The API contract enforces locale via a `[lang]` path segment (`pt`/`es`/`en`)
 * — never inferred from `Accept-Language`.
 */

export type Lang = "pt" | "es" | "en";
export type Locale = "pt-BR" | "es-ES" | "en-US";

export const SUPPORTED_LANGS: Lang[] = ["pt", "es", "en"];
export const DEFAULT_LANG: Lang = "pt";

export const BLOG_BASE_URL = Deno.env.get("BLOG_BASE_URL") || "https://indexai.news";

const LANG_TO_LOCALE: Record<Lang, Locale> = {
  pt: "pt-BR",
  es: "es-ES",
  en: "en-US",
};

export function isSupportedLang(value: unknown): value is Lang {
  return typeof value === "string" && (SUPPORTED_LANGS as string[]).includes(value);
}

export function localeFor(lang: Lang): Locale {
  return LANG_TO_LOCALE[lang];
}

/**
 * Build the `alternates` map for a localized resource.
 *
 * @param entries — list of `(lang, slug)` entries from the translations table.
 *                  When `slug` is not used (homepage, list pages), pass `''`.
 * @param prefixFor — given a lang, returns the URL path prefix for that locale
 *                    (e.g. `/${lang}` for homepage, `/${lang}/categoria` for PT
 *                    categories). Receives the lang and slug; returns full path.
 */
export interface AlternateTarget {
  path: string;
  url: string;
  locale: Locale;
}

export type AlternateMap = Partial<Record<Lang, AlternateTarget>>;

export function buildAlternates(
  entries: Array<{ lang: string; slug: string }>,
  pathBuilder: (lang: Lang, slug: string) => string,
): AlternateMap {
  const out: AlternateMap = {};
  for (const e of entries) {
    if (!isSupportedLang(e.lang)) continue;
    const path = pathBuilder(e.lang, e.slug);
    out[e.lang] = {
      path,
      url: `${BLOG_BASE_URL}${path}`,
      locale: localeFor(e.lang),
    };
  }
  return out;
}

/** Absolute URL helper for canonicalUrl fields */
export function absoluteUrl(path: string): string {
  return `${BLOG_BASE_URL}${path}`;
}
