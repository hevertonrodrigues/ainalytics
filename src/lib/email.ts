/**
 * Flag to block free/personal email providers from signing up.
 * Set to `true` to enforce professional-email-only registration.
 * Set to `false` to allow any valid email to register.
 */
export const BLOCK_FREE_EMAILS = false;

/**
 * List of common free/personal email providers that are not considered "professional"
 */
const FREE_EMAIL_PROVIDERS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',

  // Yahoo
  'yahoo.com',
  'yahoo.com.br',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.es',
  'yahoo.de',
  'ymail.com',
  'rocketmail.com',

  // Microsoft
  'hotmail.com',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'msn.com',
  'passport.com',
  'hotmail.co.uk',
  'hotmail.fr',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // AOL
  'aol.com',
  'aim.com',

  // Proton
  'protonmail.com',
  'proton.me',
  'pm.me',

  // Zoho (public mail)
  'zoho.com',
  'zohomail.com',

  // Yandex
  'yandex.com',
  'yandex.ru',
  'yandex.ua',

  // GMX / Mail.com
  'gmx.com',
  'gmx.net',
  'mail.com',
  'email.com',

  // Fastmail
  'fastmail.com',
  'fastmail.fm',

  // Hushmail
  'hushmail.com',

  // Tutanota
  'tutanota.com',
  'tutanota.de',
  'tutamail.com',
  'tuta.io',

  // Mail.ru
  'mail.ru',
  'inbox.ru',
  'bk.ru',
  'list.ru',

  // QQ / Chinese
  'qq.com',
  'foxmail.com',
  '163.com',
  '126.com',
  'yeah.net',

  // Naver / Korea
  'naver.com',
  'daum.net',
  'hanmail.net',

  // India
  'rediffmail.com',

  // Latin America common
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'ig.com.br',

  // European ISP-based public
  'orange.fr',
  'wanadoo.fr',
  'laposte.net',
  'libero.it',
  'virgilio.it',
  'tiscali.it',
  'btinternet.com',
  'sky.com',

  // Privacy / Temporary / Alias services
  'duck.com',
  'duckduckgo.com',
  'simplelogin.com',
  'slmail.me',
  'anonaddy.com',
  'addy.io',
  'mailbox.org',

  // Temporary / disposable (high-risk)
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'throwawaymail.com',
  'sharklasers.com'
]);

/**
 * Validates if an email belongs to a professional domain (not a common free provider).
 * When BLOCK_FREE_EMAILS is false, any valid email format passes.
 */
export function isProfessionalEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  if (!BLOCK_FREE_EMAILS) return true;
  const parts = email.split('@');
  const domain = parts[parts.length - 1]?.toLowerCase();
  return !!domain && !FREE_EMAIL_PROVIDERS.has(domain);
}

/**
 * Checks if a domain belongs to a free/personal email provider
 */
export function isFreeEmailDomain(domain: string): boolean {
  if (!domain) return false;
  return FREE_EMAIL_PROVIDERS.has(domain.toLowerCase());
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
