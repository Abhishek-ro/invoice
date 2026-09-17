import React, { useEffect, useRef, useState } from 'react';
import { IconInbox, IconSparkles, IconLayers, IconSend } from './Icons';

// Step copy follows the vision doc's ingestion → IDP → matching → approval
// flow. Titles unchanged — presentation got a pass: each step is a card
// with its own icon/accent color, the row animates in on scroll, and the
// gap between cards carries a small dot that relays across the row on a
// loop — a "data moving through the pipeline" cue instead of a static line.
const STEPS = [
  {
    num: '01',
    tone: 'blue',
    icon: IconInbox,
    title: 'Upload / Ingest',
    desc: 'Invoices arrive by email, EDI, supplier portal, shared drive, or API — all into one queue.',
  },
  {
    num: '02',
    tone: 'purple',
    icon: IconSparkles,
    title: 'AI Extract',
    desc: 'OCR and LLM extraction pull supplier, PO number, tax, and line items into structured data. No templates to configure.',
  },
  {
    num: '03',
    tone: 'amber',
    icon: IconLayers,
    title: 'Match & Verify',
    desc: 'Checked against PO, GRN, quality certificate, and service entry sheet, inside your price, quantity, tax, and date tolerances.',
  },
  {
    num: '04',
    tone: 'green',
    icon: IconSend,
    title: 'Approve & Post',
    desc: 'Clean matches go straight through. Everything else lands in the exceptions queue with a recommended action.',
  },
];

export default function HowItWorks() {
  const gridRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Reveal the row once, the first time it scrolls into view — not on
  // every re-render, and not re-triggered on scroll-back.
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
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="lp-section lp-section--alt" id="how-it-works">
      <div className="lp-container">
        <div className="lp-section-header">
          <span className="lp-eyebrow">How it Works</span>
          <h2 className="lp-section-title">From inbox to approved, automatically</h2>
          <p className="lp-section-sub">Four steps, most of them touchless.</p>
        </div>

        <div className={`lp-steps${visible ? ' is-visible' : ''}`} ref={gridRef}>
          {STEPS.map((step, i) => (
            <div
              className={`lp-step lp-step--${step.tone}`}
              key={step.num}
              style={{ '--lp-step-delay': `${i * 100}ms`, '--lp-flow-delay': `${i * 0.5}s` }}
            >
              {i < STEPS.length - 1 && (
                <span className="lp-step__connector" aria-hidden="true">
                  <span className="lp-step__connector-track" />
                  <span className="lp-step__connector-dot" />
                </span>
              )}
              <div className="lp-step__card">
                <div className="lp-step__top">
                  <div className="lp-step__icon">
                    <step.icon size={20} />
                  </div>
                  <span className="lp-step__badge">{step.num}</span>
                </div>
                <h3 className="lp-step__title">{step.title}</h3>
                <p className="lp-step__desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
