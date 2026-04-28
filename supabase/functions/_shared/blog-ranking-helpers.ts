/**
 * Shared helpers for the blog-ranking* endpoints.
 *
 * Computes the deltas, week label, and other derived fields described in
 * RANKINGS_REQUIREMENTS.md so the same logic stays consistent across endpoints.
 */
import type { Lang } from "./blog-langs.ts";

// ── Date / week ─────────────────────────────────────────────────────────────

/** ISO 8601 week number (1–53). Reference: ISO 8601, "first Thursday rule". */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Sun=0 → 7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Locale-aware week label following the format from RANKINGS_REQUIREMENTS.md §8:
 *   en: "Week 17 · April 21–27, 2026"
 *   pt: "Semana 17 · 21–27 de abril de 2026"
 *   es: "Semana 17 · 21–27 de abril de 2026"
 *
 * Falls back gracefully when `from` / `to` are nullish.
 */
export function buildWeekLabel(
  lang: Lang,
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): { weekNumber: number | null; weekLabel: string | null } {
  if (!fromIso || !toIso) return { weekNumber: null, weekLabel: null };
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to   = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { weekNumber: null, weekLabel: null };
  }
  const weekNumber = isoWeek(from);
  const monthName = MONTH_NAMES[lang][from.getUTCMonth()];
  const fromDay = from.getUTCDate();
  const toDay   = to.getUTCDate();
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  const year = to.getUTCFullYear();

  let label: string;
  switch (lang) {
    case "en":
      // "Week 17 · April 21–27, 2026" / "Week 17 · April 30 – May 6, 2026"
      label = sameMonth
        ? `Week ${weekNumber} · ${monthName} ${fromDay}–${toDay}, ${year}`
        : `Week ${weekNumber} · ${monthName} ${fromDay} – ${MONTH_NAMES.en[to.getUTCMonth()]} ${toDay}, ${year}`;
      break;
    case "pt":
      // "Semana 17 · 21–27 de abril de 2026"
      label = sameMonth
        ? `Semana ${weekNumber} · ${fromDay}–${toDay} de ${monthName} de ${year}`
        : `Semana ${weekNumber} · ${fromDay} de ${monthName} – ${toDay} de ${MONTH_NAMES.pt[to.getUTCMonth()]} de ${year}`;
      break;
    case "es":
      label = sameMonth
        ? `Semana ${weekNumber} · ${fromDay}–${toDay} de ${monthName} de ${year}`
        : `Semana ${weekNumber} · ${fromDay} de ${monthName} – ${toDay} de ${MONTH_NAMES.es[to.getUTCMonth()]} de ${year}`;
      break;
  }
  return { weekNumber, weekLabel: label };
}

const MONTH_NAMES: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
       "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio",
       "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};

// ── Delta formatting ────────────────────────────────────────────────────────

/** Format an absolute integer delta as "+3" / "-1" / "0". */
export function formatIntDelta(curr: number | null, prev: number | null): string | null {
  if (curr == null || prev == null) return null;
  const diff = curr - prev;
  if (diff === 0) return "0";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/** Format a percentage delta as "+8.4%" / "-1.2%" / "0%". 1-decimal precision. */
export function formatPctDelta(curr: number | null, prev: number | null): string | null {
  if (curr == null || prev == null || prev === 0) return null;
  const diff = ((curr - prev) / prev) * 100;
  if (diff === 0) return "0%";
  const formatted = diff.toFixed(1);
  return diff > 0 ? `+${formatted}%` : `${formatted}%`;
}
