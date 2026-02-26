/**
 * List of common free/personal email providers that are not considered "professional"
 */
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.com.br',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'msn.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'gmx.com',
  'fastmail.com',
  'hushmail.com',
]);

/**
 * Validates if an email belongs to a professional domain (not a common free provider)
 */
export function isProfessionalEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const parts = email.split('@');
  const domain = parts[parts.length - 1]?.toLowerCase();
  return !!domain && !FREE_EMAIL_PROVIDERS.has(domain);
}

/**
 * Extracts the domain from an email address
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const parts = email.split('@');
  const domain = parts[parts.length - 1]?.toLowerCase();
  return domain || null;
}

/**
 * Suggests a company name based on the email domain
 * e.g., "google.com" -> "Google", "acme-corp.com" -> "Acme Corp"
 */
export function suggestCompanyNameFromDomain(domain: string): string {
  if (!domain) return '';
  const firstPart = domain.split('.')[0];
  if (!firstPart) return '';
  
  return firstPart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
