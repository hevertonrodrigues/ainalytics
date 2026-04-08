/**
 * Mirrors the SQL extract_base_domain() function to normalize domains.
 * Strips protocol, www., paths, ports and gets the registrable domain.
 *
 * Examples:
 *   "https://www.fazcapital.com.br/page" → "fazcapital.com.br"
 *   "www.example.co.uk"                 → "example.co.uk"
 *   "blog.example.com"                  → "example.com"
 *   "example.com"                       → "example.com"
 */
export function extractBaseDomain(input: string): string {
  let host = input.toLowerCase().trim();
  // Strip protocol
  host = host.replace(/^https?:\/\//, "");
  // Strip www.
  host = host.replace(/^www\./, "");
  // Strip path, port, query, fragment
  host = host.split(/[/:?#]/)[0] || host;

  const parts = host.split(".");
  const len = parts.length;
  if (len <= 2) return host;

  // Handle .co.uk, .com.br, etc.
  const sld = parts[len - 2];
  if (
    ["co", "com", "org", "net", "edu", "gov", "mil", "ac"].includes(sld || "")
  ) {
    if (len >= 3) {
      return parts.slice(len - 3).join(".");
    }
  }

  // Default to last two parts
  return parts.slice(len - 2).join(".");
}

/**
 * Find the index of a source matching the given tenant domain.
 * Tries exact base-domain match first, then endsWith fallback.
 */
export function findOwnDomainIndex(
  sources: Array<{ domain?: string }>,
  tenantDomain: string,
): number {
  const normalized = extractBaseDomain(tenantDomain);
  if (!normalized) return -1;

  // 1. Exact base-domain match
  let idx = sources.findIndex(
    (s) => extractBaseDomain(s.domain || "") === normalized,
  );
  if (idx >= 0) return idx;

  // 2. Fallback: endsWith to catch subdomains or slight mismatches
  idx = sources.findIndex((s) => {
    const d = (s.domain || "").toLowerCase();
    return d.endsWith(normalized) || normalized.endsWith(d);
  });

  return idx;
}
