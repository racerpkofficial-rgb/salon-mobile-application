import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand" onClick={closeMenu}>
          <img src="/assets/logo.png" alt="BookMy Salon Logo" className="brand-logo" />
          <div className="brand-text-wrap">
            <span className="brand-name">BookMy Salon</span>
            <span className="brand-tagline">Legal & Trust Desk</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="main-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Portal Home
          </NavLink>
          <NavLink
            to="/terms"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Terms & Conditions
          </NavLink>
          <NavLink
            to="/privacy"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Privacy Policy
          </NavLink>
          <a href="mailto:bookmysalonadmin@gmail.com" className="nav-btn">
            Contact Desk
          </a>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-menu-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={closeMenu}
        >
          Portal Home
        </NavLink>
        <NavLink
          to="/terms"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={closeMenu}
        >
          Terms & Conditions
        </NavLink>
        <NavLink
          to="/privacy"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={closeMenu}
        >
          Privacy Policy
        </NavLink>
        <a
          href="mailto:bookmysalonadmin@gmail.com"
          className="nav-btn"
          style={{ textAlign: 'center', marginTop: '0.5rem' }}
          onClick={closeMenu}
        >
          Email Administrative Desk
        </a>
      </div>
    </header>
  );
}
