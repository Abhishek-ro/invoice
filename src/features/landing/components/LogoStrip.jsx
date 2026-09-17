import React from 'react';

// Integration logos, not customer logos — we have no customers to name yet,
// and inventing some was off the table from the start. These are the systems
// the vision doc lists under the Enterprise Data Integration Layer, so the
// claim is real: this is where POs, GRNs, service entry sheets and contracts
// get pulled from.
//
// NOTE before dropping real marks in: SAP, Oracle, Coupa etc. are third-party
// trademarks. Use their official partner/brand assets and check you're
// entitled to display them, or keep these as plain text labels.
const SYSTEMS = [
  'SAP S/4HANA',
  'Oracle ERP',
  'Coupa',
  'Ariba',
  'NetSuite',
  'ServiceNow',
];

export default function LogoStrip() {
  return (
    <section className="lp-logos-section">
      <div className="lp-container">
        <p className="lp-logos__caption">
          Pulls POs, GRNs, service entry sheets, and contracts from the systems you already run
        </p>
        <div className="lp-logos">
          {SYSTEMS.map((name) => (
            <div className="lp-logo-slot" key={name}>
              {/* Logo slot — swap the span for an <img> when you have the asset. */}
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
