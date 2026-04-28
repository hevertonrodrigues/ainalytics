/**
 * Per-page SEO/GEO management for an SPA.
 *
 * Why: index.html ships one set of <title>/<meta>/<link rel="canonical"> that
 * applies to every route until JS runs. Search & AI crawlers (Googlebot,
 * Bingbot, GPTBot, ClaudeBot, PerplexityBot, etc.) execute JS, so updating
 * these tags on route mount is enough — no SSR required.
 *
 * Usage:
 *   useSeo({
 *     title: 'GEO Essencial · Ainalytics',
 *     description: '...',
 *     canonical: 'https://ainalytics.tech/curso-geo-essencial',
 *     robots: 'index,follow',
 *     og: { image: 'https://ainalytics.tech/og-course.png' },
 *     hreflang: [{ lang: 'pt-br', href: '...' }],
 *     jsonLd: [courseSchema, faqSchema],
 *   });
 */

import { useEffect } from 'react';

const SITE_URL = 'https://ainalytics.tech';

// All <meta>/<link> tags this hook manages are tagged with this attribute so
// we can clean them up when the component unmounts (or update them in place).
const SEO_ATTR = 'data-seo';

// JSON-LD scripts get their own marker since each page may inject several.
const JSONLD_ATTR = 'data-seo-jsonld';

export interface SeoOptions {
  title?: string;
  description?: string;
  /** "index,follow" | "noindex,follow" | "noindex,nofollow" */
  robots?: string;
  /** Absolute URL. Falls back to current location.href. */
  canonical?: string;
  og?: {
    title?: string;
    description?: string;
    type?: 'website' | 'article' | 'product';
    image?: string;
    url?: string;
    siteName?: string;
    locale?: string;
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image';
    title?: string;
    description?: string;
    image?: string;
  };
  /** hreflang alternates. `x-default` is auto-added if not present. */
  hreflang?: Array<{ lang: string; href: string }>;
  /** One or many JSON-LD documents. Strings or objects. */
  jsonLd?: Array<Record<string, unknown> | string>;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"][${SEO_ATTR}]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute(SEO_ATTR, selector);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string, hreflang?: string) {
  if (!href) return;
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"][${SEO_ATTR}]` : `link[rel="${rel}"][${SEO_ATTR}]`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    el.setAttribute(SEO_ATTR, '1');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function clearManagedTags() {
  document.head.querySelectorAll(`[${SEO_ATTR}], [${JSONLD_ATTR}]`).forEach(el => el.remove());
}

export function useSeo(options: SeoOptions) {
  useEffect(() => {
    const prevTitle = document.title;

    if (options.title) document.title = options.title;

    if (options.description) setMeta('description', 'name', 'description', options.description);
    if (options.robots) setMeta('robots', 'name', 'robots', options.robots);

    const canonicalHref = options.canonical || (typeof window !== 'undefined' ? window.location.href : '');
    if (canonicalHref) setLink('canonical', canonicalHref);

    // Open Graph
    const og = options.og || {};
    setMeta('og-title', 'property', 'og:title', og.title || options.title || '');
    setMeta('og-description', 'property', 'og:description', og.description || options.description || '');
    if (og.type) setMeta('og-type', 'property', 'og:type', og.type);
    if (og.image) setMeta('og-image', 'property', 'og:image', og.image);
    setMeta('og-url', 'property', 'og:url', og.url || canonicalHref);
    if (og.siteName) setMeta('og-site-name', 'property', 'og:site_name', og.siteName);
    if (og.locale) setMeta('og-locale', 'property', 'og:locale', og.locale);

    // Twitter
    const tw = options.twitter || {};
    setMeta('tw-card', 'name', 'twitter:card', tw.card || 'summary_large_image');
    setMeta('tw-title', 'name', 'twitter:title', tw.title || og.title || options.title || '');
    setMeta('tw-description', 'name', 'twitter:description', tw.description || og.description || options.description || '');
    if (tw.image || og.image) setMeta('tw-image', 'name', 'twitter:image', tw.image || og.image || '');

    // hreflang alternates
    if (options.hreflang && options.hreflang.length > 0) {
      const hasDefault = options.hreflang.some(h => h.lang === 'x-default');
      const alternates = hasDefault ? options.hreflang : [...options.hreflang, { lang: 'x-default', href: options.hreflang[0]!.href }];
      alternates.forEach(({ lang, href }) => setLink('alternate', href, lang));
    }

    // JSON-LD
    (options.jsonLd || []).forEach(doc => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(JSONLD_ATTR, '1');
      script.text = typeof doc === 'string' ? doc : JSON.stringify(doc);
      document.head.appendChild(script);
    });

    return () => {
      document.title = prevTitle;
      clearManagedTags();
    };
    // We intentionally re-run when any option changes; serializing via JSON
    // keeps the dependency array stable for nested objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options)]);
}

/* ============================================================
   JSON-LD builders — small, typed factories.
   ============================================================ */

export const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Ainalytics',
  url: SITE_URL,
  logo: `${SITE_URL}/logo-purple.png`,
  sameAs: [] as string[],
  description:
    'AI Visibility Intelligence Platform — monitor what ChatGPT, Claude, Gemini and Grok say about your brand.',
} as const;

