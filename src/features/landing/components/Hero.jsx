import React from 'react';
import { Link } from 'react-router-dom';
import { IconArrowRight } from './Icons';
import ImageSlot from './ImageSlot';
import heroImg from '../../../Firefly_RemoveBackground.png';
import decorTeal from '../../../hero-icons/teal.png';
import decorPurple from '../../../hero-icons/purple.png';
import decorBlue from '../../../hero-icons/blue.png';
import decorPink from '../../../hero-icons/pink.png';
import decorOrange from '../../../hero-icons/orange.png';

// Each floating card, cut from the source sheet, placed individually so it
// sits fully outside the photo instead of one big image getting hidden
// behind it. pos is a corner position on .lp-hero__visual; rotate matches
// the card's tilt in the source art.
const DECOR = [
  { src: decorTeal, className: 'lp-hero__decor--tl' },
  { src: decorPurple, className: 'lp-hero__decor--tr' },
  { src: decorBlue, className: 'lp-hero__decor--r' },
  { src: decorPink, className: 'lp-hero__decor--l' },
  { src: decorOrange, className: 'lp-hero__decor--br' },
];

// Headline — pick one, swap the string. Multi-line bold style (like the
// Concur reference) instead of the shorter original:
//   "Invoice reconciliation software for finance teams in India"
//   "Invoice reconciliation that runs itself"
//   "Stop matching invoices by hand"
const HEADLINE = 'Invoice reconciliation software for finance teams in India';

// The two match depths, as the product's headline capability — same idea as
// the reference's pair of pillar cards under the subheadline.
const PILLARS = [
  {
    tone: 'blue',
    title: '4-Way Matching',
    desc: 'PO, GRN, invoice, and quality inspection checked in a single pass.',
  },
  {
    tone: 'purple',
    title: '5-Way Matching',
    desc: 'Adds service entry sheets and contract milestones for project spend.',
  },
];

export default function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-container">
        <div className="lp-hero__grid">
          <div className="lp-hero__text">
            <span className="lp-hero__eyebrow">AI-Powered AP Automation</span>
            <h1 className="lp-hero__title">{HEADLINE}</h1>
            <p className="lp-hero__sub">
              AI matches invoices against POs, receipts, and contracts automatically —
              so your AP team stops chasing mismatches and starts approving.
            </p>
            <div className="lp-hero__ctas">
              <Link to="/invoice-reconciliation/new" className="lp-btn lp-btn--primary lp-btn--lg">
                Start Free Trial
              </Link>
              <a href="#" className="lp-hero__link-cta">
                Watch Demo
                <IconArrowRight size={16} />
              </a>
            </div>
            <p className="lp-hero__note">No credit card required · Set up in minutes</p>

            <div className="lp-hero__pillars">
              {PILLARS.map((p) => (
                <div className={`lp-pillar lp-pillar--${p.tone}`} key={p.title}>
                  <div className="lp-pillar__head">
                    {p.title}
                    <IconArrowRight size={15} />
                  </div>
                  <p className="lp-pillar__desc">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-hero__visual">
            {/* Drop the real hero visual in by passing src — nothing else
                about this layout changes. */}
            <ImageSlot src={heroImg} alt="" label="Hero visual" ratio="3 / 4" radius={20} className="lp-hero__shot" />
            {/* Floating icon cards, positioned around the photo's edges
                rather than behind its center. */}
            {DECOR.map((d) => (
              <img key={d.className} src={d.src} alt="" aria-hidden="true" className={`lp-hero__decor ${d.className}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
