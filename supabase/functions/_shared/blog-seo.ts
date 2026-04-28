/**
 * Shared SEO/meta builder for the simplified blog API.
 *
 * Every public read endpoint returns `{ data, seo }`. The `seo` block bundles
 * everything a pre-rendered page needs for `<head>` tags + JSON-LD.
 */
import { absoluteUrl, BLOG_BASE_URL, type Lang, localeFor, SUPPORTED_LANGS } from "./blog-langs.ts";
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface LocaleMeta {
  lang: Lang;
  site_title: string;
  site_description: string;
  site_keywords: string[];
  default_og_image_url: string | null;
  publisher_name: string;
  publisher_url: string;
  publisher_logo_url: string;
  publisher_logo_width: number;
  publisher_logo_height: number;
  twitter_handle: string | null;
  trending_title: string;
  trending_description: string;
  trending_eyebrow: string | null;
  newsletter_eyebrow: string | null;
  newsletter_title: string | null;
  newsletter_text: string | null;
  newsletter_placeholder: string | null;
  newsletter_button: string | null;
  newsletter_success_message: string | null;
  rankings_title: string;
  rankings_description: string;
  categories_title: string;
  categories_description: string;
  category_segment: string;
}

const LOCALE_META_CACHE = new Map<string, LocaleMeta>();

export async function loadLocaleMeta(db: SupabaseClient, lang: Lang): Promise<LocaleMeta> {
  const cached = LOCALE_META_CACHE.get(lang);
  if (cached) return cached;
  const { data, error } = await db
    .from("blog_locale_meta")
    .select("*")
    .eq("lang", lang)
    .single();
  if (error || !data) {
    // Fallback minimal meta — should never happen if the seed ran
    const fallback: LocaleMeta = {
      lang,
      site_title: "Index AI",
      site_description: "Independent news on the future of generative search.",
      site_keywords: [],
      default_og_image_url: null,
      publisher_name: "Ainalytics",
      publisher_url: "https://indexai.news",
      publisher_logo_url: "https://indexai.news/brand/logo.png",
      publisher_logo_width: 512,
      publisher_logo_height: 512,
      twitter_handle: null,
      trending_title: "",
      trending_description: "",
      trending_eyebrow: null,
      newsletter_eyebrow: null, newsletter_title: null, newsletter_text: null,
      newsletter_placeholder: null, newsletter_button: null, newsletter_success_message: null,
      rankings_title: "", rankings_description: "",
      categories_title: "", categories_description: "",
      category_segment: lang === "en" ? "category" : "categoria",
    };
    return fallback;
  }
  LOCALE_META_CACHE.set(lang, data as LocaleMeta);
  return data as LocaleMeta;
}

export interface SeoBlock {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  ogImageAlt: string | null;
  ogType: "website" | "article";
  twitterCard: "summary" | "summary_large_image";
  twitterHandle: string | null;
  publisher: {
    name: string;
    url: string;
    logo: { url: string; width: number; height: number };
  };
  lang: Lang;
  locale: string;
  alternates: Array<{ hreflang: string; href: string }>;
  publishedTime: string | null;
  modifiedTime: string | null;
  robots: string;
  // deno-lint-ignore no-explicit-any
  structuredData: Record<string, any> | null;
}

export interface BuildSeoOptions {
  lang: Lang;
  meta: LocaleMeta;
  /** Path on the website (e.g. `/pt/some-slug`). Required. */
  path: string;
  /** Page-specific title. Falls back to site title. */
  title?: string;
  /** Page-specific description. Falls back to site description. */
  description?: string;
  keywords?: string[];
  ogImage?: string | null;
  ogImageAlt?: string | null;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /** Optional: per-locale alternate paths. If omitted, all langs use the same path. */
  alternatePaths?: Partial<Record<Lang, string>>;
  /** Optional: pre-built JSON-LD structured data. */
  // deno-lint-ignore no-explicit-any
  structuredData?: Record<string, any> | null;
  /** Optional: noindex/nofollow override. Defaults to "index,follow". */
  robots?: string;
}

/**
 * Build the SEO block for a public read endpoint response.
 */
