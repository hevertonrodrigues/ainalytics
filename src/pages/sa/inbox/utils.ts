import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { OUR_EMAIL } from './types';
import type { Email } from './types';

const AVATAR_COLORS = [
  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'bg-rose-500/15 text-rose-400 border-rose-500/25',
  'bg-sky-500/15 text-sky-400 border-sky-500/25',
  'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'bg-pink-500/15 text-pink-400 border-pink-500/25',
  'bg-teal-500/15 text-teal-400 border-teal-500/25',
  'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarColor(email: string): string {
  if (email === OUR_EMAIL) return 'bg-brand-primary/15 text-brand-primary border-brand-primary/30';
  return AVATAR_COLORS[hashString(email.toLowerCase()) % AVATAR_COLORS.length]!;
}

export function initials(name: string | null, email: string): string {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function previewText(e: Email): string {
  if (!e.body_text) return '';
  return e.body_text.slice(0, 160).replace(/\s+/g, ' ').trim();
}

export function isOutgoing(email: Email): boolean {
  return email.from_email === OUR_EMAIL;
}

/**
 * Gmail-style smart date:
 *   today     → HH:mm
 *   yesterday → "Yesterday"
 *   this week → weekday
 *   this year → Mon DD
 *   else      → Mon DD, YYYY
 */
export function useSmartDate() {
  const { t } = useTranslation();
  return useCallback((iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOf(now) - startOf(d)) / 86_400_000);

    if (dayDiff === 0) return formatDateTime(d, { hour: '2-digit', minute: '2-digit' });
    if (dayDiff === 1) return t('sa.inbox.yesterday');
    if (dayDiff < 7) return formatDate(d, { weekday: 'short' });
    if (d.getFullYear() === now.getFullYear()) return formatDate(d, 'shortDate');
    return formatDate(d, 'shortDateYear');
  }, [t]);
}
