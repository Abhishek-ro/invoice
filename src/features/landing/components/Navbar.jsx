import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconMenu, IconClose } from './Icons';

// Anchors that actually go somewhere on this page. Docs has no section yet,
// so it stays non-functional (# placeholder) rather than pointing at
// something that doesn't exist.
const NAV_LINKS = [
  { label: 'Product', id: 'product' },
  { label: 'How it Works', id: 'how-it-works' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'Docs', href: '#' },
];

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLinkClick = (link) => {
    setMobileOpen(false);
    if (link.id) scrollToSection(link.id);
  };

  return (
    <header className={`lp-navbar${scrolled ? ' lp-navbar--scrolled' : ''}`}>
      <div className="lp-container">
        <div className="lp-navbar__inner">
          <Link to="/" className="lp-logo">
            <span className="lp-logo__mark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="lp-logo__word">ReconAI</span>
          </Link>

          <nav className="lp-navbar__links">
            {NAV_LINKS.map((link) =>
              link.id ? (
                <button key={link.label} className="lp-navbar__link" onClick={() => handleLinkClick(link)}>
                  {link.label}
                </button>
              ) : (
                <a key={link.label} href={link.href} className="lp-navbar__link">
                  {link.label}
                </a>
              )
            )}
          </nav>

          <div className="lp-navbar__actions">
            <Link to="/invoice-reconciliation" className="lp-navbar__login">Login</Link>
            <Link to="/invoice-reconciliation/new" className="lp-btn lp-btn--primary">Get Started</Link>
            <button
              className="lp-navbar__menu-btn"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lp-mobile-menu">
            {NAV_LINKS.map((link) =>
              link.id ? (
                <button key={link.label} className="lp-mobile-menu__link" onClick={() => handleLinkClick(link)}>
                  {link.label}
                </button>
              ) : (
                <a key={link.label} href={link.href} className="lp-mobile-menu__link" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </a>
              )
            )}
            <div className="lp-mobile-menu__divider" />
            <Link to="/invoice-reconciliation" className="lp-mobile-menu__link" onClick={() => setMobileOpen(false)}>Login</Link>
            <Link to="/invoice-reconciliation/new" className="lp-btn lp-btn--primary lp-btn--full" onClick={() => setMobileOpen(false)}>
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
