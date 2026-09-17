import React, { useEffect, useRef, useState } from 'react';
import { IconCheck, IconLayers } from './Icons';

// Straight from the vision doc — the documents matched at each depth, and the
// industries each depth is actually used in. Each tier carries how many
// documents it adds on top of the previous one (`newFrom`, an index into
// `docs`) so the card can call out what's new instead of repeating an
// identical checklist three times at growing lengths.
//
// These are three use-cases, not three plans — nobody "upgrades" from 3-way
// to 5-way, they use whichever matches the spend type. So no tier gets a
// "most popular" ribbon, an elevated position, or a singled-out border —
// that's pricing-table language and it doesn't apply here. All three sit on
// equal footing; only the accent color changes per card.
const DEPTHS = [
  {
    label: '3-Way',
    tag: 'Traditional',
    tone: 'neutral',
    docs: ['Purchase Order', 'Goods Receipt Note', 'Supplier Invoice'],
    newFrom: 0,
    industries: 'The baseline most AP tools stop at.',
  },
  {
    label: '4-Way',
    tag: 'Adds quality',
    tone: 'blue',
    docs: ['Purchase Order', 'Goods Receipt Note', 'Supplier Invoice', 'Inspection / Quality Acceptance'],
    newFrom: 3,
    industries: 'Manufacturing · Pharma · Automotive · Healthcare · Electronics',
  },
  {
    label: '5-Way',
    tag: 'Adds service delivery',
    tone: 'purple',
    docs: [
      'Purchase Order',
      'Goods Receipt Note',
      'Supplier Invoice',
      'Quality Inspection Certificate',
      'Service Entry Sheet / Contract Milestone',
    ],
    newFrom: 4,
    industries: 'EPC · Construction · Telecom · Capital Projects · Professional Services',
  },
];

export default function MatchDepth() {
  const gridRef = useRef(null);
  const [visible, setVisible] = useState(false);

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
    <section className="lp-section" id="matching">
      <div className="lp-container">
        <div className="lp-section-header">
          <span className="lp-eyebrow">Matching Depth</span>
          <h2 className="lp-section-title">Match on three documents, or on five</h2>
          <p className="lp-section-sub">
            Goods spend needs a quality check. Project and service spend needs proof the work
            actually happened. Both are handled the same way.
          </p>
        </div>

        <div className={`lp-match-grid${visible ? ' is-visible' : ''}`} ref={gridRef}>
          {DEPTHS.map((d, i) => (
            <div
              className={`lp-match-card lp-match-card--${d.tone}`}
              key={d.label}
              style={{ '--lp-card-delay': `${i * 110}ms` }}
            >
              <div className="lp-match-card__icon">
                <IconLayers size={19} />
              </div>

              <div className="lp-match-card__head">
                <span className="lp-match-card__label">{d.label}</span>
                <span className="lp-match-card__tag">{d.tag}</span>
              </div>

              <ul className="lp-match-card__list">
                {d.docs.map((doc, docIndex) => {
                  const isNew = docIndex >= d.newFrom;
                  return (
                    <li key={doc} className={isNew ? 'is-new' : ''}>
                      <IconCheck size={15} />
                      {doc}
                    </li>
                  );
                })}
              </ul>

              <div className="lp-match-card__stat">
                <strong>{d.docs.length}</strong> documents matched per invoice
              </div>

              <p className="lp-match-card__industries">{d.industries}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
