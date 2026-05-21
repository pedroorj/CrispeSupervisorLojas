'use strict';

const cron = require('node-cron');
const prisma = require('../db/prismaClient');
const { notifyUnanswered } = require('../services/pushNotificationService');
const env = require('../config/env');

function startUnansweredAlertJob() {
  // Check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const thresholdMinutes = env.ALERT_UNANSWERED_AFTER_MINUTES;
      const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const conversations = await prisma.conversation.findMany({
        where: {
          status: 'waiting_store_response',
          lastCustomerMessageAt: { lte: cutoff },
          // Only alert if still within free window (still actionable)
          freeWindowExpiresAt: { gt: new Date() },
        },
        include: {
          contact: { select: { profileName: true, waId: true } },
          store: { select: { displayName: true } },
        },
      });

      for (const conv of conversations) {
        const minutes = Math.round(
          (Date.now() - new Date(conv.lastCustomerMessageAt).getTime()) / 60000
        );
        const contactName = conv.contact.profileName || conv.contact.waId;
        await notifyUnanswered(conv.store.displayName, contactName, minutes, conv.id);
      }
    } catch (err) {
      console.error('[UnansweredAlertJob] Error:', err.message);
    }
  });

  console.log('[Jobs] Unanswered alert job started (every 5 minutes).');
}

module.exports = { startUnansweredAlertJob };
