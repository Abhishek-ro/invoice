import React from 'react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE GOES HERE.
// This is the only place the CTA photo is referenced. Import the asset and
// assign it — everything else (overlay, floating cards, text) sits on top
// and needs no change:
//
//   import ctaBg from '../assets/cta-background.jpg';
//   const CTA_BACKGROUND = ctaBg;            // or a URL string
//
// While it's null the band falls back to the dark placeholder colour set on
// .lp-cta in landing.css.
const CTA_BACKGROUND = null;
// ─────────────────────────────────────────────────────────────────────────

// Dummy figures — swap for real ones (or live data) whenever they exist.
const RING_ONE = { value: '$27,456', label: 'Processed', pct: 72 };
const RING_TWO = { value: '$91,250', label: 'Invoices', pct: 54 };
const SPARK = { value: '$4,104', label: 'Overall' };
const BADGE = { value: '90%', label: 'Touchless' };

function Ring({ pct, size = 58, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="lp-float__ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export default function CTASection() {
  return (
    <section className="lp-section--tight">
      <div className="lp-container">
        <div className="lp-cta">
          {CTA_BACKGROUND && (
            <img src={CTA_BACKGROUND} alt="" className="lp-cta__bg" aria-hidden="true" />
          )}
          {/* Darkening gradient — keeps the white text readable once a photo
              is behind it, and gives the placeholder some depth until then. */}
          <div className="lp-cta__overlay" aria-hidden="true" />

          <div className="lp-cta__floats" aria-hidden="true">
            <div className="lp-float lp-float--ring lp-float--tl">
              <Ring pct={RING_ONE.pct} />
              <div className="lp-float__text">
                <div className="lp-float__value">{RING_ONE.value}</div>
                <div className="lp-float__label">
                  <span className="lp-float__dot" />
                  {RING_ONE.label}
                </div>
              </div>
            </div>

            <div className="lp-float lp-float--spark lp-float--bl">
              <div className="lp-float__label">{SPARK.label}</div>
              <div className="lp-float__chart">
                <svg viewBox="0 0 132 44" preserveAspectRatio="none" className="lp-float__line">
                  <path
                    d="M2 34 C 16 34, 20 14, 34 15 S 54 33, 68 28 S 88 8, 104 12 S 122 26, 130 22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="104" cy="12" r="3.5" fill="currentColor" />
                </svg>
                <span className="lp-float__badge">{SPARK.value}</span>
              </div>
            </div>

            <div className="lp-float lp-float--ring lp-float--tr">
              <div className="lp-float__text lp-float__text--right">
                <div className="lp-float__value">{RING_TWO.value}</div>
                <div className="lp-float__label">
                  <span className="lp-float__dot" />
                  {RING_TWO.label}
                </div>
              </div>
              <Ring pct={RING_TWO.pct} />
            </div>

            <div className="lp-float lp-float--stat lp-float--br">
              <span className="lp-float__icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <div className="lp-float__value lp-float__value--sm">{BADGE.value}</div>
                <div className="lp-float__label">{BADGE.label}</div>
              </div>
            </div>
          </div>

          <div className="lp-cta__content">
            <h2 className="lp-cta__title">Ready to stop reconciling invoices by hand?</h2>
            <p className="lp-cta__sub">
              Book a walkthrough and see it run against your own invoices.
            </p>
            <Link to="/invoice-reconciliation/new" className="lp-btn lp-btn--on-accent lp-btn--lg">
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