export function buildSeo(opts: BuildSeoOptions): SeoBlock {
  const { lang, meta, path } = opts;

  const title = opts.title ?? meta.site_title;
  const description = opts.description ?? meta.site_description;
  const keywords = (opts.keywords && opts.keywords.length > 0)
    ? opts.keywords
    : meta.site_keywords;
  const ogImage = opts.ogImage ?? meta.default_og_image_url;
  const ogType = opts.ogType ?? "website";
  const twitterCard = opts.twitterCard ?? (ogImage ? "summary_large_image" : "summary");

  const altMap = opts.alternatePaths ?? {};
  const alternates: Array<{ hreflang: string; href: string }> = [];
  for (const l of SUPPORTED_LANGS) {
    const altPath = altMap[l] ?? path.replace(/^\/[a-z]{2}(?=\/|$)/, `/${l}`);
    alternates.push({ hreflang: localeFor(l), href: absoluteUrl(altPath) });
  }
  // x-default points at the path in the default locale (or the current path)
  const defaultPath = altMap.pt ?? path.replace(/^\/[a-z]{2}(?=\/|$)/, "/pt");
  alternates.push({ hreflang: "x-default", href: absoluteUrl(defaultPath) });

  return {
    title,
    description,
    keywords,
    canonical: absoluteUrl(path),
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogImageAlt: opts.ogImageAlt ?? null,
    ogType,
    twitterCard,
    twitterHandle: meta.twitter_handle,
    publisher: {
      name: meta.publisher_name,
      url: meta.publisher_url,
      logo: {
        url: meta.publisher_logo_url,
        width: meta.publisher_logo_width,
        height: meta.publisher_logo_height,
      },
    },
    lang,
    locale: localeFor(lang),
    alternates,
    publishedTime: opts.publishedTime ?? null,
    modifiedTime: opts.modifiedTime ?? null,
    robots: opts.robots ?? "index,follow",
    structuredData: opts.structuredData ?? null,
  };
}

/**
 * NewsArticle JSON-LD builder — composes Schema.org markup for an article.
 * When `sources[]` is provided, emits a `citation[]` array with one
 * `CreativeWork` entry per source.
 */
// deno-lint-ignore no-explicit-any
export function buildNewsArticleLd(args: {
  url: string;
  headline: string;
  description: string;
  imageUrls: string[];
  datePublished: string;
  dateModified: string;
  author: { name: string; url?: string | null };
  publisher: { name: string; url: string; logo: { url: string; width: number; height: number } };
  keywords: string[];
  section: string;
  sources?: Array<{ name: string; url: string }>;
  // deno-lint-ignore no-explicit-any
}): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": { "@type": "WebPage", "@id": args.url },
    "headline": args.headline,
    "description": args.description,
    "image": args.imageUrls,
    "datePublished": args.datePublished,
    "dateModified": args.dateModified,
    "author": [{
      "@type": "Person",
      "name": args.author.name,
      ...(args.author.url ? { "url": args.author.url } : {}),
    }],
    "publisher": {
      "@type": "Organization",
      "name": args.publisher.name,
      "url": args.publisher.url,
      "logo": {
        "@type": "ImageObject",
        "url": args.publisher.logo.url,
        "width": args.publisher.logo.width,
        "height": args.publisher.logo.height,
      },
    },
    "articleSection": args.section,
    "keywords": args.keywords.join(", "),
    ...(args.sources && args.sources.length > 0
      ? {
        "citation": args.sources.map((s) => ({
          "@type": "CreativeWork",
          "name": s.name,
          "url": s.url,
        })),
      }
      : {}),
  };
}

/**
 * WebSite JSON-LD with SearchAction — for the home / trending page.
 */
// deno-lint-ignore no-explicit-any
export function buildWebSiteLd(args: {
  url: string;
  name: string;
  description: string;
  publisher: { name: string; url: string; logo: { url: string; width: number; height: number } };
  // deno-lint-ignore no-explicit-any
}): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": args.url,
    "name": args.name,
    "description": args.description,
    "publisher": {
      "@type": "Organization",
      "name": args.publisher.name,
      "url": args.publisher.url,
      "logo": { "@type": "ImageObject", "url": args.publisher.logo.url },
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${BLOG_BASE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
