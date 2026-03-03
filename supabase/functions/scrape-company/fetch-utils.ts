/**
 * Shared HTTP fetch utilities for crawling.
 * Used by scrape-company and crawl-pages edge functions.
 */

const SCRAPE_TIMEOUT_MS = 8000;
export const MAX_PAGES_TO_SCRAPE = 100;

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
