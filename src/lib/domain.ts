import validTlds from './tlds.json';

const KNOWN_SLDS = new Set([
  'com', 'co', 'org', 'net', 'edu', 'gov', 'mil', 'ac', 'nom', 'ind', 'info', 'biz'
]);

/**
 * Extracts the root domain from a given URL or domain string, stripping any subdomains.
 * Respects ccTLD rules (e.g. .com.br, .co.uk).
 * Returns null if the domain is invalid or doesn't have a valid TLD.
 */
export function extractRootDomain(input: string): string | null {
  try {
    const urlString = input.startsWith('http') ? input : `https://${input}`;
    const url = new URL(urlString);
    let hostname = url.hostname.toLowerCase();
    
    if (hostname.endsWith('.')) {
      hostname = hostname.slice(0, -1);
    }
    
    const parts = hostname.split('.');
    if (parts.length < 2) return null;
    
    const tld = parts[parts.length - 1];
    
    // We already have TLD validation list.
    // We cast to string array to satisfy TS if validTlds is typed vaguely, 
    // but importing json usually gives string[].
    if (!tld || !(validTlds as string[]).includes(tld)) {
      return null;
    }
    
    // Heuristic for two-part TLDs (e.g. .com.br)
    let rootDomainParts = 2;
    if (parts.length > 2 && tld.length === 2) {
      const sld = parts[parts.length - 2];
      if (sld && KNOWN_SLDS.has(sld)) {
        rootDomainParts = 3;
      }
    }
    
    if (parts.length < rootDomainParts) return null;
    
    return parts.slice(-rootDomainParts).join('.');
  } catch {
    return null;
  }
}
