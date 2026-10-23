import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { processScheduledAccountDeletions } from '../services/account-deletion.service.js';

const router = Router();

function verifyCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = (env.CRON_SECRET || 'book_my_salon_cron_default_secret_2026').trim();
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const headerSecret = (req.headers['x-cron-secret'] as string | undefined)?.trim();
  const querySecret = (req.query.secret as string | undefined)?.trim();

  const incomingToken = bearerToken || headerSecret || querySecret;

  if (!incomingToken || incomingToken !== secret) {
    console.warn('[Cron] Unauthorized cron invocation attempt');
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }

  next();
}

// Support both GET (default for Vercel Cron) and POST
router.all('/process-deletions', verifyCronSecret, async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[Cron] Executing scheduled account deletions worker...');
    const result = await processScheduledAccountDeletions();
    console.log('[Cron] Account deletion worker finished successfully:', {
      processed: result.processed,
      completed: result.completed,
      errorsCount: result.errors.length
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error: any) {
    console.error('[Cron] Error executing scheduled account deletions worker:', error?.message || error);
    next(error);
  }
});

export default router;
