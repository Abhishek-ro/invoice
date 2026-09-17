import React, { useEffect, useRef, useState } from 'react';
import { IconZap, IconFileCheck, IconAlertTriangle, IconBarChart3 } from './Icons';
import ImageSlot from './ImageSlot';

// Copy tightened against the vision doc — the matching criteria, ingestion
// sources, exception types and the three dashboards all come from there.
// Card colours are unchanged; each card now reserves a screenshot slot that
// bleeds to its bottom edge, the way the reference cards do.
const FEATURES = [
  {
    icon: IconZap,
    title: 'AI-Powered Matching',
    desc: 'Fuzzy matching and confidence scoring across supplier, quantity, price, tax, and quality — with missing fields predicted, not chased.',
    color: 'blue',
    shot: 'Matching view',
  },
  {
    icon: IconFileCheck,
    title: 'Multi-Channel Ingestion',
    desc: 'Email, EDI, supplier portal, shared drive, or API. PDFs, scans, and images all land in one queue as structured data.',
    color: 'purple',
    shot: 'Ingestion queue',
  },
  {
    icon: IconAlertTriangle,
    title: 'Exception Management',
    desc: 'Quantity, price, and tax mismatches surface before payment, each with a recommended action — approve, route, request docs, or escalate.',
    color: 'amber',
    shot: 'Exceptions queue',
  },
  {
    icon: IconBarChart3,
    title: 'Real-Time Dashboards',
    desc: 'Separate CFO, procurement, and audit views: working capital and DPO, cycle time and exception trends, duplicate and fraud risk.',
    color: 'green',
    shot: 'Dashboard view',
  },
];

export default function Features() {
  const gridRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Same reveal-on-scroll as the How it Works row: fire once, the first
  // time the grid enters view, then leave it alone.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="lp-section" id="product">
      <div className="lp-container">
        <div className="lp-section-header">
          <span className="lp-eyebrow">Product</span>
          <h2 className="lp-section-title">Everything your AP team needs</h2>
          <p className="lp-section-sub">
            One queue, matched automatically, with a clear reason attached to every exception.
          </p>
        </div>

        <div className={`lp-features-grid${visible ? ' is-visible' : ''}`} ref={gridRef}>
          {FEATURES.map(({ icon: Icon, title, desc, color, shot }, i) => (
            <div
              className={`lp-feature-card lp-feature-card--${color}`}
              key={title}
              style={{ '--lp-card-delay': `${i * 100}ms` }}
            >
              <div className="lp-feature-card__body">
                <div className="lp-feature-card__icon">
                  <Icon size={22} />
                </div>
                <h3 className="lp-feature-card__title">{title}</h3>
                <p className="lp-feature-card__desc">{desc}</p>
              </div>
              <ImageSlot
                label={shot}
                ratio="16 / 10"
                radius="12px 12px 0 0"
                className="lp-feature-card__media"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
