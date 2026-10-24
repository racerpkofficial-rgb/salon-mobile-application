import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { ZodError, z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { User, UserDocument } from '../models/User.js';
import { Salon } from '../models/Salon.js';
import { issueToken } from '../services/token.service.js';
import { Role } from '../types/auth.js';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phone.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { isValidCoordinate, geocodeCity, normalizeCityName } from '../utils/location.js';
import { OAuth2Client } from 'google-auth-library';
import crypto, { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { emailService } from '../services/email.service.js';
import { adminNotificationService } from '../services/admin-notification.service.js';
import { Notification } from '../models/Notification.js';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest.js';

const router = Router();

function generateSecureOtp(): string {
  const buf = crypto.randomBytes(4);
  const num = (buf.readUInt32BE(0) % 900000) + 100000;
  return num.toString();
}

function hashVerificationOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp + env.JWT_SECRET).digest('hex');
}

const verifyEmailOtpSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  otp: z.string().trim().length(6, 'Verification code must be 6 digits')
});

const resendEmailOtpSchema = z.object({
  email: z.string().trim().email('Invalid email address')
});

const googleClient = new OAuth2Client();

// Password strength rule: min 8, max 128, 1 uppercase, 1 lowercase, 1 number, 1 special character
export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*(),.?":{}|<>_\-\\\/+=~`\[\]]/,
    'Password must contain at least one special character'
  );

const credentialsSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const customerRegistrationSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().email('Invalid email address'),
    password: strongPasswordSchema,
    confirmPassword: z.string().optional(),
    phone: z.string().trim().optional()
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
        return false;
      }
      return true;
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  );

const identityProofDocumentSchema = z.object({
  url: z.string().min(1, 'Identity proof document URL is required'),
  filename: z.string().min(1, 'Identity proof filename is required'),
  fileType: z.string().min(1, 'Identity proof file type is required'),
  fileSize: z.number().optional()
});

const salonOwnerRegistrationSchema = z
  .object({
    name: z.string().trim().min(2, 'Owner full name must be at least 2 characters').max(80),
    email: z.string().trim().email('Invalid email address'),
    phone: z.string().trim().min(1, 'Mobile number is required'),
    password: strongPasswordSchema,
    confirmPassword: z.string().optional(),
    salonName: z.string().trim().min(2, 'Salon name must be at least 2 characters').max(100),
    address: z.string().trim().min(3, 'Salon address is required'),
    city: z.string().trim().min(2, 'City is required'),
    state: z.string().trim().optional(),
    country: z.string().trim().default('India'),
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number()
      })
      .optional(),
    identityProof: identityProofDocumentSchema
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
        return false;
      }
      return true;
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  );

export function publicUser(user: any) {
  return {
    id: user.id ?? user._id?.toString() ?? '',
    name: user.name,
    email: user.email,
    phone: user.phone || undefined,
    address: user.address || undefined,
    city: user.city || undefined,
    searchRadius: user.searchRadius ?? 10,
    avatar: user.avatar || undefined,
    notificationPreferences: user.notificationPreferences || {
      bookingUpdates: true,
      reminders: true,
      promotions: true
    },
    role: user.role,
    authProvider: user.authProvider || 'LOCAL',
    hasCustomPassword: user.hasCustomPassword !== false,
    isEmailVerified: user.isEmailVerified !== false,
    isPendingDeletion: Boolean(user.isPendingDeletion),
    scheduledDeletionAt: user.scheduledDeletionAt || undefined
  };
}

const uploadDocumentMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
}).fields([
  { name: 'document', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/upload-document')) {
    return next();
  }

  const startedAt = Date.now();
  res.on('finish', () => {
    console.info('[Document Upload] API request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      elapsedMs: Date.now() - startedAt
    });
  });
  next();
});

router.post('/upload-document/signature', (req: Request, res: Response) => {
  if (!cloudinaryService.isAvailable()) {
    return res.status(503).json({ message: 'Private document storage is unavailable.' });
  }

  try {
    const { filename, fileType, fileSize } = z
      .object({
        filename: z.string().trim().min(1),
        fileType: z.string().trim().min(1),
        fileSize: z.coerce.number().int().positive()
      })
      .parse(req.body ?? {});

    return res.status(200).json(
      cloudinaryService.createIdentityDocumentUploadSignature({ filename, fileType, fileSize })
    );
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }
    return res.status(400).json({ message: error.message || 'Unable to prepare document upload.' });
  }
});

router.post('/upload-document/confirm', async (req: Request, res: Response) => {
  if (!cloudinaryService.isAvailable()) {
    return res.status(503).json({ message: 'Private document storage is unavailable.' });
  }

  try {
    const { publicId, filename, fileType, fileSize } = z
      .object({
        publicId: z.string().trim().min(1),
        filename: z.string().trim().min(1),
        fileType: z.string().trim().min(1),
        fileSize: z.coerce.number().int().positive()
      })
      .parse(req.body ?? {});
    const uploaded = await cloudinaryService.confirmIdentityDocumentUpload(publicId, {
      filename,
      fileType,
      fileSize
    });

    return res.status(200).json({
      url: uploaded.secureUrl,
      publicId: uploaded.publicId,
      filename: uploaded.filename,
      fileType: uploaded.fileType,
      fileSize: uploaded.fileSize
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') });
    }
    console.error('[Document Upload] Cloudinary confirmation failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError'
    });
    return res.status(502).json({ message: 'Cloudinary could not confirm the uploaded document.' });
  }
});

