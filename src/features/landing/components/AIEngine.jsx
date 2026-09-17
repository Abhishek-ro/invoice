import React from 'react';
import { IconSliders, IconCpu, IconSparkles } from './Icons';
import ImageSlot from './ImageSlot';

// The three engines behind the matching layer, as described in the vision
// doc's AI Matching Engine section. Each gets its own accent color, same
// palette as Features/MatchDepth above, so this section reads as part of
// the same (light) page instead of a fixed-dark band bolted onto it.
const ENGINES = [
  {
    tone: 'blue',
    icon: IconSliders,
    title: 'Rules Engine',
    desc: 'Price, quantity, tax, date, and currency tolerances — your thresholds, applied consistently on every invoice.',
  },
  {
    tone: 'purple',
    icon: IconCpu,
    title: 'Machine Learning',
    desc: 'Fuzzy matching, anomaly detection, duplicate detection, and confidence scoring, so exceptions are predicted rather than discovered.',
  },
  {
    tone: 'amber',
    icon: IconSparkles,
    title: 'Generative AI',
    desc: 'Reads contracts for rate cards, penalty clauses, and billing schedules, then recommends the resolution in plain language.',
  },
];

export default function AIEngine() {
  return (
    <section className="lp-section lp-section--deep">
      <div className="lp-container">
        <div className="lp-section-header">
          <span className="lp-eyebrow">Under the hood</span>
          <h2 className="lp-section-title">Three engines, one decision</h2>
          <p className="lp-section-sub">
            Rules catch what you can define. Models catch what you can't. GenAI explains the
            result and recommends what to do about it.
          </p>
        </div>

        <div className="lp-engines">
          {ENGINES.map(({ icon: Icon, title, desc, tone }) => (
            <div className={`lp-engine lp-engine--${tone}`} key={title}>
              <div className="lp-engine__icon">
                <Icon size={20} />
              </div>
              <h3 className="lp-engine__title">{title}</h3>
              <p className="lp-engine__desc">{desc}</p>
            </div>
          ))}
        </div>

        {/* Wide visual slot — matching engine / architecture diagram goes here. */}
        <ImageSlot label="Matching engine visual" ratio="21 / 9" radius={18} />
      </div>
    </section>
  );
}
