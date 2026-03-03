/**
 * GEO Readiness & Status helpers — Single Source of Truth
 *
 * All readiness level data and factor status colors come from
 * shared/geo-config.json. This module re-exports them with
 * derived UI values (bg, border, glow) computed from the base colors.
 *
 * IMPORTANT: If you need to change readiness levels, thresholds,
 * or colors, edit ONLY shared/geo-config.json — both frontend
 * and backend read from that file.
 */

// ─── Inline config from shared/geo-config.json ─────────────
// We inline it here to avoid JSON import resolution issues.
// The canonical source is always shared/geo-config.json — keep in sync.

const READINESS_LEVELS_RAW = [
  { level: 0, label: "AI Invisible", threshold: 0, color: "#DC3545", description: "Fundamentally invisible to AI crawlers. Critical infrastructure failures." },
  { level: 1, label: "AI Hostile", threshold: 20, color: "#E67C00", description: "Severe deficiencies that actively prevent AI citation." },
  { level: 2, label: "AI Unaware", threshold: 40, color: "#FFC107", description: "Built without AI findability in mind. Rarely cited." },
  { level: 3, label: "AI Emerging", threshold: 60, color: "#8BC34A", description: "Foundational GEO elements in place but gaps remain." },
  { level: 4, label: "AI Optimized", threshold: 75, color: "#28A745", description: "Well-optimized for AI findability. Likely appearing in citations." },
  { level: 5, label: "AI Authority", threshold: 90, color: "#1B5E20", description: "Best-in-class GEO implementation. Dominates AI citations." },
] as const;

const FACTOR_STATUSES_RAW = {
  excellent: { min: 90, max: 100, color: "#00cec9" },
  good:      { min: 70, max: 89,  color: "#28A745" },
  warning:   { min: 40, max: 69,  color: "#FFC107" },
  critical:  { min: 0,  max: 39,  color: "#DC3545" },
} as const;

// ─── Types ──────────────────────────────────────────────────

export interface ReadinessLevelConfig {
  level: number;
  label: string;
  threshold: number;
  color: string;
  description: string;
}

export interface ReadinessUIConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

export interface StatusUIConfig {
  text: string;
  bg: string;
  border: string;
}

export type FactorStatusKey = 'excellent' | 'good' | 'warning' | 'critical';

// ─── Helpers ────────────────────────────────────────────────

/** Hex color to rgba */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Readiness levels ───────────────────────────────────────

export const READINESS_LEVELS: ReadinessLevelConfig[] = [...READINESS_LEVELS_RAW];

/** Readiness config with derived UI styling (bg, border, glow) */
export const READINESS_UI: Record<number, ReadinessUIConfig> = {};
for (const lvl of READINESS_LEVELS_RAW) {
  READINESS_UI[lvl.level] = {
    label: lvl.label,
    color: lvl.color,
    bg: hexToRgba(lvl.color, 0.08),
    border: hexToRgba(lvl.color, 0.25),
    glow: `0 0 20px ${hexToRgba(lvl.color, 0.15)}`,
  };
}

// ─── Factor status colors ───────────────────────────────────

export const STATUS_COLORS: Record<FactorStatusKey, StatusUIConfig> = {
  excellent: {
    text: FACTOR_STATUSES_RAW.excellent.color,
    bg: hexToRgba(FACTOR_STATUSES_RAW.excellent.color, 0.08),
    border: hexToRgba(FACTOR_STATUSES_RAW.excellent.color, 0.20),
  },
  good: {
    text: FACTOR_STATUSES_RAW.good.color,
    bg: hexToRgba(FACTOR_STATUSES_RAW.good.color, 0.08),
    border: hexToRgba(FACTOR_STATUSES_RAW.good.color, 0.20),
  },
  warning: {
    text: FACTOR_STATUSES_RAW.warning.color,
    bg: hexToRgba(FACTOR_STATUSES_RAW.warning.color, 0.08),
    border: hexToRgba(FACTOR_STATUSES_RAW.warning.color, 0.20),
  },
  critical: {
    text: FACTOR_STATUSES_RAW.critical.color,
    bg: hexToRgba(FACTOR_STATUSES_RAW.critical.color, 0.08),
    border: hexToRgba(FACTOR_STATUSES_RAW.critical.color, 0.20),
  },
};
