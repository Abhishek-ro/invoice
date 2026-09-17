import React from 'react';
import { Link } from 'react-router-dom';

const COLUMNS = [
  { title: 'Product', links: ['Features', 'How it Works', 'Pricing', 'Changelog'] },
  { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
  { title: 'Resources', links: ['Docs', 'API Reference', 'Help Center', 'Status'] },
  { title: 'Legal', links: ['Privacy', 'Terms', 'Security'] },
];

export default function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__top">
          <div>
            <Link to="/" className="lp-logo">
              <span className="lp-logo__mark">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="lp-logo__word">ReconAI</span>
            </Link>
            <p className="lp-footer__blurb">AI-powered invoice reconciliation for modern AP teams.</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="lp-footer__col-title">{col.title}</h4>
              <ul className="lp-footer__links">
                {col.links.map((label) => (
                  <li key={label}><a href="#">{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lp-footer__bottom">
          &copy; {new Date().getFullYear()} ReconAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
