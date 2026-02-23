import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

/* ─── Types ─── */

export interface PricingPlan {
  name: string;
  price: string;
  priceLabel?: string;
  description: string;
  cta: string;
  features: string[];
  popular?: string;
  /** When true, renders as a full-width block instead of a card */
  isBlock?: boolean;
  /** If provided, renders a button with onClick instead of a Link */
  onSelect?: () => void;
  /** If true, disables the CTA button */
  disabled?: boolean;
  /** Optional label to replace CTA text (e.g. "Current Plan") */
  statusLabel?: string;
  /** Whether the plan is currently being selected (shows loading) */
  loading?: boolean;
}

export interface PricingPlansProps {
  plans: PricingPlan[];
}

/* ─── Card (for first 3) ─── */

function PricingCard({
  name,
  price,
  priceLabel,
  description,
  cta,
  features,
  popular,
  onSelect,
  disabled,
  statusLabel,
  loading,
}: PricingPlan) {
  return (
    <div className={`landing-pricing-card glass-card${popular ? ' landing-pricing-popular' : ''}`}>
      {popular && <div className="landing-pricing-badge">{popular}</div>}
      <h3>{name}</h3>
      <div className="landing-pricing-price">
        <span className="landing-pricing-amount">{price}</span>
        {priceLabel && <span className="landing-pricing-period">{priceLabel}</span>}
      </div>
      <p className="landing-pricing-desc">{description}</p>

      {statusLabel ? (
        <button
          className="btn btn-success w-full"
          disabled
          style={{ opacity: 0.7, cursor: 'default' }}
        >
          <Check className="w-4 h-4" />
          {statusLabel}
        </button>
      ) : onSelect ? (
        <button
          onClick={onSelect}
          disabled={disabled || loading}
          className={`btn ${popular ? 'btn-primary' : 'btn-secondary'} w-full`}
          style={loading ? { opacity: 0.6 } : undefined}
        >
          {loading ? '...' : cta}
        </button>
      ) : (
        <Link to="/signup" className={`btn ${popular ? 'btn-primary' : 'btn-secondary'} w-full`}>
          {cta}
        </Link>
      )}

      <ul className="landing-pricing-features">
        {features.map((f, i) => (
          <li key={i}>
            <Check className="w-4 h-4 text-success" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Block (for 4th+) ─── */

function PricingBlock({
  name,
  price,
  priceLabel,
  description,
  cta,
  features,
  onSelect,
  disabled,
  statusLabel,
  loading,
}: PricingPlan) {
  return (
    <div className="glass-card landing-pricing-card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2rem' }}>
        {/* Left: name + price */}
        <div style={{ flex: '0 0 auto' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            {name}
          </h3>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {price}
            </span>
            {priceLabel && (
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                {priceLabel}
              </span>
            )}
          </div>
        </div>

        {/* Center: description or features */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          {description && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: features.length > 0 ? '0.5rem' : 0 }}>
              {description}
            </p>
          )}
          {features.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
              {features.map((f, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  <Check className="w-3.5 h-3.5 text-success" style={{ flexShrink: 0 }} />
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: CTA */}
        {statusLabel ? (
          <button
            className="btn btn-success"
            disabled
            style={{ opacity: 0.7, cursor: 'default', whiteSpace: 'nowrap' }}
          >
            <Check className="w-4 h-4" />
            {statusLabel}
          </button>
        ) : onSelect ? (
          <button
            onClick={onSelect}
            disabled={disabled || loading}
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', ...(loading ? { opacity: 0.6 } : {}) }}
          >
            {loading ? '...' : cta}
          </button>
        ) : (
          <Link to="/signup" className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            {cta}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function PricingPlans({ plans }: PricingPlansProps) {
  const cards = plans.filter((p) => !p.isBlock);
  const blocks = plans.filter((p) => p.isBlock);

  return (
    <>
      {/* First plans as cards in a grid */}
      {cards.length > 0 && (
        <div className="landing-pricing-grid">
          {cards.map((plan, i) => (
            <PricingCard key={i} {...plan} />
          ))}
        </div>
      )}

      {/* Remaining plans as full-width blocks */}
      {blocks.map((plan, i) => (
        <PricingBlock key={`block-${i}`} {...plan} />
      ))}
    </>
  );
}