// POST /auth/upload-document - Upload identity proof document (JPG, PNG, WebP, PDF <= 10MB)
// Supports both multipart/form-data (FormData) and application/json ({ fileData, filename, fileType, fileSize })
router.post(
  '/upload-document',
  (req: Request, res: Response, next: NextFunction) => {
    uploadDocumentMiddleware(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Document file size exceeds 10MB limit' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ message: err.message || 'Error processing uploaded file' });
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFile = files?.document?.[0] || files?.file?.[0] || (req as any).file;
      const body = req.body ?? {};

      let fileData: string;
      let filename: string;
      let fileType: string;
      let fileSize: number | undefined;

      if (uploadedFile) {
        filename = (body.filename || uploadedFile.originalname || 'document.pdf').trim();
        fileType = (body.fileType || uploadedFile.mimetype || 'application/pdf').toLowerCase();
        fileSize = body.fileSize ? Number(body.fileSize) : uploadedFile.size;
        fileData = `data:${fileType};base64,${uploadedFile.buffer.toString('base64')}`;
      } else {
        fileData = body.fileData;
        filename = body.filename;
        fileType = body.fileType;
        fileSize = body.fileSize ? Number(body.fileSize) : undefined;
      }

      if (!filename || !fileType || !fileData) {
        return res.status(400).json({ message: 'Document file, filename, and fileType are required' });
      }

      const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
      const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
      const isMimeOk = allowedMime.includes(fileType.toLowerCase());
      const isExtOk = allowedExts.includes(ext);

      if (!isMimeOk && !isExtOk) {
        return res
          .status(400)
          .json({ message: 'Unsupported document format. Allowed formats: JPG, PNG, WebP, PDF' });
      }

      if (fileSize && fileSize > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'Document file size exceeds 10MB limit' });
      }

      const uploaded = await cloudinaryService.uploadDocument(fileData || '', {
        filename,
        fileType,
        fileSize
      });

      return res.status(200).json({
        url: uploaded.secureUrl || uploaded.url,
        publicId: uploaded.publicId,
        filename: uploaded.filename,
        fileType: uploaded.fileType,
        fileSize: uploaded.fileSize
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Failed to upload document' });
    }
  }
);

