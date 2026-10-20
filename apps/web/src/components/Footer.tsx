import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-brand-header">
              <img src="/assets/logo.png" alt="BookMy Salon Logo" className="footer-logo" />
              <span className="footer-brand-name">BookMy Salon</span>
            </div>
            <p className="footer-desc">
              The premier beauty & wellness appointment booking and salon discovery platform. Connecting clients with verified salon ateliers.
            </p>
          </div>
          <div>
            <h4 className="footer-col-title">Legal Documentation</h4>
            <ul className="footer-links">
              <li><Link to="/terms">Terms & Conditions</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/">Legal Portal Home</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Contact & Help</h4>
            <ul className="footer-links">
              <li><a href="mailto:bookmysalonadmin@gmail.com">Administrative Desk</a></li>
              <li><span style={{ color: '#948C83', fontSize: '0.88rem' }}>App Version: 1.0.0 (Production)</span></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 BookMy Salon. All rights reserved.</span>
          <span>Public Legal Documentation</span>
        </div>
      </div>
    </footer>
  );
}
