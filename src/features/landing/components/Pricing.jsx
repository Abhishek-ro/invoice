import React from 'react';
import { Link } from 'react-router-dom';
import { IconArrowRight } from './Icons';

// Placeholder band — there's no pricing model defined yet, so this asks for a
// conversation instead of inventing tiers and numbers. Swap in real plans when
// they exist; the band is sized to take a 3-card tier row underneath.
export default function Pricing() {
  return (
    <section className="lp-section--tight" id="pricing">
      <div className="lp-container">
        <div className="lp-pricing">
          <div className="lp-pricing__text">
            <span className="lp-eyebrow">Pricing</span>
            <h2 className="lp-pricing__title">Priced around your invoice volume</h2>
            <p className="lp-pricing__sub">
              Start with the volume you process today and scale from there.
            </p>
          </div>
          <Link to="/invoice-reconciliation/new" className="lp-btn lp-btn--primary lp-btn--lg">
            Request pricing
            <IconArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