// POST /auth/register/customer
router.post('/register/customer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = customerRegistrationSchema.parse(req.body);
    const email = data.email.toLowerCase();

    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    let normalizedPhone: string | undefined = undefined;
    if (data.phone) {
      try {
        normalizedPhone = normalizePhoneNumber(data.phone);
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }
    }

    const otp = generateSecureOtp();
    const otpHash = hashVerificationOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      name: data.name,
      email,
      phone: normalizedPhone,
      passwordHash,
      role: 'CUSTOMER',
      isEmailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationAttempts: 0,
      emailVerificationLastSentAt: new Date()
    });

    try {
      await emailService.sendEmailVerificationOtp(user.email, user.name, otp);
    } catch (emailErr) {
      console.error('[Auth] Failed to send customer email verification OTP:', emailErr);
    }

    const responseUser = publicUser(user);
    return res.status(201).json({
      message: 'Registration successful. A 6-digit verification code has been sent to your email.',
      requiresVerification: true,
      email: user.email,
      token: issueToken({ sub: user.id, role: user.role }),
      user: responseUser
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/verify-email-otp
router.post('/verify-email-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = verifyEmailOtpSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const user = await User.findOne({ email }).select('+passwordHash +emailVerificationOtpHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified === true) {
      return res.status(200).json({
        message: 'Email is already verified',
        token: issueToken({ sub: user.id, role: user.role }),
        user: publicUser(user)
      });
    }

    // Rate limiting: Maximum 5 failed attempts
    if ((user.emailVerificationAttempts || 0) >= 5) {
      return res.status(429).json({
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Maximum verification attempts exceeded. Please request a new verification code.'
      });
    }

    // Check expiration (10 minutes)
    if (!user.emailVerificationExpiresAt || new Date() > user.emailVerificationExpiresAt) {
      return res.status(400).json({
        code: 'OTP_EXPIRED',
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    const hashedInput = hashVerificationOtp(data.otp);
    if (!user.emailVerificationOtpHash || user.emailVerificationOtpHash !== hashedInput) {
      user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
      await user.save();
      const attemptsRemaining = Math.max(0, 5 - user.emailVerificationAttempts);
      return res.status(400).json({
        code: 'INVALID_OTP',
        message: attemptsRemaining > 0
          ? `Incorrect verification code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect verification code. Maximum attempts reached. Please request a new code.',
        attemptsRemaining
      });
    }

    // Correct OTP: Mark email verified and clear verification fields
    user.isEmailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationAttempts = 0;
    user.emailVerificationLastSentAt = undefined;
    await user.save();

    // Send Welcome Email to verified customer now (Requirements 1 & 4)
    try {
      await emailService.sendCustomerWelcomeEmail(user.email, user.name, user._id);
    } catch (emailErr) {
      console.error('[Auth] Failed to send customer welcome email after verification:', emailErr);
    }

    return res.status(200).json({
      message: 'Email verified successfully',
      token: issueToken({ sub: user.id, role: user.role }),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/resend-email-otp
router.post('/resend-email-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = resendEmailOtpSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const user = await User.findOne({ email }).select('+emailVerificationOtpHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified === true) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Cooldown: 60 seconds
    const COOLDOWN_MS = 60 * 1000;
    if (user.emailVerificationLastSentAt) {
      const elapsed = Date.now() - user.emailVerificationLastSentAt.getTime();
      if (elapsed < COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          code: 'RESEND_COOLDOWN',
          message: `Please wait ${retryAfterSeconds}s before requesting a new verification code.`,
          retryAfterSeconds
        });
      }
    }

    const otp = generateSecureOtp();
    user.emailVerificationOtpHash = hashVerificationOtp(otp);
    user.emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.emailVerificationAttempts = 0;
    user.emailVerificationLastSentAt = new Date();
    await user.save();

    try {
      await emailService.sendEmailVerificationOtp(user.email, user.name, otp);
    } catch (emailErr: any) {
      console.error('[Auth] Failed to resend verification OTP:', emailErr?.message || emailErr);
      return res.status(500).json({ message: 'Failed to deliver verification code. Please check your email or try again.' });
    }

    return res.status(200).json({
      message: 'A new verification code has been sent to your email.',
      cooldownSeconds: 60
    });
  } catch (error) {
    next(error);
  }
});


router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, role: requestedRole } = z.object({
      idToken: z.string().min(1, 'Google ID token is required'),
      role: z.enum(['CUSTOMER', 'SALON_OWNER']).default('CUSTOMER')
    }).parse(req.body);

    const tokenParts = idToken.split('.');
    const isJwtFormat = tokenParts.length === 3;

    if (!isJwtFormat) {
      console.warn('[Auth Diagnostic] Received non-JWT token format in Google auth request (possibly an access token or malformed string)');
      return res.status(400).json({
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Google ID token is malformed. An OIDC ID token is required for authentication.'
      });
    }

    // Safely extract unverified claims solely for diagnostic logging (never for authentication)
    let unverifiedAudience: string | undefined;
    let unverifiedIssuer: string | undefined;
    let isTokenExpired = false;
    try {
      const unverifiedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
      if (typeof unverifiedPayload?.aud === 'string') {
        unverifiedAudience = unverifiedPayload.aud;
      } else if (Array.isArray(unverifiedPayload?.aud)) {
        unverifiedAudience = unverifiedPayload.aud.join(',');
      }
      if (typeof unverifiedPayload?.iss === 'string') {
        unverifiedIssuer = unverifiedPayload.iss;
      }
      if (typeof unverifiedPayload?.exp === 'number') {
        isTokenExpired = unverifiedPayload.exp * 1000 < Date.now();
      }
    } catch {
      // Diagnostic parsing failure is harmless; official verifier handles cryptographical verification
    }

    const webClientId = env.GOOGLE_CLIENT_ID;
    const androidClientId = env.GOOGLE_ANDROID_CLIENT_ID;

    const rawAudiences = [webClientId, androidClientId]
      .filter((id): id is string => Boolean(id && id.trim().length > 0))
      .flatMap((id) => id.split(',').map((s) => s.trim()))
      .filter((id) => id.length > 0);

    const allowedAudiences = [...new Set(rawAudiences)];

    if (allowedAudiences.length === 0) {
      console.error('[Auth Diagnostic] Google Sign-In failed: No Google Client IDs configured on server');
      return res.status(503).json({
        code: 'SERVER_MISCONFIGURED',
        message: 'Google Login is not configured on the server. Please configure GOOGLE_CLIENT_ID and GOOGLE_ANDROID_CLIENT_ID.'
      });
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: allowedAudiences
      });
    } catch (verifyError: any) {
      const errMsg = String(verifyError?.message || '');
      const isAudienceMismatch =
        errMsg.includes('Wrong recipient') ||
        errMsg.includes('payload audience != requiredAudience') ||
        (Boolean(unverifiedAudience) && !allowedAudiences.includes(unverifiedAudience!));
      const expired =
        isTokenExpired ||
        errMsg.includes('Token used too late') ||
        errMsg.includes('expired');

      console.error('[Auth Diagnostic] Google token verification failed:', {
        errorName: verifyError?.name,
        errorMessage: errMsg,
        isAudienceMismatch,
        isExpired: expired,
        tokenAudience: unverifiedAudience || 'unknown',
        tokenIssuer: unverifiedIssuer || 'unknown',
        configuredAudiencesCount: allowedAudiences.length
      });

      if (isAudienceMismatch) {
        return res.status(401).json({
          code: 'AUDIENCE_MISMATCH',
          message: 'Google token audience does not match server configuration. Please verify GOOGLE_ANDROID_CLIENT_ID and GOOGLE_CLIENT_ID on the server.'
        });
      }

      if (expired) {
        return res.status(401).json({
          code: 'TOKEN_EXPIRED',
          message: 'Google authentication token has expired. Please sign in again.'
        });
      }

      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid Google authentication token. Please sign in again.'
      });
    }

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({
        code: 'UNVERIFIED_EMAIL',
        message: 'Google account email could not be verified'
      });
    }

    const email = payload.email.toLowerCase().trim();

    let user = await User.findOne({ email }).select('+passwordHash');

    if (user) {
      if (user.role === 'SUPER_ADMIN') {
        return res.status(403).json({
          code: 'ROLE_MISMATCH',
          message: 'Super Admin accounts must use email and password credentials.'
        });
      }

      if (user.role !== requestedRole) {
        if (user.role === 'SALON_OWNER') {
          return res.status(403).json({
            code: 'ROLE_MISMATCH',
            message: 'These credentials belong to a salon account. Please use the Salon Owner login.'
          });
        }
        if (user.role === 'CUSTOMER') {
          return res.status(403).json({
            code: 'ROLE_MISMATCH',
            message: 'These credentials belong to a customer account. Please use Customer login.'
          });
        }
        return res.status(403).json({
          code: 'ROLE_MISMATCH',
          message: 'Account role mismatch. Please use your registered login.'
        });
      }

      if (user.isPendingDeletion) {
        if (user.scheduledDeletionAt && new Date() > user.scheduledDeletionAt) {
          return res.status(403).json({
            code: 'ACCOUNT_DELETED',
            message: 'This account has been deleted.'
          });
        }

        // Grace period cancellation: Re-activate account and cancel pending deletion
        user.isPendingDeletion = false;
        user.scheduledDeletionAt = undefined;
        user.deletionReason = undefined;
        user.deletionFeedback = undefined;
        user.isActive = true;
        await user.save();

        await AccountDeletionRequest.updateMany(
          { userId: user._id, status: 'PENDING' },
          { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'USER_LOGIN' }
        );

        try {
          await Notification.create({
            userId: user._id,
            title: 'Account Deletion Cancelled',
            message: 'Your deletion request has been cancelled because you logged in. Your account is active.',
            type: 'ACCOUNT_DELETION_CANCELLED'
          });
        } catch (notifErr) {
          console.error('[Auth] Failed to create deletion cancelled notification for Google user:', notifErr);
        }

        try {
          await emailService.sendAccountDeletionCancelledEmail(user.email, user.name, user._id);
        } catch (emailErr) {
          console.error('[Auth] Failed to send account deletion cancelled email for Google user:', emailErr);
        }
      }

      if (!user.isActive) {
        return res.status(403).json({
          code: 'ACCOUNT_INACTIVE',
          message: 'Your account is inactive. Please contact support.'
        });
      }

      let salonData: any = undefined;
      if (user.role === 'SALON_OWNER') {
        const salon = await Salon.findOne({ ownerId: user._id });
        if (salon) {
          salonData = {
            id: salon._id.toString(),
            salonName: salon.salonName,
            address: salon.address,
            city: salon.city,
            phone: salon.phone,
            email: salon.email,
            status: salon.status,
            subscriptionStatus: salon.subscriptionStatus
          };
        }
      }

      return res.json({
        token: issueToken({ sub: user.id, role: user.role }),
        user: publicUser(user),
        ...(salonData ? { salon: salonData } : {})
      });
    }

    // New user flow (email not in DB)
    if (requestedRole === 'CUSTOMER') {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

      try {
        user = await User.create({
          name: (payload.name?.trim() || email.split('@')[0]).slice(0, 80),
          email,
          passwordHash,
          role: 'CUSTOMER',
          isActive: true,
          isEmailVerified: true, // Google accounts have verified email
          authProvider: 'GOOGLE',
          hasCustomPassword: false
        });

        try {
          await emailService.sendCustomerWelcomeEmail(user.email, user.name, user._id);
        } catch (emailErr) {
          console.error('[Auth] Failed to send customer welcome email for Google user:', emailErr);
        }
      } catch (err: any) {
        if (err?.code === 11000) {
          user = await User.findOne({ email }).select('+passwordHash');
          if (!user) {
            return res.status(500).json({ message: 'Failed to complete Google Sign-In' });
          }
          if (user.role !== 'CUSTOMER') {
            return res.status(403).json({
              code: 'ROLE_MISMATCH',
              message: 'Account role mismatch. Please use your registered login.'
            });
          }
          if (!user.isActive) {
            return res.status(403).json({
              code: 'ACCOUNT_INACTIVE',
              message: 'Your account is inactive. Please contact support.'
            });
          }
        } else {
          throw err;
        }
      }

      return res.json({
        token: issueToken({ sub: user.id, role: user.role }),
        user: publicUser(user)
      });
    }

    // If requestedRole is SALON_OWNER and no user exists:
    // Requires owner onboarding to collect salon name, address, city, phone, and identity proof.
    return res.json({
      needsOnboarding: true,
      code: 'OWNER_ONBOARDING_REQUIRED',
      message: 'Salon partner account not found. Please complete the registration form with your salon details.',
      email,
      name: (payload.name?.trim() || email.split('@')[0]).slice(0, 80)
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/register/salon-owner
router.post('/register/salon-owner', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = salonOwnerRegistrationSchema.parse(req.body);
    const email = data.email.toLowerCase();

    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Validate phone number
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(data.phone);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }

    // Validate identity document format and size
    const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const docFilename = data.identityProof.filename;
    const docExt = docFilename.toLowerCase().slice(docFilename.lastIndexOf('.'));
    const isMimeOk = allowedMime.includes(data.identityProof.fileType.toLowerCase());
    const isExtOk = allowedExts.includes(docExt);

    if (!isMimeOk && !isExtOk) {
      return res
        .status(400)
        .json({ message: 'Unsupported document format. Allowed formats: JPG, PNG, PDF' });
    }

    if (data.identityProof.fileSize && data.identityProof.fileSize > 10 * 1024 * 1024) {
      return res.status(400).json({ message: 'Document file size exceeds 10MB limit' });
    }

    // Hash password securely with bcrypt cost 12
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create User record
    const user = await User.create({
      name: data.name,
      email,
      phone: normalizedPhone,
      passwordHash,
      role: 'SALON_OWNER'
    });

    // Coordinate determination & validation
    let salonCoordinates: { latitude: number; longitude: number } | undefined = undefined;
    if (data.location) {
      if (!isValidCoordinate(data.location.latitude, data.location.longitude)) {
        return res
          .status(400)
          .json({ message: 'Invalid latitude (-90 to 90) or longitude (-180 to 180) coordinates' });
      }
      salonCoordinates = {
        latitude: data.location.latitude,
        longitude: data.location.longitude
      };
    }
    const canonicalCity = normalizeCityName(data.city);
    if (!salonCoordinates) {
      const geo = geocodeCity(canonicalCity || data.city);
      if (geo) {
        salonCoordinates = geo;
      }
    }

    const canonicalState =
      data.state ||
      (canonicalCity === 'Tiruchirappalli' || canonicalCity === 'Chennai' || canonicalCity === 'Coimbatore' || canonicalCity === 'Madurai' || canonicalCity === 'Salem'
        ? 'Tamil Nadu'
        : canonicalCity === 'Bengaluru' || canonicalCity === 'Mysuru'
          ? 'Karnataka'
          : '');

    // Create Salon record in PENDING_APPROVAL status
    const salon = await Salon.create({
      ownerId: user._id,
      salonName: data.salonName,
      phone: normalizedPhone,
      email,
      address: data.address,
      city: canonicalCity,
      state: canonicalState,
      country: data.country || 'India',
      location: salonCoordinates,
      locationPoint: salonCoordinates
        ? {
            type: 'Point',
            coordinates: [salonCoordinates.longitude, salonCoordinates.latitude]
          }
        : undefined,
      description: '',
      identityProof: {
        url: data.identityProof.url,
        filename: data.identityProof.filename,
        fileType: data.identityProof.fileType,
        fileSize: data.identityProof.fileSize,
        uploadedAt: new Date()
      },
      status: 'PENDING_APPROVAL',
      subscriptionStatus: 'PENDING'
    });

    try {
      await emailService.sendOwnerWelcomeEmail(user.email, user.name, user._id, salon._id);
      await emailService.sendOwnerRegistrationReceivedEmail(user.email, user.name, salon._id);
    } catch (emailErr) {
      console.error('[Auth] Failed to send owner registration email:', emailErr);
    }

    try {
      await adminNotificationService.notifyAdmins({
        title: 'New Salon Owner Registration',
        message: `New salon owner ${user.name} registered salon "${salon.salonName}".`,
        type: 'ADMIN_NEW_SALON_REGISTRATION',
        relatedRecordId: salon._id.toString()
      });

      await adminNotificationService.notifyAdmins({
        title: 'Salon Verification Awaiting',
        message: `Salon "${salon.salonName}" uploaded identity proof (${data.identityProof.filename}) and is awaiting verification.`,
        type: 'ADMIN_SALON_VERIFICATION_AWAITING',
        relatedRecordId: salon._id.toString()
      });
    } catch (adminNotifErr) {
      console.error('[Auth] Failed to send admin notifications for new salon registration:', adminNotifErr);
    }

    const responseUser = publicUser(user);
    return res.status(201).json({
      token: issueToken({ sub: user.id, role: user.role }),
      user: responseUser,
      salon: {
        id: salon._id.toString(),
        salonName: salon.salonName,
        address: salon.address,
        city: salon.city,
        phone: salon.phone,
        email: salon.email,
        status: salon.status
      }
    });
  } catch (error) {
    next(error);
  }
});

async function handleRoleLogin(
  req: Request,
  res: Response,
  next: NextFunction,
  enforcedRole?: 'CUSTOMER' | 'SALON_OWNER'
) {
  try {
    const data = credentialsSchema.parse(req.body);
    const targetRole = enforcedRole || (req.body.expectedRole as 'CUSTOMER' | 'SALON_OWNER' | undefined);

    const user = await User.findOne({ email: data.email.toLowerCase() }).select('+passwordHash');

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check account deletion status (30-day grace period)
    let wasDeletionCancelled = false;
    if (user.isPendingDeletion) {
      if (user.scheduledDeletionAt && new Date() > user.scheduledDeletionAt) {
        return res.status(403).json({
          code: 'ACCOUNT_DELETED',
          message: 'This account has been deleted.'
        });
      }

      // User logged in within 30-day grace period: Auto-cancel pending deletion
      user.isPendingDeletion = false;
      user.scheduledDeletionAt = undefined;
      user.deletionReason = undefined;
      user.deletionFeedback = undefined;
      user.isActive = true;
      await user.save();
      wasDeletionCancelled = true;

      await AccountDeletionRequest.updateMany(
        { userId: user._id, status: 'PENDING' },
        { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'USER_LOGIN' }
      );

      try {
        await Notification.create({
          recipientId: user._id,
          title: 'Account Deletion Cancelled',
          message: 'Your deletion request has been cancelled because you logged in. Your account is active.',
          type: 'ACCOUNT_DELETION_CANCELLED'
        });
      } catch (notifErr) {
        console.error('[Auth] Failed to create deletion cancelled notification:', notifErr);
      }

      try {
        await emailService.sendAccountDeletionCancelledEmail(user.email, user.name, user._id);
      } catch (emailErr) {
        console.error('[Auth] Failed to send account deletion cancelled email:', emailErr);
      }
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Role checks
    if (targetRole === 'CUSTOMER') {
      if (user.role === 'SALON_OWNER') {
        return res.status(403).json({
          code: 'SALON_OWNER_CREDENTIALS',
          message: 'These credentials belong to a salon account. Please use the Salon Owner login.'
        });
      }
      if (user.role !== 'CUSTOMER' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          code: 'ROLE_MISMATCH',
          message: 'These credentials are not registered as a customer account.'
        });
      }
    } else if (targetRole === 'SALON_OWNER') {
      if (user.role === 'CUSTOMER') {
        return res.status(403).json({
          code: 'CUSTOMER_CREDENTIALS',
          message: 'These credentials belong to a customer account. Please use Customer login.'
        });
      }
      if (user.role !== 'SALON_OWNER' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          code: 'ROLE_MISMATCH',
          message: 'This account cannot be used for salon owner login.'
        });
      }
    }

    // Check customer email verification status
    if (user.role === 'CUSTOMER' && user.isEmailVerified === false) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address to access your account.',
        requiresVerification: true,
        email: user.email
      });
    }

    let salonData: any = undefined;
    if (user.role === 'SALON_OWNER') {
      const salon = await Salon.findOne({ ownerId: user._id });
      if (salon) {
        salonData = {
          id: salon._id.toString(),
          salonName: salon.salonName,
          address: salon.address,
          city: salon.city,
          phone: salon.phone,
          email: salon.email,
          status: salon.status,
          subscriptionStatus: salon.subscriptionStatus
        };
      }
    }

    return res.json({
      token: issueToken({ sub: user.id, role: user.role }),
      user: publicUser(user),
      ...(wasDeletionCancelled ? { deletionCancelled: true } : {}),
      ...(salonData ? { salon: salonData } : {})
    });
  } catch (error) {
    next(error);
  }
}

// POST /auth/customer/login
router.post('/customer/login', (req: Request, res: Response, next: NextFunction) =>
  handleRoleLogin(req, res, next, 'CUSTOMER')
);

// POST /auth/salon-owner/login and /auth/owner/login
router.post(['/salon-owner/login', '/owner/login'], (req: Request, res: Response, next: NextFunction) =>
  handleRoleLogin(req, res, next, 'SALON_OWNER')
);

// POST /auth/login (supports req.body.expectedRole or fallback)
router.post('/login', (req: Request, res: Response, next: NextFunction) =>
  handleRoleLogin(req, res, next)
);

// Admin registration forbidden
router.post(['/register/super-admin', '/register/admin'], (_req, res) =>
  res.status(403).json({ message: 'Super admin cannot be registered via API' })
);

// GET /auth/me - Current authenticated user
router.get('/me', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.id).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

function hashOtpOrToken(val: string): string {
  return crypto.createHash('sha256').update(val + env.JWT_SECRET).digest('hex');
}

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  role: z.enum(['CUSTOMER', 'SALON_OWNER', 'SUPER_ADMIN']).default('CUSTOMER')
});

const verifyResetOtpSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  otp: z.string().trim().length(6, 'Verification code must be 6 digits'),
  role: z.enum(['CUSTOMER', 'SALON_OWNER', 'SUPER_ADMIN']).default('CUSTOMER')
});

const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(1, 'Reset authorization token is required'),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().optional()
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== data.newPassword) {
        return false;
      }
      return true;
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  );

const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    otp: z.string().optional(),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().optional()
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== data.newPassword) {
        return false;
      }
      return true;
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  );

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, role } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    if (!emailService.isConfigured()) {
      return res.status(503).json({
        code: 'EMAIL_SERVICE_NOT_CONFIGURED',
        message: 'Email delivery service is not configured on the server. Please contact support.'
      });
    }

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({
        code: 'ADMIN_RECOVERY_RESTRICTED',
        message: 'Password recovery for Administrator accounts is not permitted via mobile self-service. Please contact system administrator.'
      });
    }

    // Rate limiting: max 5 requests per 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequests = await PasswordReset.countDocuments({
      email: normalizedEmail,
      role,
      createdAt: { $gte: fifteenMinutesAgo }
    });

    if (recentRequests >= 5) {
      return res.status(429).json({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many password reset requests. Please wait 15 minutes before trying again.'
      });
    }

    // Resend cooldown: 60 seconds
    const latestReset = await PasswordReset.findOne({
      email: normalizedEmail,
      role,
      consumed: false
    }).sort({ createdAt: -1 });

    if (latestReset && latestReset.lastResendAt) {
      const elapsedSeconds = (Date.now() - latestReset.lastResendAt.getTime()) / 1000;
      const COOLDOWN_SECONDS = 60;
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
        return res.status(429).json({
          code: 'RESEND_COOLDOWN',
          message: `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before requesting a new code.`,
          cooldownSeconds: remaining
        });
      }
    }

    const genericResponse = {
      message: 'If an account exists with this email, a 6-digit verification code has been sent.',
      email: normalizedEmail
    };

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user || user.role !== role || !user.isActive) {
      return res.json(genericResponse);
    }

    // Invalidate prior unconsumed reset attempts for this user
    await PasswordReset.updateMany({ userId: user._id, consumed: false }, { consumed: true });

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtpOrToken(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const resetRecord = await PasswordReset.create({
      userId: user._id,
      email: normalizedEmail,
      role: user.role,
      otpHash,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      lastResendAt: new Date(),
      consumed: false
    });

    const roleName = user.role === 'SALON_OWNER' ? 'Salon Owner' : 'Customer';
    const isGoogleAccount = user.authProvider === 'GOOGLE' && !user.hasCustomPassword;

    try {
      await emailService.sendPasswordResetOtp(user.email, otp, roleName, isGoogleAccount);
    } catch (deliveryError: any) {
      await PasswordReset.deleteOne({ _id: resetRecord._id });
      const safeMessage = deliveryError instanceof Error ? deliveryError.message : 'SMTP delivery error';
      console.error(`[EmailService] Failed to deliver password reset OTP email: ${safeMessage}`);
      return res.status(503).json({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Failed to deliver verification code email. Please check server email delivery configuration.'
      });
    }

    return res.json(genericResponse);
  } catch (error) {
    next(error);
  }
});

// POST /auth/verify-reset-otp
router.post('/verify-reset-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, role } = verifyResetOtpSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({
        code: 'ADMIN_RECOVERY_RESTRICTED',
        message: 'Password recovery for Administrator accounts is not permitted via mobile self-service.'
      });
    }

    const resetRecord = await PasswordReset.findOne({
      email: normalizedEmail,
      role,
      consumed: false
    }).sort({ createdAt: -1 });

    if (!resetRecord) {
      return res.status(400).json({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'Invalid or expired verification code. Please request a new code.'
      });
    }

    if (resetRecord.expiresAt < new Date()) {
      resetRecord.consumed = true;
      await resetRecord.save();
      return res.status(400).json({
        code: 'OTP_EXPIRED',
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    if (resetRecord.attempts >= resetRecord.maxAttempts) {
      resetRecord.consumed = true;
      await resetRecord.save();
      return res.status(429).json({
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Maximum verification attempts exceeded. Please request a new code.'
      });
    }

    resetRecord.attempts += 1;
    const expectedOtpHash = hashOtpOrToken(otp);

    if (resetRecord.otpHash !== expectedOtpHash) {
      const remainingAttempts = Math.max(0, resetRecord.maxAttempts - resetRecord.attempts);
      if (remainingAttempts === 0) {
        resetRecord.consumed = true;
      }
      await resetRecord.save();

      if (remainingAttempts === 0) {
        return res.status(429).json({
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum verification attempts exceeded. Please request a new code.',
          remainingAttempts: 0
        });
      }

      return res.status(400).json({
        code: 'INVALID_OTP',
        message: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
        remainingAttempts
      });
    }

    // OTP verified: generate single-use reset authorization token (15-min validity)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashOtpOrToken(resetToken);
    resetRecord.resetTokenHash = resetTokenHash;
    resetRecord.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await resetRecord.save();

    return res.json({
      message: 'Verification code verified successfully',
      resetToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resetToken, newPassword } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashOtpOrToken(resetToken);

    const resetRecord = await PasswordReset.findOne({
      resetTokenHash: tokenHash,
      consumed: false
    }).select('+resetTokenHash');

    if (!resetRecord) {
      return res.status(400).json({
        code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
        message: 'Invalid or already consumed password reset token. Please request a new code.'
      });
    }

    if (!resetRecord.resetTokenExpiresAt || resetRecord.resetTokenExpiresAt < new Date()) {
      resetRecord.consumed = true;
      await resetRecord.save();
      return res.status(400).json({
        code: 'RESET_TOKEN_EXPIRED',
        message: 'Password reset session has expired. Please request a new code.'
      });
    }

    const user = await User.findById(resetRecord.userId).select('+passwordHash');
    if (!user || !user.isActive) {
      resetRecord.consumed = true;
      await resetRecord.save();
      return res.status(400).json({
        code: 'USER_NOT_FOUND',
        message: 'User account not found or inactive.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = passwordHash;
    user.hasCustomPassword = true;
    await user.save();

    resetRecord.consumed = true;
    resetRecord.resetTokenHash = undefined;
    await resetRecord.save();
    await PasswordReset.updateMany({ userId: user._id, consumed: false }, { consumed: true });

    return res.json({
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /auth/change-password
router.put('/change-password', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, otp, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.auth!.id).select('+passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const isGoogleAccountWithoutPassword = user.authProvider === 'GOOGLE' && !user.hasCustomPassword;

    if (isGoogleAccountWithoutPassword) {
      if (!otp) {
        return res.status(400).json({
          code: 'OTP_REQUIRED',
          message: 'Since this account was registered via Google, an email verification code is required to establish a password.'
        });
      }

      const resetRecord = await PasswordReset.findOne({
        userId: user._id,
        consumed: false
      }).sort({ createdAt: -1 });

      if (!resetRecord) {
        return res.status(400).json({
          code: 'INVALID_OR_EXPIRED_OTP',
          message: 'No active verification code found. Please request a verification code.'
        });
      }

      if (resetRecord.expiresAt < new Date()) {
        resetRecord.consumed = true;
        await resetRecord.save();
        return res.status(400).json({
          code: 'OTP_EXPIRED',
          message: 'Verification code has expired. Please request a new code.'
        });
      }

      if (resetRecord.attempts >= resetRecord.maxAttempts) {
        resetRecord.consumed = true;
        await resetRecord.save();
        return res.status(429).json({
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum verification attempts exceeded. Please request a new code.'
        });
      }

      resetRecord.attempts += 1;
      const expectedHash = hashOtpOrToken(otp);

      if (resetRecord.otpHash !== expectedHash) {
        const remaining = Math.max(0, resetRecord.maxAttempts - resetRecord.attempts);
        if (remaining === 0) {
          resetRecord.consumed = true;
        }
        await resetRecord.save();
        if (remaining === 0) {
          return res.status(429).json({
            code: 'MAX_ATTEMPTS_EXCEEDED',
            message: 'Maximum verification attempts exceeded. Please request a new code.',
            remainingAttempts: 0
          });
        }
        return res.status(400).json({
          code: 'INVALID_OTP',
          message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
          remainingAttempts: remaining
        });
      }

      resetRecord.consumed = true;
      await resetRecord.save();
    } else {
      if (!currentPassword) {
        return res.status(400).json({
          code: 'CURRENT_PASSWORD_REQUIRED',
          message: 'Current password is required.'
        });
      }

      const isValidCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidCurrent) {
        return res.status(400).json({
          code: 'INCORRECT_CURRENT_PASSWORD',
          message: 'Current password is incorrect.'
        });
      }

      const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
      if (isSameAsCurrent) {
        return res.status(400).json({
          code: 'PASSWORD_REUSED',
          message: 'New password cannot be the same as your current password.'
        });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = passwordHash;
    user.hasCustomPassword = true;
    await user.save();

    return res.json({
      message: 'Password changed successfully.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/request-setup-password-otp - Authenticated OTP request for Google users
router.post('/request-setup-password-otp', requireAuth(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({
        code: 'EMAIL_SERVICE_NOT_CONFIGURED',
        message: 'Email delivery service is not configured on the server. Please contact support.'
      });
    }

    // Cooldown check (60s)
    const latestReset = await PasswordReset.findOne({
      userId: user._id,
      consumed: false
    }).sort({ createdAt: -1 });

    if (latestReset && latestReset.lastResendAt) {
      const elapsedSeconds = (Date.now() - latestReset.lastResendAt.getTime()) / 1000;
      if (elapsedSeconds < 60) {
        const remaining = Math.ceil(60 - elapsedSeconds);
        return res.status(429).json({
          code: 'RESEND_COOLDOWN',
          message: `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before requesting a new code.`,
          cooldownSeconds: remaining
        });
      }
    }

    await PasswordReset.updateMany({ userId: user._id, consumed: false }, { consumed: true });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtpOrToken(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const resetRecord = await PasswordReset.create({
      userId: user._id,
      email: user.email,
      role: user.role,
      otpHash,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      lastResendAt: new Date(),
      consumed: false
    });

    const roleName = user.role === 'SALON_OWNER' ? 'Salon Owner' : 'Customer';
    try {
      await emailService.sendPasswordResetOtp(user.email, otp, roleName, true);
    } catch (deliveryError: any) {
      await PasswordReset.deleteOne({ _id: resetRecord._id });
      const safeMessage = deliveryError instanceof Error ? deliveryError.message : 'SMTP delivery error';
      console.error(`[EmailService] Failed to deliver setup-password OTP email: ${safeMessage}`);
      return res.status(503).json({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Failed to deliver verification code email. Please check server email delivery configuration.'
      });
    }

    return res.json({
      message: 'Verification code sent to your email.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
router.post('/logout', requireAuth(), (_req, res) => res.status(204).send());

export default router;