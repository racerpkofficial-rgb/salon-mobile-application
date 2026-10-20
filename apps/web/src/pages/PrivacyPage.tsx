import React from 'react';
import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <>
      {/* Hero Header */}
      <section className="hero-banner">
        <div className="hero-inner">
          <span className="badge-tag">Data Protection & Privacy</span>
          <h1 className="hero-title">Privacy Policy</h1>
          <p className="hero-subtitle">
            Transparent disclosures on the personal information we collect, how it is processed, service integrations, and how you retain complete control over your data.
          </p>
          <div className="meta-info">
            <div className="meta-item">
              <span>Effective Date:</span> <strong>October 20, 2026</strong>
            </div>
            <div className="meta-item">
              <span>Version:</span> <strong>1.0 (Production Release)</strong>
            </div>
            <div className="meta-item">
              <span>Data Desk:</span> <strong>bookmysalonadmin@gmail.com</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Main Legal Article Layout */}
      <main className="main-wrapper">
        <div className="legal-layout">
          {/* Sticky Table of Contents */}
          <aside className="toc-sidebar">
            <div className="toc-title">Contents</div>
            <ul className="toc-list">
              <li className="toc-item"><a href="#overview">1. Overview & Commitment</a></li>
              <li className="toc-item"><a href="#data-collected">2. Information We Collect</a></li>
              <li className="toc-item"><a href="#how-we-use">3. How Information is Used</a></li>
              <li className="toc-item"><a href="#data-sharing">4. Sharing Between Parties</a></li>
              <li className="toc-item"><a href="#third-parties">5. Third-Party Integrations</a></li>
              <li className="toc-item"><a href="#retention-deletion">6. Retention & Deletion</a></li>
              <li className="toc-item"><a href="#security-safeguards">7. Security & Limitations</a></li>
              <li className="toc-item"><a href="#user-rights">8. Your Privacy Rights</a></li>
              <li className="toc-item"><a href="#children">9. Children's Privacy</a></li>
              <li className="toc-item"><a href="#policy-changes">10. Policy Changes</a></li>
              <li className="toc-item"><a href="#privacy-contact">11. Privacy Contact Desk</a></li>
            </ul>
          </aside>

          {/* Legal Article Content */}
          <article className="legal-article">
            {/* 1. Overview */}
            <section id="overview" className="legal-section">
              <span className="section-number">Section 01</span>
              <h2 className="section-title">Overview & Privacy Commitment</h2>
              <p className="legal-paragraph">
                At <strong>BookMy Salon</strong>, we respect and safeguard the personal privacy of both clients booking beauty and wellness treatments and salon partners operating professional ateliers.
              </p>
              <p className="legal-paragraph">
                This Privacy Policy describes in complete transparency the specific data points collected by our mobile and web applications, the legitimate operational purposes for which data is processed, the third-party infrastructure providers supporting our services, and the administrative controls available to you.
              </p>
              <div className="callout-box">
                <div className="callout-title">Zero Data Selling Commitment</div>
                <p>
                  BookMy Salon does not sell, rent, trade, or monetize your contact details, booking histories, or profile photographs to data brokers, ad networks, or telemarketers.
                </p>
              </div>
            </section>

            {/* 2. Information We Collect */}
            <section id="data-collected" className="legal-section">
              <span className="section-number">Section 02</span>
              <h2 className="section-title">Personal Information We Collect</h2>
              <p className="legal-paragraph">
                We collect only the information necessary to provide authentication, discovery, appointment booking, and communication:
              </p>

              <h3 className="subsection-title">A. Customer Account & Profile Information</h3>
              <ul className="legal-list">
                <li><strong>Identity & Contact:</strong> Full name, verified email address, mobile phone number, and residential city or address.</li>
                <li><strong>Authentication:</strong> Cryptographic password hash (computed via bcrypt; plaintext passwords are never stored or visible).</li>
                <li><strong>Profile Photo (Avatar):</strong> An optional personal profile photograph uploaded to facilitate identification by salon hosts.</li>
                <li><strong>Preferences:</strong> Proximity search radius (5 km, 10 km, or 25 km) and notification preference toggles (booking updates, reminders, promotions).</li>
              </ul>

              <h3 className="subsection-title">B. Salon Owner & Business Information</h3>
              <ul className="legal-list">
                <li><strong>Owner Identity:</strong> Proprietor full name, email address, phone number, and owner profile avatar.</li>
                <li><strong>Salon Establishment Details:</strong> Salon business name, description, address, city, state, country, working hours, and appointment slot duration intervals.</li>
                <li><strong>Business Verification Credentials:</strong> Official identity proof document (such as GST Registration Certificate, Trade License, Proprietor PAN Card, or Shop & Establishment certificate) uploaded during partner registration to verify legitimate business operations.</li>
                <li><strong>Catalog & Gallery:</strong> Service menu items (names, category, price, duration), promotional offers, and salon atelier interior/exterior photographs.</li>
                <li><strong>Subscription Records:</strong> Selected plan (Starter, Business, Premium), billing cycle (Monthly or Yearly), and Razorpay transaction IDs.</li>
              </ul>

              <h3 className="subsection-title">C. Booking & Appointment Records</h3>
              <ul className="legal-list">
                <li>Appointment scheduling details: appointment date, start time, end time, service selected, price, discounts applied, and custom notes provided by the client.</li>
                <li>Status history: records of confirmation, rejection (including owner notes), completion, and cancellation.</li>
                <li>Public reviews & ratings submitted by customers after completed appointments.</li>
              </ul>

              <h3 className="subsection-title">D. Technical & Device Information</h3>
              <ul className="legal-list">
                <li><strong>Location Data:</strong> Precise GPS coordinates (latitude and longitude) are accessed <em>only</em> when you explicitly grant foreground location permission on your device to calculate real-time distance to nearby salons. You may decline location permissions and manually choose your city at any time.</li>
                <li><strong>Push Notification Tokens:</strong> Firebase Cloud Messaging (FCM) device tokens used to deliver real-time booking confirmation and reminder notifications to your Android device.</li>
                <li><strong>System Logs:</strong> Transactional email delivery logs (timestamp, recipient, email type) maintained to verify service delivery.</li>
              </ul>
            </section>

            {/* 3. How We Use */}
            <section id="how-we-use" class="legal-section">
              <span className="section-number">Section 03</span>
              <h2 className="section-title">How Your Information is Used</h2>
              <p className="legal-paragraph">
                Your personal information is used exclusively for legitimate business and operational functions:
              </p>
              <ul className="legal-list">
                <li><strong>Account Provisioning & Security:</strong> Creating your account, authenticating login sessions via secure JSON Web Tokens (JWT), and managing password recovery via email.</li>
                <li><strong>Appointment Fulfillment:</strong> Transmitting booking requests to salon hosts, managing calendar slot locks, and generating booking confirmations.</li>
                <li><strong>Proximity Search:</strong> Calculating geometric distance between your location and registered salon establishments.</li>
                <li><strong>Push Notifications & Communications:</strong> Sending instantaneous booking updates, appointment reminders, and account security notifications.</li>
                <li><strong>Billing & Verification:</strong> Verifying salon owner business identity documents through administrative review and processing subscription plan renewals.</li>
                <li><strong>Platform Integrity:</strong> Preventing duplicate registrations, unauthorized access, and malicious activities.</li>
              </ul>
            </section>

            {/* 4. Sharing Between Parties */}
            <section id="data-sharing" className="legal-section">
              <span className="section-number">Section 04</span>
              <h2 className="section-title">Data Sharing Between Customers & Salon Owners</h2>
              <p className="legal-paragraph">
                Because BookMy Salon is a two-sided booking platform, specific information is shared between transaction participants:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>When a Customer Books an Appointment:</strong> The salon owner receives the customer's full name, contact phone number, custom booking notes, and uploaded profile photo. This enables salon staff to prepare for the appointment, reserve chair capacity, and contact the client regarding scheduling.
                </li>
                <li>
                  <strong>What Customers See About Salons:</strong> Customers can view the salon's commercial name, address, contact phone/email, business hours, menu pricing, gallery photographs, and the salon owner's verified host name and profile photo.
                </li>
                <li>
                  <strong>Customer Isolation:</strong> Customer data is strictly segregated. A customer can never view another customer's bookings, phone numbers, or account details.
                </li>
              </ul>
            </section>

            {/* 5. Third Parties */}
            <section id="third-parties" className="legal-section">
              <span className="section-number">Section 05</span>
              <h2 className="section-title">Third-Party Infrastructure & Service Providers</h2>
              <p className="legal-paragraph">
                We partner exclusively with reputable technology providers to operate the platform infrastructure:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Razorpay (Payment Processing):</strong> Facilitates salon owner subscription billing. Payment transactions are processed on Razorpay's PCI-DSS Level 1 certified gateway. BookMy Salon never stores or processes raw credit card numbers or banking passwords.
                </li>
                <li>
                  <strong>Cloudinary (Media Hosting):</strong> Secure cloud storage for user profile avatars and salon gallery photos.
                </li>
                <li>
                  <strong>Google Firebase Cloud Messaging (FCM):</strong> Delivers encrypted mobile push notification payloads to Android devices.
                </li>
                <li>
                  <strong>SMTP Email Transport:</strong> Dispatches transactional emails (welcome notifications, password recovery OTPs) over encrypted TLS channels.
                </li>
                <li>
                  <strong>Database Hosting:</strong> MongoDB managed infrastructure with access control safeguards.
                </li>
              </ul>

              <div className="review-box">
                <div className="review-box-header">⚠️ Confirmation Note — Analytics Tools</div>
                <p>
                  The current production release does not embed third-party behavioral trackers or marketing SDKs (such as Facebook Pixel or Google Analytics advertising trackers). If third-party product analytics are integrated in future updates, this section will be updated prior to deployment.
                </p>
              </div>
            </section>

            {/* 6. Retention & Deletion */}
            <section id="retention-deletion" className="legal-section">
              <span className="section-number">Section 06</span>
              <h2 className="section-title">Data Retention and Account Deletion</h2>
              <p className="legal-paragraph">
                We retain your personal information only as long as your account remains active and necessary to maintain your booking history or comply with tax/financial reporting laws.
              </p>
              <h3 className="subsection-title">Self-Service Account Deletion</h3>
              <p className="legal-paragraph">
                Both customers and salon owners possess the right to permanently delete their accounts directly in-app:
              </p>
              <ul className="legal-list">
                <li>Navigate to <strong>Settings → Security & Privacy → Delete Account</strong>.</li>
                <li>Confirm your decision. The application immediately calls the deletion endpoint, invalidates all active authentication tokens, and removes device FCM notification registrations.</li>
                <li>Alternatively, you may email your account deletion request to <strong>bookmysalonadmin@gmail.com</strong>.</li>
              </ul>
            </section>

            {/* 7. Security & Limitations */}
            <section id="security-safeguards" className="legal-section">
              <span className="section-number">Section 07</span>
              <h2 className="section-title">Security Safeguards and Limitations</h2>
              <p className="legal-paragraph">
                We maintain robust technical safeguards to protect your personal data:
              </p>
              <ul className="legal-list">
                <li>All communication between your device and our servers is encrypted using Transport Layer Security (TLS 1.2 / 1.3).</li>
                <li>Passwords are secured using one-way bcrypt cryptographic hashing with individual salt rounds.</li>
                <li>Authentication tokens on mobile are stored in hardware-backed secure storage.</li>
                <li>Sensitive identity verification documents uploaded by salon owners are restricted to platform Super Admin review.</li>
              </ul>
              <p className="legal-paragraph">
                <strong>Important Limitation:</strong> While we employ industry-standard protocols, no electronic storage system or transmission over the internet can be guaranteed 100% impenetrable. We advise users to practice responsible security by selecting unique, robust passwords.
              </p>
            </section>

            {/* 8. User Rights */}
            <section id="user-rights" className="legal-section">
              <span className="section-number">Section 08</span>
              <h2 className="section-title">Your Privacy Rights</h2>
              <p className="legal-paragraph">
                Depending on your jurisdiction, you hold fundamental rights regarding your personal information:
              </p>
              <ul className="legal-list">
                <li><strong>Right of Access:</strong> You can view all personal information associated with your account within the application profile and settings screens.</li>
                <li><strong>Right of Rectification:</strong> You can modify your name, phone number, address, city, and profile photo directly in Settings.</li>
                <li><strong>Right to Restrict Communication:</strong> You can toggle booking notifications, appointment reminders, and promotional alerts under Notification Preferences.</li>
                <li><strong>Right of Erasure:</strong> You can execute self-service account deletion at any time.</li>
              </ul>
            </section>

            {/* 9. Children's Privacy */}
            <section id="children" className="legal-section">
              <span className="section-number">Section 09</span>
              <h2 className="section-title">Children's Privacy</h2>
              <p className="legal-paragraph">
                BookMy Salon is designed for general audiences aged 18 and older. We do not knowingly solicit or collect personal information from individuals under the age of 13 (or under 18 without parental consent). If we discover that an account has been registered by a minor without valid authorization, we will promptly delete the associated records.
              </p>
            </section>

            {/* 10. Policy Changes */}
            <section id="policy-changes" className="legal-section">
              <span className="section-number">Section 10</span>
              <h2 className="section-title">Changes to This Privacy Policy</h2>
              <p className="legal-paragraph">
                We may update this Privacy Policy from time to time to accommodate evolving technical integrations or statutory requirements. When changes are made, the revised date at the top of this page will be updated. We encourage you to review this permanent URL periodically.
              </p>
            </section>

            {/* 11. Privacy Contact */}
            <section id="privacy-contact" className="legal-section">
              <span className="section-number">Section 11</span>
              <h2 className="section-title">Privacy Contact & Grievance Handling</h2>
              <p className="legal-paragraph">
                If you have questions, feedback, or data privacy requests, please reach out to our privacy desk:
              </p>
              <div className="callout-box">
                <div className="callout-title">BookMy Salon Data Privacy & Grievance Desk</div>
                <p>
                  <strong>Privacy Contact Email:</strong> <a href="mailto:bookmysalonadmin@gmail.com" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>bookmysalonadmin@gmail.com</a><br />
                  <strong>Mailing Inquiries:</strong> Managed via administrative email desk<br />
                  <strong>Turnaround Time:</strong> Inquiries are addressed within 48 to 72 business hours
                </p>
              </div>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}
