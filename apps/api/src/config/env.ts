import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from apps/api directory or current working directory
const envPath = typeof __dirname !== 'undefined'
  ? path.resolve(__dirname, '../../.env')
  : path.resolve(process.cwd(), 'apps/api/.env');
dotenv.config({ path: envPath, override: true });
dotenv.config();

const booleanEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return false;
  });

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(12).optional(),
  SUPER_ADMIN_NAME: z.string().min(2).optional(),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_aurelia_sandbox'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_aurelia_key_2026'),
  CORS_ORIGIN: z.string().default('*'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  SMTP_SECURE: booleanEnv,
  SMTP_TLS_REJECT_UNAUTHORIZED: booleanEnv,
  CRON_SECRET: z.string().optional()
});

const parsedEnv = schema.safeParse(process.env);

if (!parsedEnv.success) {
  const invalidVariables = [
    ...new Set(
      parsedEnv.error.issues
        .map((issue) => issue.path[0])
        .filter((key): key is string => typeof key === 'string')
    )
  ];
  console.error('[API] Environment validation failed', {
    invalidVariables,
    issueCodes: [...new Set(parsedEnv.error.issues.map((issue) => issue.code))]
  });
  throw new Error('Invalid API environment configuration');
}

console.info('[API] Environment validation passed');
export const env = parsedEnv.data;