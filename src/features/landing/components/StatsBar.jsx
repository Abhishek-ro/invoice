import React from 'react';

// Target KPIs, taken verbatim from the "Target KPIs" table in the platform
// vision doc. These are targets the platform is being built against — not
// measured production results — which is what the footnote says.
//
// One thing to settle before this goes anywhere public: the doc quotes 85%
// touchless in the KPI table and 90% in the 4-way matching section. The table
// is the one used here.
const KPIS = [
  { label: 'Invoice processing time', from: '20 min', to: 'Under 2 min' },
  { label: 'Touchless processing', from: '20%', to: '85%' },
  { label: 'Invoice accuracy', from: '85%', to: '98%' },
  { label: 'Duplicate payment detection', from: '40%', to: '95%' },
  { label: 'Cost per invoice', from: '$8–$15', to: '$1–$3' },
  { label: 'Payment cycle time', from: '10–15 days', to: '1–2 days' },
];

export default function StatsBar() {
  return (
    <section className="lp-section lp-section--tint" id="results">
      <div className="lp-container">
        <div className="lp-section-header">
          <span className="lp-eyebrow">Target Outcomes</span>
          <h2 className="lp-section-title">What changes once it's running</h2>
          <p className="lp-section-sub">
            Where a manual AP process sits today, and where this platform is built to take it.
          </p>
        </div>

        <div className="lp-kpi-grid">
          {KPIS.map((kpi) => (
            <div className="lp-kpi" key={kpi.label}>
              <div className="lp-kpi__label">{kpi.label}</div>
              <div className="lp-kpi__row">
                <span className="lp-kpi__from">{kpi.from}</span>
                <span className="lp-kpi__arrow" aria-hidden="true">→</span>
                <span className="lp-kpi__to">{kpi.to}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="lp-kpi__footnote">
          Target KPIs from the platform vision document. These are design targets, not
          measured production results.
        </p>
      </div>
    </section>
  );
}
