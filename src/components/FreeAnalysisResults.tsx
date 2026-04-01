import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

/* ── Types (matches free-analyze response) ── */

interface FactorScore {
  factor_id: string;
  name: string;
  category: string;
  score: number;
  weight: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  details: string;
  recommendations: string[];
}

interface TopRecommendation {
  priority: number;
  factor_id: string;
  factor_name: string;
  current_score: number;
  estimated_score_after_fix: number;
  potential_composite_gain: number;
  recommendation: string;
}

export interface FreeAnalysisData {
  domain: string;
  website_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  robots_txt: boolean;
  sitemap_xml: boolean;
  llms_txt: boolean;
  geo_score: number;
  readiness_level: number;
  readiness_label: string;
  category_scores: Record<string, number>;
  points_to_next_level: number;
  next_level: { level: number; label: string; threshold: number } | null;
  factor_scores: FactorScore[];
  top_recommendations: TopRecommendation[];
}

/* ── Readiness badge config ── */

const READINESS_BADGES: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Invisível para IA', color: 'text-error', bg: 'bg-error/10' },
  1: { label: 'Iniciante', color: 'text-error', bg: 'bg-error/10' },
  2: { label: 'Emergente', color: 'text-warning', bg: 'bg-warning/10' },
  3: { label: 'Em Desenvolvimento', color: 'text-warning', bg: 'bg-warning/10' },
  4: { label: 'Avançado', color: 'text-success', bg: 'bg-success/10' },
  5: { label: 'Autoridade em IA', color: 'text-success', bg: 'bg-success/10' },
};

const CATEGORY_COLORS: Record<string, string> = {
  technical: '#6c5ce7',
  content: '#fd79a8',
  authority: '#00b894',
  semantic: '#fdcb6e',
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Técnica',
  content: 'Conteúdo',
  authority: 'Autoridade',
  semantic: 'Semântica',
};

/* ── Score ring ── */

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 70 ? 'var(--color-success)' :
    score >= 40 ? 'var(--color-warning)' :
    'var(--color-error)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--color-glass-border)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: 'center',
          fontSize: `${size * 0.3}px`,
          fontWeight: 900,
          fontFamily: 'var(--font-display)',
          fill: 'var(--color-text-primary)',
        }}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

/* ── Category bar ── */

function CategoryBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div
        style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div
        style={{
          flex: 2, height: 8, borderRadius: 4,
          background: 'var(--color-bg-primary)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(score, 100)}%`,
            height: '100%', borderRadius: 4,
            background: color,
            transition: 'width 1.2s ease-out',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '0.875rem', fontWeight: 700,
          color: 'var(--color-text-primary)', width: 32, textAlign: 'right',
          fontFamily: 'var(--font-display)',
        }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

/* ── Status badge ── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    excellent: { label: '✅ Excelente', cls: 'text-success' },
    good: { label: '✅ Bom', cls: 'text-success' },
    warning: { label: '⚠️ Atenção', cls: 'text-warning' },
    critical: { label: '🔴 Crítico', cls: 'text-error' },
  };
  const badge = map[status] || map.warning!;
  return (
    <span className={badge.cls} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
      {badge.label}
    </span>
  );
}

/* ── Main Component ── */

interface FreeAnalysisResultsProps {
  data: FreeAnalysisData;
  onRestart: () => void;
}

export function FreeAnalysisResults({ data, onRestart }: FreeAnalysisResultsProps) {
  const { t } = useTranslation();

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${data.domain}&sz=64`;
  const badge = READINESS_BADGES[data.readiness_level] ?? READINESS_BADGES[0]!;

  return (
    <div className="sales-page" style={{ minHeight: '100vh' }}>
      {/* Urgency bar */}
      <div className="sales-urgency-bar">
        <TrendingUp className="w-4 h-4" />
        <span>{t('freeAnalysis.urgencyBar')}</span>
      </div>

      <div className="sales-container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>

        {/* ══════════════ HERO CARD ══════════════ */}
        <div
          className="glass-card animate-in fade-in slide-in-from-bottom-3 duration-500"
          style={{ padding: '2.5rem', marginBottom: '2rem', textAlign: 'center' }}
        >
          {/* Domain info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--color-bg-secondary)', border: '2px solid var(--color-glass-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src={faviconUrl}
                alt={data.domain}
                style={{ width: 28, height: 28, objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0, color: 'var(--color-text-primary)' }}>
                {data.website_title || data.domain}
              </h1>
              <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--color-text-muted)' }}>
                {data.domain}
              </p>
            </div>
          </div>

          {/* Score ring + readiness */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <ScoreRing score={data.geo_score} size={140} />
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                GEO Score
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.color} ${badge.bg}`} style={{ marginTop: '0.5rem' }}>
                <Sparkles className="w-3 h-3" />
                {data.readiness_label || badge.label} (Nível {data.readiness_level})
              </span>
            </div>
          </div>

          {data.next_level && data.points_to_next_level > 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Faltam <strong>{Math.round(data.points_to_next_level)}</strong> pontos para alcançar o nível <em>{data.next_level.label}</em>
            </p>
          )}
        </div>

        {/* ══════════════ QUICK CHECKS + CATEGORIES ══════════════ */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}
          className="animate-in fade-in slide-in-from-bottom-3 duration-500"
        >
          {/* Quick Checks */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Verificações Rápidas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'robots.txt', has: data.robots_txt },
                { label: 'sitemap.xml', has: data.sitemap_xml },
                { label: 'llms.txt', has: data.llms_txt },
              ].map(({ label, has }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-xs)',
                    background: 'var(--color-bg-primary)',
                  }}
                >
                  {has ? (
                    <CheckCircle2 className="w-4 h-4 text-success" style={{ flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-warning" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, fontSize: '0.875rem', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                    {label}
                  </span>
                  <span
                    style={{ fontSize: '0.75rem', fontWeight: 600 }}
                    className={has ? 'text-success' : 'text-warning'}
                  >
                    {has ? t('common.found', 'Encontrado') : t('common.missing', 'Ausente')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Análise por Categoria
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {Object.entries(data.category_scores).map(([cat, score]) => (
                <CategoryBar
                  key={cat}
                  label={CATEGORY_LABELS[cat] || cat}
                  score={score}
                  color={CATEGORY_COLORS[cat] || '#6c5ce7'}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════ TOP RECOMMENDATIONS ══════════════ */}
        {data.top_recommendations.length > 0 && (
          <div
            className="glass-card animate-in fade-in slide-in-from-bottom-3 duration-700"
            style={{ padding: '2rem', marginBottom: '2rem' }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              🎯 Recomendações Prioritárias
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.top_recommendations.map((rec) => (
                <div
                  key={rec.factor_id}
                  style={{
                    display: 'flex', gap: '1rem', padding: '1rem',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-glass-border)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-accent))',
                      color: 'white', fontSize: '0.75rem', fontWeight: 800,
                    }}
                  >
                    {rec.priority}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                        {rec.factor_name}
                      </span>
                      <StatusBadge status={rec.current_score >= 70 ? 'good' : rec.current_score >= 40 ? 'warning' : 'critical'} />
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {rec.recommendation}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0' }}>
                      Score atual: <strong>{Math.round(rec.current_score)}</strong> → Estimado após correção: <strong>{Math.round(rec.estimated_score_after_fix)}</strong>
                      {' '}(+{rec.potential_composite_gain.toFixed(1)} no score geral)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════ FACTOR SCORES OVERVIEW ══════════════ */}
        <div
          className="glass-card animate-in fade-in slide-in-from-bottom-3 duration-700"
          style={{ padding: '2rem', marginBottom: '2rem' }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
            📊 Visão Geral dos Fatores ({data.factor_scores.length})
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {data.factor_scores.map((f) => (
              <div
                key={f.factor_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius-xs)',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-glass-border)',
                }}
              >
                <span
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8125rem', fontWeight: 800, flexShrink: 0,
                    fontFamily: 'var(--font-display)',
                    background:
                      f.score >= 70 ? 'var(--color-success-bg, rgba(0,184,148,.1))' :
                      f.score >= 40 ? 'var(--color-warning-bg, rgba(253,203,110,.15))' :
                      'var(--color-error-bg, rgba(255,107,107,.1))',
                    color:
                      f.score >= 70 ? 'var(--color-success)' :
                      f.score >= 40 ? 'var(--color-warning)' :
                      'var(--color-error)',
                  }}
                >
                  {Math.round(f.score)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.name}
                  </p>
                  <p style={{ fontSize: '0.6875rem', margin: 0, color: 'var(--color-text-muted)' }}>
                    {f.category}
                  </p>
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════ CTA ══════════════ */}
        <div
          className="sales-final-cta animate-in fade-in slide-in-from-bottom-3 duration-700"
          style={{ marginTop: '2rem', borderRadius: 'var(--radius-lg)' }}
        >
          <div className="sales-container">
            <Shield className="w-10 h-10 text-brand-secondary" />
            <h2>Quer a análise completa com IA?</h2>
            <p>
              Desbloqueie todos os 25 fatores GEO detalhados, monitoramento contínuo de prompts em 5 plataformas de IA, e recomendações personalizadas geradas por inteligência artificial.
            </p>
            <RouterLink to="/signup" className="btn btn-primary btn-lg">
              Criar conta e fazer Deep Analyze
              <ArrowRight className="w-5 h-5" />
            </RouterLink>
            <span className="sales-final-note">{t('freeAnalysis.finalCtaNote')}</span>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={onRestart}
                className="btn btn-ghost"
                style={{ fontSize: '0.875rem' }}
              >
                ← Analisar outro site
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
