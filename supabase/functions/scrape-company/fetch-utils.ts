/**
 * Shared HTTP fetch utilities for crawling.
 * Used by scrape-company and crawl-pages edge functions.
 */

const SCRAPE_TIMEOUT_MS = 8000;
export const MAX_PAGES_TO_SCRAPE = 30;

export async function fetchSafe(
  url: string,
  timeoutMs = SCRAPE_TIMEOUT_MS,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AinalyticsBot/1.0 (+https://ainalytics.tech/bot)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch a URL and track the full redirect chain.
 * Returns the final response + array of intermediate URLs.
 */
export async function fetchWithRedirectChain(
  url: string,
  timeoutMs = SCRAPE_TIMEOUT_MS,
): Promise<{ response: Response | null; redirect_chain: string[] }> {
  const chain: string[] = [url];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let currentUrl = url;
    let maxRedirects = 10;
    let finalResponse: Response | null = null;
    while (maxRedirects-- > 0) {
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "AinalyticsBot/1.0 (+https://ainalytics.tech/bot)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          currentUrl = new URL(location, currentUrl).href;
          chain.push(currentUrl);
          continue;
        }
      }
      finalResponse = res;
      break;
    }
    return { response: finalResponse, redirect_chain: chain };
  } catch {
    return { response: null, redirect_chain: chain };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract internal links from HTML content for page discovery.
 * Filters to same-domain, deduplicates, and excludes non-content URLs.
 */
export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const domain = new URL(baseUrl).hostname;
  const links = new Set<string>();
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href;
      const linkDomain = new URL(resolved).hostname;
      if (linkDomain !== domain) continue;
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|mp4|mp3|css|js|ico|woff|woff2|ttf|eot)$/i.test(resolved)) continue;
      if (resolved.includes("#")) continue;
      const clean = resolved.split("?")[0].replace(/\/$/, "");
      links.add(clean);
    } catch { /* skip malformed URLs */ }
  }
  return Array.from(links);
}

/**
 * Extract all links from HTML, separated into internal and external.
 */
export function extractAllLinks(html: string, baseUrl: string): { internal: string[]; external: string[] } {
  const domain = new URL(baseUrl).hostname;
  const internal = new Set<string>();
  const external = new Set<string>();
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href;
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|mp4|mp3|css|js|ico|woff|woff2|ttf|eot)$/i.test(resolved)) continue;
      const clean = resolved.split("#")[0].split("?")[0].replace(/\/$/, "");
      const linkDomain = new URL(resolved).hostname;
      if (linkDomain === domain) {
        internal.add(clean);
      } else {
        external.add(clean);
      }
    } catch { /* skip */ }
  }
  return { internal: Array.from(internal), external: Array.from(external) };
}

/**
 * Select a diverse set of pages from a URL list by grouping URLs by their
 * first path segment (e.g., /blog/*, /docs/*, /pricing) and round-robining
 * across groups. This ensures broad site coverage instead of over-sampling
 * a single section.
 */
export function selectDiversePages(urls: string[], max: number): string[] {
  if (urls.length <= max) return urls;

  // Group URLs by first path segment
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    try {
      const path = new URL(url).pathname;
      const segments = path.split("/").filter(Boolean);
      const group = segments.length > 0 ? segments[0].toLowerCase() : "_root";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(url);
    } catch {
      const fallback = groups.get("_other") || [];
      fallback.push(url);
      groups.set("_other", fallback);
    }
  }

  // Round-robin pick across groups
  const result: string[] = [];
  const groupEntries = Array.from(groups.entries());
  const indices = new Map<string, number>();
  for (const [key] of groupEntries) indices.set(key, 0);

  let exhausted = 0;
  while (result.length < max && exhausted < groupEntries.length) {
    exhausted = 0;
    for (const [key, groupUrls] of groupEntries) {
      if (result.length >= max) break;
      const idx = indices.get(key)!;
      if (idx < groupUrls.length) {
        result.push(groupUrls[idx]);
        indices.set(key, idx + 1);
      } else {
        exhausted++;
      }
    }
  }

  return result;
}
