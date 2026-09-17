import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import LogoStrip from '../components/LogoStrip';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import MatchDepth from '../components/MatchDepth';
import AIEngine from '../components/AIEngine';
import StatsBar from '../components/StatsBar';
import Pricing from '../components/Pricing';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';
import '../styles/landing.css';

// Background rhythm down the page, so it reads as bands rather than one flat
// scroll: tint (hero) → white (logos, features) → gray (how it works) →
// white (matching) → dark (engines) → tint (outcomes) → white (pricing, CTA).
//
// Every image on the page goes through <ImageSlot>; searching for it finds
// all the slots waiting on real assets.

export default function LandingPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'ReconAI — Invoice Reconciliation, Automated';
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="lp-page">
      <Navbar />
      <Hero />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <MatchDepth />
      <AIEngine />
      <StatsBar />
      <Pricing />
      <CTASection />
      <Footer />
    </div>
  );
}
