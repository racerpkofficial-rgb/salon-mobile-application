import React from 'react';
import { Link } from 'react-router-dom';

export function LegalPortalHub() {
  return (
    <>
      {/* Hero Header */}
      <section className="hero-banner">
        <div className="hero-inner">
          <span className="badge-tag">Official Governance & Transparency</span>
          <h1 className="hero-title">BookMy Salon Legal Portal</h1>
          <p className="hero-subtitle">
            Review our binding platform terms, client safeguards, salon partner commitments, and privacy policies.
          </p>
          <div className="meta-info">
            <div className="meta-item">
              <span>Platform:</span> <strong>BookMy Salon Mobile & Web</strong>
            </div>
            <div className="meta-item">
              <span>Effective Date:</span> <strong>October 2026</strong>
            </div>
            <div className="meta-item">
              <span>Official Desk:</span> <strong>bookmysalonadmin@gmail.com</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Main Legal Portal Body */}
      <main className="main-wrapper">
        <div className="cards-grid">
          {/* Terms Card */}
          <article className="hub-card">
            <div className="hub-card-icon">📜</div>
            <h2 className="hub-card-title">Terms & Conditions</h2>
            <p className="hub-card-desc">
              Governs customer account eligibility, booking lifecycle, cancellation rules, salon partner responsibilities, and subscription plans (Starter ₹299, Business ₹599, Premium ₹999).
            </p>
            <Link to="/terms" className="hub-card-link">
              Read Terms & Conditions <span>→</span>
            </Link>
          </article>

          {/* Privacy Card */}
          <article className="hub-card">
            <div className="hub-card-icon">🛡️</div>
            <h2 className="hub-card-title">Privacy Policy</h2>
            <p className="hub-card-desc">
              Details what data is collected (emails, phone numbers, avatars, bookings, and location), how it is processed, service integrations (Razorpay, Cloudinary, FCM, SMTP), and self-service account deletion.
            </p>
            <Link to="/privacy" className="hub-card-link">
              Read Privacy Policy <span>→</span>
            </Link>
          </article>
        </div>

        {/* Platform Commitments */}
        <section className="features-box">
          <h2 className="features-title">Core Safety & Trust Principles</h2>
          <div className="features-grid">
            <div className="feature-item">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔒</div>
              <h3 className="feature-item-title">Zero Data Selling</h3>
              <p className="feature-item-desc">
                We never rent, sell, or monetize user contact records, phone numbers, or appointment logs to third-party ad networks.
              </p>
            </div>
            <div className="feature-item">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✨</div>
              <h3 className="feature-item-title">Verified Salon Hosts</h3>
              <p className="feature-item-desc">
                Newly registered salons undergo identity document review (GST, PAN, Trade License) before approval to ensure genuine services.
              </p>
            </div>
            <div className="feature-item">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>💳</div>
              <h3 className="feature-item-title">PCI-DSS Payments</h3>
              <p className="feature-item-desc">
                Salon partner billing is routed securely through Razorpay. Sensitive card and bank credentials are never stored on our servers.
              </p>
            </div>
            <div className="feature-item">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>👤</div>
              <h3 className="feature-item-title">Self-Service Account Deletion</h3>
              <p className="feature-item-desc">
                Both customers and salon owners can permanently request deletion of their accounts and authentication sessions directly in-app.
              </p>
            </div>
          </div>
        </section>

        {/* Support Notice */}
        <div className="callout-box" style={{ textAlign: 'center', maxWidth: 720, margin: '3rem auto 0' }}>
          <h3 className="callout-title" style={{ justifyContent: 'center' }}>Questions or Assistance?</h3>
          <p style={{ marginBottom: '1rem' }}>
            If you have questions regarding these terms, booking disputes, or data rights, please contact our administrative desk:
          </p>
          <a href="mailto:bookmysalonadmin@gmail.com" className="nav-btn" style={{ display: 'inline-block', margin: 0 }}>
            Email bookmysalonadmin@gmail.com
          </a>
        </div>
      </main>
    </>
  );
}
