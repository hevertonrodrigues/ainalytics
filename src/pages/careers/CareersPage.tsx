import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, MapPin, FileText, ChevronRight, Building2, Sparkles } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/constants';
import { LandingHeader } from '@/pages/landing/LandingHeader';
import { LandingFooter } from '@/pages/landing/LandingFooter';

interface Opportunity {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  contract_type: string | null;
  compensation: string | null;
  published_at: string;
}

export function CareersPage() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-careers`, {
          headers: { apikey: SUPABASE_ANON_KEY },
        });
        const json = await res.json();
        if (json.success) setOpportunities(json.data);
      } catch {
        console.error('Failed to load opportunities');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="landing-page">
      <LandingHeader scrolled={scrolled} />

      <style>{`
        @keyframes careers-fade-up {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes careers-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.05); }
          50% { transform: translate(-10px, -40px) scale(1.1); }
          75% { transform: translate(-30px, -15px) scale(1.02); }
        }
        @keyframes careers-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(1.08); }
          66% { transform: translate(15px, -25px) scale(0.95); }
        }
        @keyframes careers-pulse {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.14; }
        }
        @keyframes careers-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .careers-hero {
          position: relative;
          padding-top: 8rem;
          padding-bottom: 4rem;
          min-height: 100vh;
          overflow: hidden;
        }
        .careers-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 0%, rgba(108,92,231,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 100%, rgba(253,121,168,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(0,206,201,0.04) 0%, transparent 60%);
          pointer-events: none;
        }
        .careers-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .careers-header {
          text-align: center;
          margin-bottom: 3.5rem;
          animation: careers-fade-up 0.5s ease both;
          position: relative;
          z-index: 1;
        }
        .careers-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 1rem;
          border-radius: 100px;
          background: linear-gradient(135deg, rgba(108,92,231,0.12), rgba(253,121,168,0.08));
          border: 1px solid rgba(108,92,231,0.2);
          color: var(--color-brand-secondary, #a29bfe);
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
          letter-spacing: 0.02em;
        }
        .careers-badge svg {
          width: 0.875rem;
          height: 0.875rem;
        }
        .careers-title {
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 800;
          font-family: var(--font-display);
          color: var(--color-text-primary);
          margin-bottom: 1rem;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }
        .careers-title-accent {
          background: linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-accent, #fd79a8));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .careers-subtitle {
          color: var(--color-text-secondary);
          font-size: 1.0625rem;
          max-width: 560px;
          margin: 0 auto;
          line-height: 1.7;
        }
        .careers-grid {
          display: grid;
          gap: 1.25rem;
          max-width: 800px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        .careers-card {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          padding: 1.75rem 2rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
          backdrop-filter: blur(16px);
          text-decoration: none;
          color: inherit;
          transition: all 0.25s ease;
          animation: careers-fade-up 0.5s ease both;
          cursor: pointer;
          display: block;
        }
        .careers-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-accent, #fd79a8), transparent);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .careers-card:hover {
          border-color: rgba(108,92,231,0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(108,92,231,0.12);
        }
        .careers-card:hover::before {
          opacity: 1;
        }
        .careers-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .careers-card-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          font-family: var(--font-display);
          line-height: 1.3;
        }
        .careers-card-arrow {
          min-width: 2rem;
          height: 2rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(108,92,231,0.1);
          color: var(--color-brand-primary);
          transition: all 0.2s ease;
        }
        .careers-card:hover .careers-card-arrow {
          background: var(--color-brand-primary);
          color: white;
          transform: translateX(2px);
        }
        .careers-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .careers-card-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.3rem 0.75rem;
          border-radius: 100px;
          background: var(--color-glass-hover, rgba(255,255,255,0.06));
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          transition: color 0.2s ease;
        }
        .careers-card-tag svg {
          width: 0.75rem;
          height: 0.75rem;
          color: var(--color-text-muted);
        }
        .careers-card:hover .careers-card-tag {
          color: var(--color-text-primary);
        }
        .careers-skeleton {
          border-radius: 16px;
          padding: 2rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
        }
        .careers-skeleton-line {
          height: 1rem;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--color-glass-bg), var(--color-glass-hover, rgba(255,255,255,0.06)), var(--color-glass-bg));
          background-size: 200% 100%;
          animation: careers-shimmer 1.5s ease infinite;
          margin-bottom: 0.75rem;
        }
        .careers-empty {
          text-align: center;
          padding: 4rem 2rem;
          color: var(--color-text-secondary);
          animation: careers-fade-up 0.5s ease both;
        }
        .careers-empty-icon {
          width: 3.5rem;
          height: 3.5rem;
          margin: 0 auto 1rem;
          color: var(--color-text-muted);
          opacity: 0.5;
        }
      `}</style>

      <section className="careers-hero">
        {/* Floating orbs */}
        <div
          className="careers-orb"
          style={{
            width: '320px', height: '320px',
            background: 'var(--color-brand-primary)',
            top: '3%', left: '-5%',
            opacity: 0.1,
            animation: 'careers-float-1 20s ease-in-out infinite',
          }}
        />
        <div
          className="careers-orb"
          style={{
            width: '220px', height: '220px',
            background: 'var(--color-brand-accent, #fd79a8)',
            bottom: '8%', right: '-3%',
            opacity: 0.08,
            animation: 'careers-float-2 16s ease-in-out infinite',
          }}
        />
        <div
          className="careers-orb"
          style={{
            width: '160px', height: '160px',
            background: '#00cec9',
            top: '55%', left: '50%',
            opacity: 0.05,
            animation: 'careers-pulse 8s ease-in-out infinite',
          }}
        />

        <div className="landing-container" style={{ position: 'relative', zIndex: 1, maxWidth: '960px' }}>
          {/* Header */}
          <div className="careers-header">
            <div className="careers-badge">
              <Sparkles />
              {t('careers.badge')}
            </div>
            <h1 className="careers-title">
              {t('careers.title.prefix')}{' '}
              <span className="careers-title-accent">{t('careers.title.accent')}</span>
            </h1>
            <p className="careers-subtitle">{t('careers.subtitle')}</p>
          </div>

          {/* Opportunities Grid */}
          <div className="careers-grid">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="careers-skeleton" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="careers-skeleton-line" style={{ width: '70%', height: '1.25rem' }} />
                  <div className="careers-skeleton-line" style={{ width: '90%' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="careers-skeleton-line" style={{ width: '80px', marginBottom: 0 }} />
                    <div className="careers-skeleton-line" style={{ width: '100px', marginBottom: 0 }} />
                    <div className="careers-skeleton-line" style={{ width: '60px', marginBottom: 0 }} />
                  </div>
                </div>
              ))
            ) : opportunities.length === 0 ? (
              <div className="careers-empty">
                <Briefcase className="careers-empty-icon" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                  {t('careers.empty.title')}
                </h3>
                <p style={{ fontSize: '0.875rem' }}>{t('careers.empty.description')}</p>
              </div>
            ) : (
              opportunities.map((opp, i) => (
                <Link
                  key={opp.id}
                  to={`/careers/${opp.slug}`}
                  className="careers-card"
                  style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                >
                  <div className="careers-card-top">
                    <h2 className="careers-card-title">{opp.title}</h2>
                    <div className="careers-card-arrow">
                      <ChevronRight style={{ width: '1rem', height: '1rem' }} />
                    </div>
                  </div>
                  <div className="careers-card-meta">
                    {opp.department && (
                      <span className="careers-card-tag">
                        <Building2 /> {opp.department}
                      </span>
                    )}
                    {opp.location && (
                      <span className="careers-card-tag">
                        <MapPin /> {opp.location}
                      </span>
                    )}
                    {opp.contract_type && (
                      <span className="careers-card-tag">
                        <FileText /> {opp.contract_type}
                      </span>
                    )}
                    {opp.compensation && (
                      <span className="careers-card-tag">
                        <Briefcase /> {opp.compensation}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
