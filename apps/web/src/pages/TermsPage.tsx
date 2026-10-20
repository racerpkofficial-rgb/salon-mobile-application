import React from 'react';
import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <>
      {/* Hero Header */}
      <section className="hero-banner">
        <div className="hero-inner">
          <span className="badge-tag">Binding Platform Agreement</span>
          <h1 className="hero-title">Terms & Conditions</h1>
          <p className="hero-subtitle">
            Please read these terms carefully before creating an account, reserving appointments, or listing a salon atelier on BookMy Salon.
          </p>
          <div className="meta-info">
            <div className="meta-item">
              <span>Effective Date:</span> <strong>October 20, 2026</strong>
            </div>
            <div className="meta-item">
              <span>Version:</span> <strong>1.0 (Production Release)</strong>
            </div>
            <div className="meta-item">
              <span>Contact:</span> <strong>bookmysalonadmin@gmail.com</strong>
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
              <li className="toc-item"><a href="#acceptance">1. Acceptance of Terms</a></li>
              <li className="toc-item"><a href="#eligibility">2. Eligibility & Registration</a></li>
              <li className="toc-item"><a href="#roles">3. Customer & Owner Roles</a></li>
              <li className="toc-item"><a href="#security">4. Account Security</a></li>
              <li className="toc-item"><a href="#discovery-booking">5. Discovery & Bookings</a></li>
              <li className="toc-item"><a href="#cancellation">6. Cancellation & Rescheduling</a></li>
              <li className="toc-item"><a href="#subscriptions">7. Salon Subscription Plans</a></li>
              <li className="toc-item"><a href="#pricing-offers">8. Pricing, Offers & Discounts</a></li>
              <li className="toc-item"><a href="#content-photos">9. Profile Photos & Content</a></li>
              <li className="toc-item"><a href="#notifications">10. Notifications & Comms</a></li>
              <li className="toc-item"><a href="#termination">11. Suspension & Termination</a></li>
              <li className="toc-item"><a href="#limitations">12. Service Limitations</a></li>
              <li className="toc-item"><a href="#intellectual-property">13. Intellectual Property</a></li>
              <li className="toc-item"><a href="#updates">14. Updates to Terms</a></li>
              <li className="toc-item"><a href="#grievance">15. Contact & Grievance</a></li>
            </ul>
          </aside>

          {/* Legal Article Content */}
          <article className="legal-article">
            {/* 1. Acceptance */}
            <section id="acceptance" className="legal-section">
              <span className="section-number">Section 01</span>
              <h2 className="section-title">Acceptance of Terms</h2>
              <p className="legal-paragraph">
                These Terms & Conditions ("Terms", "Agreement") constitute a legally binding agreement between you ("User", "Customer", "Salon Owner", or "Partner") and <strong>BookMy Salon</strong> ("Platform", "we", "us", or "our") governing your access to and use of our Android mobile application, web interfaces, APIs, and associated booking discovery services.
              </p>
              <p className="legal-paragraph">
                By downloading, registering, accessing, or using the BookMy Salon application or website, you confirm that you have read, understood, and agreed to be bound by these Terms, as well as our incorporated <Link to="/privacy" style={{ color: 'var(--gold-primary)', fontWeight: 600, textDecoration: 'underline' }}>Privacy Policy</Link>. If you do not agree to these Terms, you must immediately refrain from creating an account or using the platform.
              </p>
            </section>

            {/* 2. Eligibility & Registration */}
            <section id="eligibility" className="legal-section">
              <span className="section-number">Section 02</span>
              <h2 className="section-title">Eligibility & Account Registration</h2>
              <p className="legal-paragraph">
                To register an account or use BookMy Salon, you represent and warrant that:
              </p>
              <ul className="legal-list">
                <li>You are at least eighteen (18) years of age, or possess legal parental/guardian consent where permitted under applicable local law.</li>
                <li>You possess the legal capacity and authority to enter into these binding terms.</li>
                <li>All registration details you submit—including your legal name, email address, mobile number, and salon business details—are accurate, current, and truthful.</li>
                <li>You will maintain and promptly update your profile information in the event of any changes.</li>
              </ul>
            </section>

            {/* 3. Roles */}
            <section id="roles" className="legal-section">
              <span className="section-number">Section 03</span>
              <h2 className="section-title">Customer and Salon-Owner Roles</h2>
              <p className="legal-paragraph">
                BookMy Salon operates dual role-based workflows tailored to distinct user groups:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Customer Role:</strong> Individuals seeking grooming, styling, and wellness treatments. Customers may browse salons, view portfolios and public reviews, select time slots, request appointment reservations, and update personal notification settings. Registration and booking access is completely free of charge for clients.
                </li>
                <li>
                  <strong>Salon-Owner (Partner) Role:</strong> Commercial proprietors, barbers, beauty salons, and wellness spas offering professional services. Salon owners configure working hours, interval slot schedules, pricing catalogs, promotional offers, and manage incoming appointment requests. Salon partners undergo administrative verification and subscribe to a platform partnership plan to remain actively listed.
                </li>
              </ul>
            </section>

            {/* 4. Account Security */}
            <section id="security" className="legal-section">
              <span className="section-number">Section 04</span>
              <h2 className="section-title">Account Security and Accurate Information</h2>
              <p className="legal-paragraph">
                You are exclusively responsible for safeguarding the confidentiality of your account password and session authentication credentials. You agree to:
              </p>
              <ul className="legal-list">
                <li>Select a strong password meeting platform complexity requirements (minimum 8 characters, combining uppercase, lowercase, numbers, and symbols).</li>
                <li>Never disclose your credentials to any third party or permit unauthorized parties to access your account.</li>
                <li>Immediately notify our administrative desk at <strong>bookmysalonadmin@gmail.com</strong> if you suspect any breach of security, unauthorized access, or credential compromise.</li>
              </ul>
              <p className="legal-paragraph">
                Passwords on BookMy Salon are cryptographically hashed using industry-standard bcrypt before storage. We cannot access your raw plaintext password. Session tokens are securely stored in hardware-backed storage on your mobile device.
              </p>
            </section>

            {/* 5. Discovery & Booking Lifecycle */}
            <section id="discovery-booking" className="legal-section">
              <span className="section-number">Section 05</span>
              <h2 className="section-title">Salon Discovery & Appointment Booking</h2>
              <p className="legal-paragraph">
                The platform provides a streamlined appointment scheduling engine based on real-time availability:
              </p>
              <ul className="legal-list">
                <li>
                  <strong>Proximity Discovery:</strong> Customers may filter and discover salons by city or through optional GPS proximity detection (5 km, 10 km, or 25 km radius).
                </li>
                <li>
                  <strong>Working Hours & Slot Intervals:</strong> Salons configure their operating days, opening/closing times, and slot duration intervals (e.g. 30-minute intervals). Only unbooked, non-overlapping slots during active business hours are available for reservation.
                </li>
                <li>
                  <strong>Pending Request State:</strong> When a customer submits an appointment request, the booking is recorded in <code>PENDING</code> status. Submitting a request does not guarantee immediate chair availability.
                </li>
                <li>
                  <strong>Owner Confirmation or Rejection:</strong> The salon owner reviews the incoming request and can either <code>CONFIRM</code> or <code>REJECT</code> the appointment (with a mandatory explanation in the event of rejection). Both parties receive automated push notifications and updates.
                </li>
                <li>
                  <strong>Completion:</strong> After the treatment is rendered, the salon marks the appointment as <code>COMPLETED</code>, unlocking customer review submission.
                </li>
              </ul>
            </section>

            {/* 6. Cancellation & Rescheduling */}
            <section id="cancellation" className="legal-section">
              <span className="section-number">Section 06</span>
              <h2 className="section-title">Appointment Cancellation & Rescheduling</h2>
              <p className="legal-paragraph">
                We understand scheduling changes happen. Within the BookMy Salon application:
              </p>
              <ul className="legal-list">
                <li>Customers may cancel pending or confirmed appointments directly through the mobile interface prior to their scheduled time slot.</li>
                <li>Salon owners may cancel or decline appointments due to unforeseen staff absence, facility maintenance, or scheduling conflicts, upon providing a prompt notification to the client.</li>
              </ul>

              <div className="review-box">
                <div className="review-box-header">⚠️ Salon Partner Notice — Cancellation Policy</div>
                <p>
                  In-app customer payments are not collected in advance by the platform for appointments; payments are completed in-salon or via salon-specific arrangements. Consequently, specific late-cancellation penalty fees or reschedule cutoffs remain subject to the individual salon atelier's house rules until an in-app client prepayment policy is adopted by the business owner.
                </p>
              </div>
            </section>

            {/* 7. Subscriptions */}
            <section id="subscriptions" className="legal-section">
              <span className="section-number">Section 07</span>
              <h2 className="section-title">Salon-Owner Responsibilities & Subscription Plans</h2>
              <p className="legal-paragraph">
                To publish salon profiles, receive client booking requests, and appear in search results, salon owners subscribe to a platform partnership plan. Billing is processed securely through <strong>Razorpay</strong> in Indian Rupees (INR).
              </p>

              <div className="table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Plan Tier</th>
                      <th>Monthly Billing</th>
                      <th>Yearly Billing</th>
                      <th>Core Inclusions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="badge-plan">STARTER</span></td>
                      <td><strong>₹299</strong> / month</td>
                      <td><strong>₹2,999</strong> / year</td>
                      <td>Salon listing, basic service catalog, appointment management, direct customer communication.</td>
                    </tr>
                    <tr>
                      <td><span className="badge-plan">BUSINESS</span></td>
                      <td><strong>₹599</strong> / month</td>
                      <td><strong>₹5,999</strong> / year</td>
                      <td>Priority listing in search radius, promotional offers management, real-time schedule analytics.</td>
                    </tr>
                    <tr>
                      <td><span className="badge-plan">PREMIUM</span></td>
                      <td><strong>₹999</strong> / month</td>
                      <td><strong>₹9,999</strong> / year</td>
                      <td>Top search placement, featured salon host badge, unlimited service catalog, premium analytics & dedicated desk support.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="legal-paragraph">
                <strong>Plan Expiry & Renewals:</strong> Subscriptions remain active until their designated <code>endDate</code>. If a subscription is not renewed before expiry, the salon's listing transitions to <code>EXPIRED</code> status and ceases to accept new booking requests until renewal.
              </p>
              <p className="legal-paragraph">
                <strong>Identity Verification:</strong> Newly registered salon partners remain in <code>PENDING_APPROVAL</code> status until official commercial documentation (GST Certificate, Trade License, Proprietor PAN, or Shop & Establishment certificate) is verified by the Super Admin.
              </p>

              <div className="review-box">
                <div className="review-box-header">⚠️ Review Flag — Subscription Refund Window</div>
                <p>
                  Subscription fees paid to activate salon software listings are non-refundable once an activation billing cycle commences, except where required by applicable statutory consumer law or in verified technical payment errors. A formal 7-day or 14-day pro-rated refund option is pending final proprietor confirmation.
                </p>
              </div>
            </section>

            {/* 8. Pricing, Offers & Discounts */}
            <section id="pricing-offers" className="legal-section">
              <span className="section-number">Section 08</span>
              <h2 className="section-title">Pricing, Offers & Discounts</h2>
              <p className="legal-paragraph">
                All treatment prices, package tariffs, and discounts displayed on BookMy Salon are set independently by each salon partner. BookMy Salon does not dictate service charges.
              </p>
              <ul className="legal-list">
                <li>Salon partners are solely responsible for ensuring that published service fees reflect their authentic, all-inclusive in-salon charges.</li>
                <li>Promotional discount offers created by salons are valid exclusively during their active start and end dates.</li>
                <li>Promotional discount codes and salon offers cannot be converted into cash.</li>
              </ul>
            </section>

            {/* 9. Profile Photos & Content */}
            <section id="content-photos" className="legal-section">
              <span className="section-number">Section 09</span>
              <h2 className="section-title">User Profile Photos & Content Standards</h2>
              <p className="legal-paragraph">
                Users may upload personal profile avatars, salon cover images, gallery photos, and identity documents. You warrant that any media you submit:
              </p>
              <ul className="legal-list">
                <li>Is your own authentic likeness (for profile avatars) or depicts your actual salon premises and commercial facility (for salon imagery).</li>
                <li>Does not infringe upon any third-party intellectual property, trademark, or privacy rights.</li>
                <li>Does not contain obscene, sexually explicit, abusive, harassing, or unlawful imagery.</li>
              </ul>
              <p className="legal-paragraph">
                BookMy Salon reserves the right to remove any imagery or revoke access for any account that violates these standards.
              </p>
            </section>

            {/* 10. Notifications */}
            <section id="notifications" className="legal-section">
              <span className="section-number">Section 10</span>
              <h2 className="section-title">Notifications & Communications</h2>
              <p className="legal-paragraph">
                By creating an account, you consent to receive necessary operational communications, including:
              </p>
              <ul className="legal-list">
                <li>Real-time push notifications regarding appointment status changes (pending, confirmed, rejected, cancelled, completed) delivered via Google Firebase Cloud Messaging (FCM).</li>
                <li>Essential transactional emails (welcome notifications, password recovery codes/links, account security notices) sent via our secure mail transport.</li>
                <li>Optional promotional announcements, which can be toggled on or off under Settings → Notification Preferences.</li>
              </ul>
            </section>

            {/* 11. Suspension & Termination */}
            <section id="termination" className="legal-section">
              <span className="section-number">Section 11</span>
              <h2 className="section-title">Account Suspension & Termination</h2>
              <p className="legal-paragraph">
                <strong>Self-Service Account Deletion:</strong> You have the absolute right to terminate your account at any time. Customers and salon owners can initiate permanent account deletion directly through Settings → Security & Privacy → Delete Account.
              </p>
              <p className="legal-paragraph">
                <strong>Platform Suspension Rights:</strong> We reserve the right to suspend, terminate, or restrict your access to the platform without prior notice if:
              </p>
              <ul className="legal-list">
                <li>You materially breach any provision of these Terms or our Privacy Policy.</li>
                <li>A salon owner submits fraudulent business identity documents or repeatedly fails to honor confirmed appointments.</li>
                <li>A customer engages in repeated abusive no-shows or harassment of salon staff.</li>
                <li>Required by judicial or governmental order.</li>
              </ul>
            </section>

            {/* 12. Limitations */}
            <section id="limitations" className="legal-section">
              <span className="section-number">Section 12</span>
              <h2 className="section-title">Service Availability & Disclaimer of Warranties</h2>
              <p className="legal-paragraph">
                <strong>Technology Intermediary:</strong> BookMy Salon functions strictly as an electronic venue and technology platform connecting clients with independent salon providers. We are not a salon, styling studio, or healthcare provider.
              </p>
              <p className="legal-paragraph">
                The execution, quality, hygiene, and physical outcome of grooming treatments are the sole responsibility of the independent salon partner providing the service. BookMy Salon disclaims all liability for personal injury, allergic reactions, property damage, or unsatisfactory styling outcomes arising from services provided by salon partners.
              </p>
              <p className="legal-paragraph">
                The platform is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of uninterrupted uptime or error-free performance.
              </p>
            </section>

            {/* 13. Intellectual Property */}
            <section id="intellectual-property" className="legal-section">
              <span className="section-number">Section 13</span>
              <h2 className="section-title">Intellectual Property</h2>
              <p className="legal-paragraph">
                All software code, visual designs, logos, graphics, icons, brand names ("BookMy Salon"), and database structures are the exclusive intellectual property of BookMy Salon. You are granted a limited, revocable, non-exclusive license to use the mobile application solely for personal or legitimate salon management purposes.
              </p>
            </section>

            {/* 14. Updates */}
            <section id="updates" className="legal-section">
              <span className="section-number">Section 14</span>
              <h2 className="section-title">Updates to These Terms</h2>
              <p className="legal-paragraph">
                We may revise these Terms & Conditions periodically to reflect evolving platform features, legislative updates, or operational practices. The revised version will always be published on this permanent URL with an updated effective date. Your continued use of BookMy Salon following any posted revision signifies your acceptance.
              </p>
            </section>

            {/* 15. Grievance */}
            <section id="grievance" className="legal-section">
              <span className="section-number">Section 15</span>
              <h2 className="section-title">Contact & Grievance Details</h2>
              <p className="legal-paragraph">
                For questions, legal notices, or dispute escalations, please contact our administrative desk:
              </p>
              <div className="callout-box">
                <div className="callout-title">BookMy Salon Administrative & Grievance Desk</div>
                <p>
                  <strong>Official Email:</strong> <a href="mailto:bookmysalonadmin@gmail.com" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>bookmysalonadmin@gmail.com</a><br />
                  <strong>Platform Operations:</strong> Mobile Android & Web Portal Services<br />
                  <strong>Response Timeframe:</strong> Within 48 to 72 business hours
                </p>
              </div>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}
