import nodemailer, { Transporter } from 'nodemailer';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { EmailEventType, EmailLog } from '../models/EmailLog.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmtpConfigValidation {
  isConfigured: boolean;
  missingFields: string[];
  isAuthIncomplete: boolean;
  safeSummary: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    from?: string;
  };
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateRecipientEmail(email?: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Recipient email is required and cannot be empty.');
  }
  const clean = email.trim().toLowerCase();
  if (!clean.includes('@') || clean.length < 5) {
    throw new Error(`Invalid recipient email address format: "${email}"`);
  }
  return clean;
}

type MockSender = (options: SendEmailOptions) => Promise<void>;

let mockSender: MockSender | null = null;
let lastSentOtp: { email: string; otp: string } | null = null;
let sentEmails: SendEmailOptions[] = [];
let cachedTransporter: Transporter | null = null;

const SUPPORT_EMAIL = 'bookmysalonadmin@gmail.com';

function getEffectiveMailFrom(): string {
  return env.SMTP_FROM || env.MAIL_FROM || 'Book My Salon <bookmysalonadmin@gmail.com>';
}

function renderHtmlLayout(title: string, subtitle: string, bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F8F5F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F5F0; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFCF7; border: 1px solid #EFE7DC; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(48, 35, 31, 0.05);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 18px 32px; border-bottom: 1px solid #F4EBDD; background-color: #FFFCF7;">
                  <h1 style="color: #30231F; margin: 0 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Book My Salon</h1>
                  <p style="color: #B08D57; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin: 0;">${escapeHtml(subtitle)}</p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 28px 32px; color: #49413D; font-size: 15px; line-height: 24px;">
                  ${bodyContent}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 22px 32px 28px 32px; background-color: #FAF6F0; border-top: 1px solid #EFE7DC;">
                  <p style="color: #7A6E65; font-size: 12px; margin: 0 0 8px 0; line-height: 18px;">
                    Have questions? Contact our team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #B08D57; text-decoration: none; font-weight: 700;">${SUPPORT_EMAIL}</a>.
                  </p>
                  <p style="color: #B8A58C; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} Book My Salon. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export const emailService = {
  validateConfig(): SmtpConfigValidation {
    const missingFields: string[] = [];

    if (!env.SMTP_HOST || env.SMTP_HOST.trim().length === 0) {
      missingFields.push('SMTP_HOST');
    }
    const fromAddress = env.SMTP_FROM || env.MAIL_FROM;
    if (!fromAddress || fromAddress.trim().length === 0) {
      missingFields.push('SMTP_FROM / MAIL_FROM');
    }

    const hasUser = Boolean(env.SMTP_USER && env.SMTP_USER.trim().length > 0);
    const hasPass = Boolean(env.SMTP_PASS && env.SMTP_PASS.trim().length > 0);
    const isAuthIncomplete = (hasUser && !hasPass) || (!hasUser && hasPass);

    const isConfigured = missingFields.length === 0 && !isAuthIncomplete;

    let safeUser: string | undefined = undefined;
    if (env.SMTP_USER) {
      const parts = env.SMTP_USER.split('@');
      if (parts.length === 2) {
        safeUser = `${parts[0].slice(0, 2)}***@${parts[1]}`;
      } else {
        safeUser = `${env.SMTP_USER.slice(0, 2)}***`;
      }
    }

    return {
      isConfigured,
      missingFields,
      isAuthIncomplete,
      safeSummary: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_SECURE || false,
        user: safeUser,
        from: fromAddress
      }
    };
  },

  isConfigured(): boolean {
    if (mockSender !== null) return true;
    return this.validateConfig().isConfigured;
  },

  getTransporter(): Transporter {
    if (cachedTransporter) return cachedTransporter;

    const validation = this.validateConfig();
    if (!validation.isConfigured) {
      const details = validation.missingFields.length > 0
        ? `Missing required fields: ${validation.missingFields.join(', ')}`
        : 'SMTP authentication configuration is incomplete (both SMTP_USER and SMTP_PASS must be provided).';
      throw new Error(`SMTP email service is not properly configured. ${details}`);
    }

    const sanitizedPass = env.SMTP_PASS ? env.SMTP_PASS.replace(/\s+/g, '') : undefined;

    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE || false,
      auth:
        env.SMTP_USER && sanitizedPass
          ? {
              user: env.SMTP_USER.trim(),
              pass: sanitizedPass
            }
          : undefined,
      tls: {
        rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED ?? false
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    return cachedTransporter;
  },

  async verifyConnection(): Promise<{ ok: boolean; message: string; safeSummary?: any }> {
    if (mockSender !== null) {
      return { ok: true, message: 'Mock email sender active for automated test environment.' };
    }

    const validation = this.validateConfig();
    if (!validation.isConfigured) {
      return {
        ok: false,
        message: `SMTP not configured. Missing or invalid: ${validation.missingFields.join(', ') || 'SMTP_USER/PASS'}.`,
        safeSummary: validation.safeSummary
      };
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return {
        ok: true,
        message: `SMTP connection established successfully with ${validation.safeSummary.host}:${validation.safeSummary.port}.`,
        safeSummary: validation.safeSummary
      };
    } catch (err: any) {
      const safeErrorMsg = err instanceof Error ? err.message : 'Unknown connection error';
      return {
        ok: false,
        message: `SMTP connection failed: ${safeErrorMsg}`,
        safeSummary: validation.safeSummary
      };
    }
  },

  setMockSender(fn: MockSender | null) {
    mockSender = fn;
    cachedTransporter = null;
  },

  getSentEmails(): SendEmailOptions[] {
    return sentEmails;
  },

  getLastSentEmail(): SendEmailOptions | null {
    return sentEmails[sentEmails.length - 1] || null;
  },

  getLastSentOtp(): { email: string; otp: string } | null {
    return lastSentOtp;
  },

  clearTestState() {
    mockSender = null;
    lastSentOtp = null;
    sentEmails = [];
    cachedTransporter = null;
  },

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const validatedTo = validateRecipientEmail(options.to);
    const normalizedOptions: SendEmailOptions = {
      ...options,
      to: validatedTo
    };

    sentEmails.push(normalizedOptions);

    if (mockSender) {
      await mockSender(normalizedOptions);
      return;
    }

    const transporter = this.getTransporter();

    try {
      await transporter.sendMail({
        from: getEffectiveMailFrom(),
        to: validatedTo,
        subject: options.subject,
        text: options.text,
        html: options.html
      });
    } catch (err: any) {
      const safeMsg = err instanceof Error ? err.message : 'Unknown SMTP transmission error';
      console.error(`[EmailService] Failed to send email to ${validatedTo.replace(/(.{2})(.*)(@.*)/, '$1***$3')}: ${safeMsg}`);
      throw new Error(`Email delivery failed: ${safeMsg}`);
    }
  },

  /**
   * Idempotent business email transmission.
   * Checks EmailLog by idempotencyKey to prevent duplicate emails across retries.
   * On failure, records FAILED state in EmailLog without blocking or rolling back DB transactions.
   */
  async sendEventEmailOnce(params: {
    eventType: EmailEventType;
    idempotencyKey: string;
    recipientEmail: string;
    referenceId: Types.ObjectId | string;
    subject: string;
    text: string;
    html: string;
  }): Promise<boolean> {
    const { eventType, idempotencyKey, recipientEmail, referenceId, subject, text, html } = params;

    let cleanEmail: string;
    try {
      cleanEmail = validateRecipientEmail(recipientEmail);
    } catch (valErr: any) {
      console.warn(`[Email Delivery Skipped] Invalid recipient email address provided for event ${eventType}: "${recipientEmail}"`);
      return false;
    }

    // 1. Duplicate check: If email was already SENT for this exact business event, skip!
    const existingLog = await EmailLog.findOne({ idempotencyKey });
    if (existingLog && existingLog.status === 'SENT') {
      console.log(`[Email Duplicate Prevention] Email ${eventType} already SENT for key ${idempotencyKey}. Skipping duplicate.`);
      return true;
    }

    // 2. Prepare or update EmailLog record
    let logDoc = existingLog;
    if (!logDoc) {
      try {
        logDoc = await EmailLog.create({
          recipientEmail: cleanEmail,
          eventType,
          referenceId: new Types.ObjectId(referenceId.toString()),
          idempotencyKey,
          subject,
          status: 'PENDING',
          attempts: 1
        });
      } catch (err: any) {
        if (err.code === 11000) {
          logDoc = await EmailLog.findOne({ idempotencyKey });
          if (logDoc && logDoc.status === 'SENT') {
            return true;
          }
        } else {
          console.error('[Email Log] Could not create email log document:', err);
        }
      }
    } else {
      logDoc.attempts += 1;
    }

    // 3. Attempt transmission safely
    try {
      await this.sendEmail({
        to: cleanEmail,
        subject,
        text,
        html
      });

      if (logDoc) {
        logDoc.status = 'SENT';
        logDoc.sentAt = new Date();
        logDoc.error = undefined;
        await logDoc.save();
      }
      return true;
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (logDoc) {
        logDoc.status = 'FAILED';
        logDoc.error = errorMsg;
        await logDoc.save();
      }
      console.warn(`[Email Delivery Failure] Non-fatal delivery failure for ${eventType} to ${cleanEmail}: ${errorMsg}`);
      return false;
    }
  },

  // =========================================================================
  // 1. Customer Registration Welcome Email
  // =========================================================================
  async sendCustomerWelcomeEmail(
    to: string,
    customerName: string,
    userId: Types.ObjectId | string
  ): Promise<boolean> {
    const cleanTo = validateRecipientEmail(to);
    const safeName = customerName?.trim() || 'Valued Customer';
    const escapedName = escapeHtml(safeName);

    const subject = 'Welcome to BookMy Salon!';

    const text = `Hi ${safeName},

Welcome to BookMy Salon!

We're happy to have you with us. Your account has been created successfully, and you're ready to discover salons, explore services and prices, and book appointments that suit your schedule.

Here's what you can do with BookMy Salon:
Discover salons and available services.
Compare service prices and explore salon offers.
Book appointments conveniently.
Manage your bookings and share your experience through ratings and reviews.

Thank you for choosing BookMy Salon. We look forward to helping you enjoy a great salon experience!

Warm regards,
Team BookMy Salon`;

    const htmlBody = `
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${escapedName}</strong>,</p>
      
      <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #30231F;">
        Welcome to BookMy Salon!
      </p>

      <p style="margin: 0 0 18px 0; line-height: 24px;">
        We're happy to have you with us. Your account has been created successfully, and you're ready to discover salons, explore services and prices, and book appointments that suit your schedule.
      </p>

      <div style="background-color: #FAF6F0; border-left: 3px solid #B08D57; padding: 16px 18px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 700; color: #30231F; font-size: 14px;">Here's what you can do with BookMy Salon:</p>
        <ul style="margin: 0; padding-left: 20px; line-height: 24px; color: #49413D; font-size: 14px;">
          <li style="margin-bottom: 6px;">Discover salons and available services.</li>
          <li style="margin-bottom: 6px;">Compare service prices and explore salon offers.</li>
          <li style="margin-bottom: 6px;">Book appointments conveniently.</li>
          <li style="margin-bottom: 0;">Manage your bookings and share your experience through ratings and reviews.</li>
        </ul>
      </div>

      <p style="margin: 20px 0 24px 0; line-height: 24px;">
        Thank you for choosing BookMy Salon. We look forward to helping you enjoy a great salon experience!
      </p>

      <p style="margin: 0; color: #7A6E65; line-height: 22px;">
        Warm regards,<br>
        <strong style="color: #30231F;">Team BookMy Salon</strong>
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Customer Welcome', htmlBody);

    return this.sendEventEmailOnce({
      eventType: 'CUSTOMER_WELCOME',
      idempotencyKey: `CUSTOMER_WELCOME:${userId}`,
      recipientEmail: cleanTo,
      referenceId: userId,
      subject,
      text,
      html
    });
  },

  // =========================================================================
  // 1B. Salon Owner Registration Welcome Email
  // =========================================================================
  async sendOwnerWelcomeEmail(
    to: string,
    ownerName: string,
    userId: Types.ObjectId | string,
    salonId?: Types.ObjectId | string
  ): Promise<boolean> {
    const cleanTo = validateRecipientEmail(to);
    const safeName = ownerName?.trim() || 'Salon Partner';
    const escapedName = escapeHtml(safeName);

    const subject = 'Welcome to BookMy Salon!';

    const text = `Hi ${safeName},

Welcome to BookMy Salon!

Thank you for registering as a Salon Partner with BookMy Salon. Your salon owner account has been created successfully.

Once your salon profile and identity verification are reviewed and approved by our administration, your salon will be published to customers, allowing you to:
- List your beauty, hair, and wellness services with custom pricing.
- Manage appointment calendars, bookings, and customer schedules.
- Create promotional offers to attract nearby clients.
- Build your digital salon presence with verified customer reviews.

Thank you for choosing BookMy Salon as your salon management and discovery platform. We look forward to growing your salon business together!

Warm regards,
Team BookMy Salon`;

    const htmlBody = `
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${escapedName}</strong>,</p>

      <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #30231F;">
        Welcome to BookMy Salon!
      </p>

      <p style="margin: 0 0 18px 0; line-height: 24px;">
        Thank you for registering as a Salon Partner with BookMy Salon. Your salon owner account has been created successfully.
      </p>

      <div style="background-color: #FAF6F0; border-left: 3px solid #B08D57; padding: 16px 18px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 700; color: #30231F; font-size: 14px;">As a BookMy Salon Partner, you can:</p>
        <ul style="margin: 0; padding-left: 20px; line-height: 24px; color: #49413D; font-size: 14px;">
          <li style="margin-bottom: 6px;">List your beauty, hair, and wellness services with custom pricing.</li>
          <li style="margin-bottom: 6px;">Manage appointment calendars, bookings, and customer schedules.</li>
          <li style="margin-bottom: 6px;">Create promotional offers to attract nearby clients.</li>
          <li style="margin-bottom: 0;">Build your digital salon presence with verified customer reviews.</li>
        </ul>
      </div>

      <p style="margin: 20px 0 24px 0; line-height: 24px;">
        Thank you for choosing BookMy Salon as your salon management and discovery platform. We look forward to growing your salon business together!
      </p>

      <p style="margin: 0; color: #7A6E65; line-height: 22px;">
        Warm regards,<br>
        <strong style="color: #30231F;">Team BookMy Salon</strong>
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Salon Partner Welcome', htmlBody);

    return this.sendEventEmailOnce({
      eventType: 'OWNER_WELCOME',
      idempotencyKey: `OWNER_WELCOME:${userId}`,
      recipientEmail: cleanTo,
      referenceId: userId,
      subject,
      text,
      html
    });
  },

  // =========================================================================
  // 1C. Existing User Login Welcome Back Email
  // =========================================================================
  async sendWelcomeBackEmail(
    to: string,
    userName: string,
    userId: Types.ObjectId | string,
    role: 'CUSTOMER' | 'SALON_OWNER'
  ): Promise<boolean> {
    const cleanTo = validateRecipientEmail(to);
    const safeName = userName?.trim() || 'Valued User';
    const escapedName = escapeHtml(safeName);

    const subject = 'Welcome Back to BookMy Salon!';
    const isOwner = role === 'SALON_OWNER';
    const subtitle = isOwner ? 'Partner Sign-In Notice' : 'Sign-In Notice';

    const text = isOwner
      ? `Hi ${safeName},

Welcome Back to BookMy Salon!

You have successfully signed in to your Salon Partner dashboard. You can manage your appointments, salon services, and business operations.

Warm regards,
Team BookMy Salon`
      : `Hi ${safeName},

Welcome Back to BookMy Salon!

You have successfully signed in to your BookMy Salon account. Explore nearby luxury salons, view exclusive promotions, and book appointments.

Warm regards,
Team BookMy Salon`;

    const htmlBody = `
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${escapedName}</strong>,</p>

      <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #30231F;">
        Welcome Back to BookMy Salon!
      </p>

      <p style="margin: 0 0 18px 0; line-height: 24px;">
        ${
          isOwner
            ? 'You have successfully signed in to your Salon Partner account. Your salon bookings, schedules, and catalogue management are available right at your fingertips.'
            : 'You have successfully signed in to your BookMy Salon account. Explore nearby luxury salons, view exclusive promotions, and book your personalized beauty appointments.'
        }
      </p>

      <p style="margin: 20px 0 0 0; color: #7A6E65; line-height: 22px;">
        Warm regards,<br>
        <strong style="color: #30231F;">Team BookMy Salon</strong>
      </p>
    `;

    const html = renderHtmlLayout(subject, subtitle, htmlBody);

    return this.sendEventEmailOnce({
      eventType: 'WELCOME_BACK',
      idempotencyKey: `WELCOME_BACK:${userId}:${Date.now()}`,
      recipientEmail: cleanTo,
      referenceId: userId,
      subject,
      text,
      html
    });
  },

  // =========================================================================
  // 2. Salon Owner Registration Received Email
  // =========================================================================
  async sendOwnerRegistrationReceivedEmail(
    to: string,
    ownerName: string,
    salonId: Types.ObjectId | string
  ): Promise<boolean> {
    const safeName = ownerName?.trim() || 'Salon Partner';
    const escapedName = escapeHtml(safeName);

    const subject = 'Your Book My Salon Salon Registration Has Been Received';

    const text = `Hi ${safeName},

Thank you for registering your salon with Book My Salon!

We have successfully received your salon registration and submitted it for administrative review.

Your current application status is: Pending Approval.

Our admin team will review your submitted details and identity verification information. We will notify you by email once your application has been approved or rejected.

Thank you for your interest in joining Book My Salon. We look forward to welcoming you to our salon partner community.

Warm regards,
Book My Salon Admin Team`;

    const htmlBody = `
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${escapedName}</strong>,</p>

      <p style="margin: 0 0 16px 0; line-height: 24px;">
        Thank you for registering your salon with Book My Salon!
      </p>

      <p style="margin: 0 0 18px 0; line-height: 24px;">
        We have successfully received your salon registration and submitted it for administrative review.
      </p>

      <div style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 10px; padding: 16px; margin: 20px 0; text-align: center;">
        <span style="display: block; font-size: 11px; font-weight: 800; color: #92400E; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">Application Status</span>
        <span style="display: block; font-size: 18px; font-weight: 800; color: #78350F;">⏳ Pending Approval</span>
      </div>

      <p style="margin: 0 0 18px 0; line-height: 24px;">
        Our admin team will review your submitted details and identity verification information. We will notify you by email once your application has been approved or rejected.
      </p>

      <p style="margin: 0 0 24px 0; line-height: 24px;">
        Thank you for your interest in joining Book My Salon. We look forward to welcoming you to our salon partner community.
      </p>

      <p style="margin: 0; color: #7A6E65; line-height: 22px;">
        Warm regards,<br>
        <strong style="color: #30231F;">Book My Salon Admin Team</strong>
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Salon Partner Registration', htmlBody);

    return this.sendEventEmailOnce({
      eventType: 'OWNER_REGISTRATION_RECEIVED',
      idempotencyKey: `OWNER_REGISTRATION_RECEIVED:${salonId}`,
      recipientEmail: to,
      referenceId: salonId,
      subject,
      text,
      html
    });
  },

  // =========================================================================
  // 3. Admin Accepts a Salon Owner Registration
  // =========================================================================
  async sendSalonApprovedEmail(
    to: string,
    ownerName: string,
    salonId: Types.ObjectId | string,
    decisionTimestamp?: Date
  ): Promise<boolean> {
    const safeName = ownerName?.trim() || 'Salon Partner';
    const escapedName = escapeHtml(safeName);

    const subject = 'Congratulations! Your Salon Has Been Approved on Book My Salon';

    const text = `Hi ${safeName},

Congratulations! 🎉

We're delighted to inform you that your salon registration has been approved by the Book My Salon admin team.

Your salon is now approved to join our platform.

You can now:
Access your salon owner account.
Complete or update your salon profile.
Add and manage your services and prices.
Manage bookings and respond to customer requests.
Share offers with customers, where available under your account and subscription.

Next steps:
Log in to Book My Salon using your registered account.
Review your salon profile and contact details.
Add your services, prices, and salon photos.
Check your subscription status and activate an eligible plan if required.

We are excited to have you as a salon partner and wish you great success with Book My Salon!

Congratulations once again.

Warm regards,
Book My Salon Admin Team`;

    const htmlBody = `
      <p style="margin: 0 0 14px 0; font-size: 16px;">Hi <strong>${escapedName}</strong>,</p>

      <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; margin: 18px 0; text-align: center;">
        <span style="font-size: 32px; display: block; margin-bottom: 6px;">🎉</span>
        <h2 style="margin: 0 0 6px 0; color: #065F46; font-size: 20px; font-weight: 800;">Congratulations!</h2>
        <p style="margin: 0; color: #047857; font-size: 14px;">Your salon is now approved to join our platform.</p>
      </div>

      <p style="margin: 0 0 16px 0; line-height: 24px;">
        We're delighted to inform you that your salon registration has been approved by the Book My Salon admin team.
      </p>

      <div style="background-color: #FAF6F0; border-radius: 10px; padding: 18px; margin: 20px 0; border: 1px solid #EFE7DC;">
        <p style="margin: 0 0 10px 0; font-weight: 700; color: #30231F; font-size: 14px;">You can now:</p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px; line-height: 24px; color: #49413D; font-size: 14px;">
          <li>Access your salon owner account.</li>
          <li>Complete or update your salon profile.</li>
          <li>Add and manage your services and prices.</li>
          <li>Manage bookings and respond to customer requests.</li>
          <li>Share offers with customers, where available under your account and subscription.</li>
        </ul>

        <p style="margin: 0 0 10px 0; font-weight: 700; color: #30231F; font-size: 14px;">Next steps:</p>
        <ol style="margin: 0; padding-left: 20px; line-height: 24px; color: #49413D; font-size: 14px;">
          <li>Log in to Book My Salon using your registered account.</li>
          <li>Review your salon profile and contact details.</li>
          <li>Add your services, prices, and salon photos.</li>
          <li>Check your subscription status and activate an eligible plan if required.</li>
        </ol>
      </div>

      <p style="margin: 20px 0 8px 0; line-height: 24px;">
        We are excited to have you as a salon partner and wish you great success with Book My Salon!
      </p>
      <p style="margin: 0 0 24px 0; line-height: 24px; font-weight: 600; color: #30231F;">
        Congratulations once again.
      </p>

      <p style="margin: 0; color: #7A6E65; line-height: 22px;">
        Warm regards,<br>
        <strong style="color: #30231F;">Book My Salon Admin Team</strong>
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Registration Approved', htmlBody);

    // Decision-specific idempotency key
    const tsKey = decisionTimestamp ? decisionTimestamp.getTime() : 'initial';
    const idempotencyKey = `OWNER_APPLICATION_APPROVED:${salonId}:${tsKey}`;

    return this.sendEventEmailOnce({
      eventType: 'OWNER_APPLICATION_APPROVED',
      idempotencyKey,
      recipientEmail: to,
      referenceId: salonId,
      subject,
      text,
      html
    });
  },

  // =========================================================================
  // 4. Admin Rejects a Salon Owner Registration
  // =========================================================================
  async sendSalonRejectedEmail(
    to: string,
    ownerName: string,
    salonId: Types.ObjectId | string,
    rejectionReason: string,
    decisionTimestamp?: Date
  ): Promise<boolean> {
    const safeName = ownerName?.trim() || 'Salon Partner';
    const escapedName = escapeHtml(safeName);
    const safeReason = rejectionReason?.trim() || 'Incomplete documentation or verification requirements.';
    const escapedReason = escapeHtml(safeReason);

    const subject = 'Update Regarding Your Book My Salon Salon Registration';

    const text = `Hi ${safeName},

Thank you for your interest in joining Book My Salon.

After reviewing your salon registration, our admin team is unable to approve your application at this time.

Reason provided by our admin team:
${safeReason}

Please review the reason above and correct the relevant information or documents if resubmission is supported by the application.

If you need clarification, please contact our support team at ${SUPPORT_EMAIL}.

We appreciate your interest in Book My Salon and thank you for your understanding.

Warm regards,
Book My Salon Admin Team`;

    const htmlBody = `
      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${escapedName}</strong>,</p>

      <p style="margin: 0 0 16px 0; line-height: 24px;">
        Thank you for your interest in joining Book My Salon.
      </p>

      <p style="margin: 0 0 18px 0; line-height: 24px;">
        After reviewing your salon registration, our admin team is unable to approve your application at this time.
      </p>

      <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <span style="display: block; font-size: 11px; font-weight: 800; color: #991B1B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
          Reason provided by our admin team:
        </span>
        <p style="margin: 0; font-size: 15px; color: #7F1D1D; font-weight: 600; line-height: 22px;">
          ${escapedReason}
        </p>
      </div>

      <p style="margin: 0 0 16px 0; line-height: 24px;">
        Please review the reason above and correct the relevant information or documents if resubmission is supported by the application.
      </p>

      <p style="margin: 0 0 20px 0; line-height: 24px;">
        If you need clarification, please contact our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #B08D57; text-decoration: none; font-weight: 700;">${SUPPORT_EMAIL}</a>.
      </p>

      <p style="margin: 0 0 24px 0; line-height: 24px;">
        We appreciate your interest in Book My Salon and thank you for your understanding.
      </p>

      <p style="margin: 0; color: #7A6E65; line-height: 22px;">
        Warm regards,<br>
        <strong style="color: #30231F;">Book My Salon Admin Team</strong>
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Registration Decision', htmlBody);

    const tsKey = decisionTimestamp ? decisionTimestamp.getTime() : 'initial';
    const idempotencyKey = `OWNER_APPLICATION_REJECTED:${salonId}:${tsKey}`;

    return this.sendEventEmailOnce({
      eventType: 'OWNER_APPLICATION_REJECTED',
      idempotencyKey,
      recipientEmail: to,
      referenceId: salonId,
      subject,
      text,
      html
    });
  },

  // =========================================================================
  // 5. Existing Password Reset OTP Email (Preserved)
  // =========================================================================
  async sendPasswordResetOtp(to: string, otp: string, roleName: string, isGoogleAccount: boolean = false): Promise<void> {
    if (mockSender !== null) {
      lastSentOtp = { email: to, otp };
    }

    const subject = `Your Book My Salon Verification Code: ${otp}`;
    const googleNote = isGoogleAccount
      ? 'Note: Your account was created with Google Sign-In. You can continue signing in directly with Google without a password. If you wish to set a separate password for direct email login, use the verification code below.'
      : 'We received a request to reset the password for your account. Please use the 6-digit verification code below:';

    const text = `Hello,\n\n${googleNote}\n\nYour verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nFor your security, never share this code with anyone. If you did not request this, your account is safe and you can safely ignore this email.\n\nWarm regards,\nBook My Salon Security Team`;

    const htmlBody = `
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 20px 0;">
        ${escapeHtml(googleNote)}
      </p>
      
      <div style="margin: 28px 0; padding: 22px 16px; text-align: center; background-color: #F4EBDD; border-radius: 12px; border: 1px solid #EFE7DC;">
        <div style="font-size: 11px; font-weight: 700; color: #7A6E65; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">6-Digit Verification Code</div>
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #30231F; font-family: 'SF Pro Mono', Consolas, Menlo, monospace; display: inline-block;">${escapeHtml(otp)}</span>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0 0 0;">
        <tr>
          <td style="padding: 12px 14px; background-color: #FAF6F0; border-radius: 8px; border-left: 3px solid #B08D57;">
            <p style="color: #49413D; font-size: 13px; line-height: 20px; margin: 0;">
              ⏱️ This verification code is valid for <strong>5 minutes</strong>.
            </p>
          </td>
        </tr>
      </table>

      <p style="color: #7A6E65; font-size: 13px; line-height: 20px; margin: 20px 0 0 0;">
        For your security, never share this code with anyone. Book My Salon staff will never ask for your verification code.
      </p>
    `;

    const html = renderHtmlLayout(subject, `Security Verification • ${roleName.toUpperCase()}`, htmlBody);

    await this.sendEmail({ to, subject, text, html });
  },

  // =========================================================================
  // 6. Customer Registration Email Verification OTP
  // =========================================================================
  async sendEmailVerificationOtp(to: string, otp: string, customerName?: string): Promise<void> {
    const cleanTo = validateRecipientEmail(to);
    if (mockSender !== null) {
      lastSentOtp = { email: cleanTo, otp };
    }

    const safeName = customerName?.trim() || 'Valued Customer';
    const escapedName = escapeHtml(safeName);
    const subject = `Your Book My Salon Verification Code: ${otp}`;

    const text = `Hi ${safeName},\n\nThank you for starting your registration with Book My Salon!\n\nPlease enter the 6-digit verification code below to verify your email address and activate your account:\n\n${otp}\n\nThis verification code will expire in 10 minutes.\n\nFor your security, never share this code with anyone.\n\nWarm regards,\nBook My Salon Security Team`;

    const htmlBody = `
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">
        Hi <strong>${escapedName}</strong>,
      </p>
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 20px 0;">
        Thank you for starting your registration with <strong>Book My Salon</strong>! Please enter the 6-digit verification code below to verify your email address and activate your account:
      </p>
      
      <div style="margin: 28px 0; padding: 22px 16px; text-align: center; background-color: #F4EBDD; border-radius: 12px; border: 1px solid #EFE7DC;">
        <div style="font-size: 11px; font-weight: 700; color: #7A6E65; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">Email Verification Code</div>
        <span style="font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #30231F; font-family: 'SF Pro Mono', Consolas, Menlo, monospace; display: inline-block;">${escapeHtml(otp)}</span>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0 0 0;">
        <tr>
          <td style="padding: 12px 14px; background-color: #FAF6F0; border-radius: 8px; border-left: 3px solid #B08D57;">
            <p style="color: #49413D; font-size: 13px; line-height: 20px; margin: 0;">
              ⏱️ This verification code is valid for <strong>10 minutes</strong>.
            </p>
          </td>
        </tr>
      </table>

      <p style="color: #7A6E65; font-size: 13px; line-height: 20px; margin: 20px 0 0 0;">
        If you did not request this verification, you can safely ignore this email.
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Email Verification', htmlBody);

    console.info(`[Email] Sending EMAIL_VERIFICATION_OTP to ${cleanTo.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    await this.sendEmail({ to: cleanTo, subject, text, html });
  },

  // =========================================================================
  // 7. Account Deletion Scheduled (30-Day Grace Period)
  // =========================================================================
  async sendAccountDeletionScheduledEmail(to: string, userName: string, scheduledDate: Date): Promise<void> {
    const cleanTo = validateRecipientEmail(to);
    const safeName = userName?.trim() || 'Valued User';
    const escapedName = escapeHtml(safeName);
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const subject = 'Account Deletion Request Scheduled – Book My Salon';

    const text = `Hi ${safeName},\n\nWe have received a request to delete your Book My Salon account.\n\nYour account is now scheduled for deletion on ${formattedDate} (30-day grace period).\n\nIf you changed your mind, you can cancel this deletion request simply by logging back into your account at any time before ${formattedDate}.\n\nIf you did not request this, please log in immediately to secure and reactivate your account.\n\nWarm regards,\nBook My Salon Support Team`;

    const htmlBody = `
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">
        Hi <strong>${escapedName}</strong>,
      </p>
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">
        We have received a request to delete your Book My Salon account.
      </p>

      <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <span style="display: block; font-size: 11px; font-weight: 800; color: #991B1B; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">Scheduled Deletion Date</span>
        <span style="display: block; font-size: 18px; font-weight: 800; color: #7F1D1D;">⏳ ${formattedDate}</span>
      </div>

      <div style="background-color: #FAF6F0; border-left: 3px solid #B08D57; padding: 14px 16px; border-radius: 8px; margin: 18px 0;">
        <p style="color: #30231F; font-size: 14px; font-weight: 700; margin: 0 0 6px 0;">30-Day Grace Period Active</p>
        <p style="color: #49413D; font-size: 13px; line-height: 20px; margin: 0;">
          If you change your mind, simply <strong>log back into your account</strong> at any time during the next 30 days to cancel this request and restore full access immediately.
        </p>
      </div>

      <p style="color: #7A6E65; font-size: 13px; line-height: 20px; margin: 20px 0 0 0;">
        If you did not submit this request, please log in immediately to reactivate your account and secure your credentials.
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Account Deletion Request', htmlBody);

    console.info(`[Email] Sending ACCOUNT_DELETION_SCHEDULED to ${cleanTo.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    await this.sendEmail({ to: cleanTo, subject, text, html });
  },

  // =========================================================================
  // 8. Account Deletion Cancelled (Logged in during grace period)
  // =========================================================================
  async sendAccountDeletionCancelledEmail(to: string, userName: string, userId?: any): Promise<void> {
    const cleanTo = validateRecipientEmail(to);
    const safeName = userName?.trim() || 'Valued User';
    const escapedName = escapeHtml(safeName);

    const subject = 'Your Account Deletion Has Been Cancelled – Book My Salon';

    const text = `Hi ${safeName},\n\nWelcome back! Because you logged in to your Book My Salon account, your pending account deletion request has been cancelled.\n\nYour account remains active and in good standing. You can continue discovering salons and managing your appointments as usual.\n\nWarm regards,\nBook My Salon Support Team`;

    const htmlBody = `
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">
        Hi <strong>${escapedName}</strong>,
      </p>

      <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <span style="display: block; font-size: 11px; font-weight: 800; color: #065F46; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">Account Status</span>
        <span style="display: block; font-size: 18px; font-weight: 800; color: #047857;">✓ Deletion Cancelled & Account Active</span>
      </div>

      <p style="color: #49413D; font-size: 14px; line-height: 22px; margin: 0 0 16px 0;">
        Welcome back! Because you signed in during the 30-day grace period, your pending account deletion request has been automatically cancelled.
      </p>

      <p style="color: #49413D; font-size: 14px; line-height: 22px; margin: 0;">
        Your profile, appointments, and salon preferences remain completely intact and active.
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Account Status Notice', htmlBody);

    console.info(`[Email] Sending ACCOUNT_DELETION_CANCELLED to ${cleanTo.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    await this.sendEmail({ to: cleanTo, subject, text, html });
  },

  // =========================================================================
  // 9. Account Deletion Finalized (Completed after 30 days)
  // =========================================================================
  async sendAccountDeletionCompletedEmail(to: string, userName: string, userId?: any): Promise<void> {
    const cleanTo = validateRecipientEmail(to);
    const safeName = userName?.trim() || 'User';

    const subject = 'Your Book My Salon Account Has Been Deleted';

    const text = `Hi ${safeName},\n\nYour Book My Salon account has been permanently deleted as scheduled following the 30-day grace period.\n\nAll personal data has been erased in accordance with our Privacy Policy.\n\nThank you for having been part of Book My Salon.\n\nWarm regards,\nBook My Salon Team`;

    const htmlBody = `
      <p style="color: #49413D; font-size: 15px; line-height: 24px; margin: 0 0 16px 0;">
        Hi <strong>${escapeHtml(safeName)}</strong>,
      </p>
      <p style="color: #49413D; font-size: 14px; line-height: 22px; margin: 0 0 16px 0;">
        Your Book My Salon account has been permanently deleted as scheduled following the conclusion of the 30-day grace period.
      </p>
      <p style="color: #7A6E65; font-size: 13px; line-height: 20px; margin: 0;">
        All personal profile data has been securely deleted in accordance with our data privacy standards. Thank you for having been part of Book My Salon.
      </p>
    `;

    const html = renderHtmlLayout(subject, 'Account Deletion Finalized', htmlBody);

    console.info(`[Email] Sending ACCOUNT_DELETION_COMPLETED to ${cleanTo.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    await this.sendEmail({ to: cleanTo, subject, text, html });
  }
};
