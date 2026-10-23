import crypto from 'crypto';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest.js';
import { Appointment } from '../models/Appointment.js';
import { Notification } from '../models/Notification.js';
import { Review } from '../models/Review.js';
import { Salon } from '../models/Salon.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { emailService } from './email.service.js';

export interface DeletionProcessResult {
  processed: number;
  completed: number;
  skipped: number;
  errors: Array<{ userId: string; error: string }>;
}

export const accountDeletionService = {
  /**
   * Idempotent server-side worker that purges accounts whose 30-day grace period has elapsed.
   * Can be executed by Vercel Cron, background timer, or manual admin action.
   */
  async processScheduledDeletions(): Promise<DeletionProcessResult> {
    const now = new Date();
    const pendingRequests = await AccountDeletionRequest.find({
      status: 'PENDING',
      scheduledDeletionAt: { $lte: now }
    });

    const result: DeletionProcessResult = {
      processed: pendingRequests.length,
      completed: 0,
      skipped: 0,
      errors: []
    };

    console.info(`[Account Deletion Worker] Found ${pendingRequests.length} pending deletion request(s) eligible for processing.`);

    for (const req of pendingRequests) {
      try {
        const user = await User.findById(req.userId).select('+passwordHash');
        if (!user) {
          // User already removed or missing, mark completed
          req.status = 'COMPLETED';
          req.completedAt = new Date();
          await req.save();
          result.completed += 1;
          continue;
        }

        // 1. Critical Security: Never purge SUPER_ADMIN accounts
        if (user.role === 'SUPER_ADMIN') {
          console.warn(`[Account Deletion Worker] Skipped SUPER_ADMIN account: ${user.email}`);
          req.status = 'CANCELLED';
          req.cancelledAt = new Date();
          await req.save();
          result.skipped += 1;
          continue;
        }

        // 2. Send final deletion confirmation email before scrubbing PII
        const originalEmail = user.email;
        const originalName = user.name;
        try {
          await emailService.sendAccountDeletionCompletedEmail(originalEmail, originalName);
        } catch (emailErr) {
          console.warn(`[Account Deletion Worker] Could not send completion email to ${originalEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')}:`, emailErr);
        }

        // 3. Role-based data retention & anonymization policy
        if (user.role === 'CUSTOMER') {
          // Preserve financial and booking history for salon partners, but redact customer PII
          await Appointment.updateMany(
            { customerId: user._id },
            {
              $set: {
                customerNote: '[Account Permanently Deleted]'
              }
            }
          );

          // Anonymize reviews to preserve salon ratings while removing author identity
          await Review.updateMany(
            { customerId: user._id },
            {
              $set: {
                authorName: 'Former Customer'
              }
            }
          );
        } else if (user.role === 'SALON_OWNER') {
          const salon = await Salon.findOne({ ownerId: user._id });
          if (salon) {
            // Cancel any active subscriptions
            if (salon.subscriptionId) {
              await Subscription.findByIdAndUpdate(salon.subscriptionId, { status: 'CANCELLED' });
            }
            salon.status = 'SUSPENDED';
            salon.subscriptionStatus = 'CANCELLED';
            salon.description = '[Salon Partner Account Closed]';
            await salon.save();
          }
        }

        // 4. Remove user notifications & device push tokens
        await Notification.deleteMany({ recipientId: user._id });

        // 5. Redact all Personally Identifiable Information (PII) from user document
        const anonymizedIdentifier = crypto.randomBytes(8).toString('hex');
        user.name = 'Deleted User';
        user.email = `deleted_${user._id}_${anonymizedIdentifier}@deleted.internal`;
        user.passwordHash = `PURGED_${crypto.randomBytes(32).toString('hex')}`;
        user.phone = undefined;
        user.address = undefined;
        user.city = undefined;
        user.avatar = undefined;
        user.fcmTokens = [];
        user.isActive = false;
        user.isPendingDeletion = false;
        user.scheduledDeletionAt = undefined;
        user.deletionReason = undefined;
        user.deletionFeedback = undefined;
        await user.save();

        // 6. Finalize request record
        req.status = 'COMPLETED';
        req.completedAt = new Date();
        await req.save();

        result.completed += 1;
        console.info(`[Account Deletion Worker] Successfully finalized account deletion for record: ${req._id} (Role: ${req.role})`);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Account Deletion Worker] Failed processing deletion for user ${req.userId}:`, msg);
        result.errors.push({ userId: req.userId.toString(), error: msg });
      }
    }

    return result;
  }
};

export const processScheduledAccountDeletions = () => accountDeletionService.processScheduledDeletions();
