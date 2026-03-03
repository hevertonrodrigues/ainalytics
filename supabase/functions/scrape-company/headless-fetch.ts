/**
 * Headless Browser Fetch via Browserless.io
 *
 * Fetches rendered HTML for pages using Browserless.io's /content API.
 * Used to compare raw HTML (from fetch) vs rendered HTML (from headless browser)
 * for SSR detection, JS-dependency scoring, and mobile content parity.
 *
 * Environment: BROWSERLESS_API_KEY must be set.
 */

const BROWSERLESS_BASE = "https://production-sfo.browserless.io";
const TIMEOUT_MS = 15_000;

export interface HeadlessResult {
  url: string;
  desktop_html: string | null;
  mobile_html: string | null;
  desktop_text_length: number;
  mobile_text_length: number;
  error: string | null;
}

/**
 * Extract visible text length from raw HTML (rough but fast).
 */
function extractTextLength(html: string): number {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

/**
 * Fetch rendered HTML from Browserless.io /content endpoint.
 */
async function fetchRenderedHtml(
  url: string,
  token: string,
  options?: {
    isMobile?: boolean;
    width?: number;
    height?: number;
  },
): Promise<string | null> {
  const { isMobile = false, width = 1920, height = 1080 } = options || {};
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(
        `${BROWSERLESS_BASE}/content?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            bestAttempt: true,
            gotoOptions: {
              waitUntil: ["networkidle2"],
              timeout: TIMEOUT_MS,
            },
            viewport: {
              width: isMobile ? 375 : width,
              height: isMobile ? 812 : height,
              isMobile,
              hasTouch: isMobile,
              deviceScaleFactor: isMobile ? 2 : 1,
            },
            ...(isMobile
              ? {
                  userAgent: {
                    userAgent:
                      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                  },
                }
              : {}),
            rejectResourceTypes: ["image", "media", "font"],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS + 5000),
        },
      );

      if (res.status === 429 && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 3000; // 3s, 6s
        console.warn(`[headless-fetch] 429 rate limit for ${url}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        console.warn(`[headless-fetch] Browserless returned ${res.status} for ${url}`);
        return null;
      }

      const html = await res.text();
      return html || null;
    } catch (err) {
      console.warn(`[headless-fetch] Error fetching ${url}:`, (err as Error).message);
      return null;
    }
  }
  return null;
}

/**
 * Fetch both desktop and mobile rendered HTML for a URL.
 */
export async function fetchHeadlessPage(
  url: string,
  token: string,
): Promise<HeadlessResult> {
  // Fetch desktop and mobile in parallel
  const [desktopHtml, mobileHtml] = await Promise.all([
    fetchRenderedHtml(url, token, { isMobile: false }),
    fetchRenderedHtml(url, token, { isMobile: true }),
  ]);

  return {
    url,
    desktop_html: desktopHtml,
    mobile_html: mobileHtml,
    desktop_text_length: desktopHtml ? extractTextLength(desktopHtml) : 0,
    mobile_text_length: mobileHtml ? extractTextLength(mobileHtml) : 0,
    error: !desktopHtml && !mobileHtml ? "Both desktop and mobile renders failed" : null,
  };
}

/**
 * Fetch headless pages for a batch of URLs (top N pages).
 * Returns a map from URL to HeadlessResult.
 */
export async function fetchHeadlessBatch(
  urls: string[],
  token: string,
  maxConcurrent = 2,
): Promise<Map<string, HeadlessResult>> {
  const results = new Map<string, HeadlessResult>();

  // Process in chunks with delay between to avoid rate limits
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    if (i > 0) {
      // Wait 2s between chunks to avoid 429
      await new Promise(r => setTimeout(r, 2000));
    }
    const chunk = urls.slice(i, i + maxConcurrent);
    const chunkResults = await Promise.all(
      chunk.map((url) => fetchHeadlessPage(url, token)),
    );
    for (const r of chunkResults) {
      results.set(r.url, r);
    }
  }

  return results;
}

/**
 * Compare raw HTML text content vs rendered HTML text content.
 * Returns 0.0–1.0 ratio indicating how much content is server-rendered.
 */
export function computeSsrRatio(
  rawHtml: string,
  renderedHtml: string,
): number {
  const rawLen = extractTextLength(rawHtml);
  const renderedLen = extractTextLength(renderedHtml);

  if (renderedLen === 0) return 1.0; // Can't compare
  if (rawLen === 0) return 0.0; // No SSR content at all

  return Math.min(rawLen / renderedLen, 1.0);
}

/**
 * Compare desktop vs mobile text content for parity.
 * Returns 0.0–1.0 ratio indicating content parity.
 */
export function computeMobileParity(
  desktopTextLen: number,
  mobileTextLen: number,
): number {
  if (desktopTextLen === 0 && mobileTextLen === 0) return 1.0;
  if (desktopTextLen === 0) return 0.5;

  return Math.min(mobileTextLen / desktopTextLen, 1.0);
}