export const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Ainalytics',
  url: SITE_URL,
  inLanguage: ['en', 'es', 'pt-BR'],
  publisher: { '@type': 'Organization', name: 'Ainalytics', url: SITE_URL },
} as const;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPage(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(it => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}

export interface CourseSchemaInput {
  name: string;
  description: string;
  url: string;
  imageUrl?: string;
  priceBrl?: number;
  priceUsd?: number;
  durationMinutes?: number;
  numberOfLessons?: number;
}

export function courseSchema(input: CourseSchemaInput) {
  const offers: Record<string, unknown>[] = [];
  if (input.priceBrl) {
    offers.push({
      '@type': 'Offer',
      price: input.priceBrl.toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url: input.url,
      category: 'Paid',
    });
  }
  if (input.priceUsd) {
    offers.push({
      '@type': 'Offer',
      price: input.priceUsd.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: input.url,
      category: 'Paid',
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: 'pt-BR',
    image: input.imageUrl,
    provider: {
      '@type': 'Organization',
      name: 'Ainalytics',
      sameAs: SITE_URL,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: input.durationMinutes ? `PT${input.durationMinutes}M` : undefined,
      inLanguage: 'pt-BR',
    },
    offers: offers.length > 0 ? offers : undefined,
    numberOfLessons: input.numberOfLessons,
  };
}

export interface JobPostingInput {
  title: string;
  description: string;
  url: string;
  datePosted: string; // ISO
  validThrough?: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN';
  remote?: boolean;
  city?: string;
  country?: string;
  baseSalaryMin?: number;
  baseSalaryMax?: number;
  currency?: string;
}

export function jobPosting(input: JobPostingInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: input.title,
    description: input.description,
    datePosted: input.datePosted,
    validThrough: input.validThrough,
    employmentType: input.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Ainalytics',
      sameAs: SITE_URL,
      logo: `${SITE_URL}/logo-purple.png`,
    },
    jobLocationType: input.remote ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: input.remote
      ? { '@type': 'Country', name: input.country || 'Worldwide' }
      : undefined,
    jobLocation: input.city
      ? {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: input.city,
            addressCountry: input.country,
          },
        }
      : undefined,
    baseSalary:
      input.baseSalaryMin && input.currency
        ? {
            '@type': 'MonetaryAmount',
            currency: input.currency,
            value: {
              '@type': 'QuantitativeValue',
              minValue: input.baseSalaryMin,
              maxValue: input.baseSalaryMax || input.baseSalaryMin,
              unitText: 'MONTH',
            },
          }
        : undefined,
    url: input.url,
  };
}

export const HREFLANG_LANDING = [
  { lang: 'en', href: `${SITE_URL}/en` },
  { lang: 'es', href: `${SITE_URL}/es` },
  { lang: 'pt-br', href: `${SITE_URL}/pt-br` },
  { lang: 'x-default', href: `${SITE_URL}/` },
];

export { SITE_URL };
