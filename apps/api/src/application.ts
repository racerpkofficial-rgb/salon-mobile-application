import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import salonRoutes from './routes/salon.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import adminRoutes from './routes/admin.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import offerRoutes from './routes/offer.routes.js';
import reviewRoutes from './routes/review.routes.js';

export const app = express();

const corsOrigin =
  env.CORS_ORIGIN === '*'
    ? '*'
    : env.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const webDir = fs.existsSync(path.resolve(process.cwd(), 'apps/web/dist'))
  ? path.resolve(process.cwd(), 'apps/web/dist')
  : fs.existsSync(path.resolve(process.cwd(), 'apps/web'))
  ? path.resolve(process.cwd(), 'apps/web')
  : path.resolve(process.cwd(), '../web');

app.use(express.static(webDir));
app.get('/terms', (_req, res) => res.sendFile(path.join(webDir, 'terms.html')));
app.get('/privacy', (_req, res) => res.sendFile(path.join(webDir, 'privacy.html')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', profileRoutes);
app.use('/api/v1', appointmentRoutes);
app.use('/api/v1', reviewRoutes);
app.use('/api/v1', offerRoutes);
app.use('/api/v1/salons', salonRoutes);
app.use('/api/v1/owner', ownerRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    const message = error.issues.map((i) => i.message).join(', ') || 'Validation error';
    return res.status(400).json({ message });
  }
  if ((error as { code?: number })?.code === 11000) {
    const keyPattern = (error as any)?.keyPattern;
    if (keyPattern?.appointmentId) {
      return res.status(409).json({ message: 'A review for this booking has already been submitted.' });
    }
    if (keyPattern?.email) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    return res.status(409).json({ message: 'Duplicate record already exists.' });
  }
  const status = typeof (error as { status?: number })?.status === 'number' ? (error as { status?: number }).status! : 400;
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return res.status(status).json({ message });
});
