import { Router } from 'express';
import { SUBSCRIPTION_PLANS } from '../config/plans.js';

const router = Router();

// GET /api/v1/subscriptions/plans - Public list of subscription plans & pricing
router.get('/plans', (_req, res) => {
  res.json({
    data: Object.values(SUBSCRIPTION_PLANS)
  });
});

export default router;
