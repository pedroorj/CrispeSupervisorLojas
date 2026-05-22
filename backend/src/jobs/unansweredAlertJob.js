'use strict';

// node-cron is incompatible with Hostinger shared hosting (PANIC: timer has gone away).
// setInterval also holds a libuv timer handle permanently, consuming one timerfd slot.
// Hostinger shared hosting has a very low timerfd limit — exhausting it triggers PANIC.
// Self-rescheduling setTimeout releases the handle after each fire, so at most 1 slot
// is active at any moment instead of a permanent reservation.

const prisma = require('../db/prismaClient');
const { notifyUnanswered } = require('../services/pushNotificationService');
const env = require('../config/env');

async function runAlertCheck() {
  try {
    const thresholdMinutes = env.ALERT_UNANSWERED_AFTER_MINUTES;
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const conversations = await prisma.conversation.findMany({
      where: {
        status: 'waiting_store_response',
        lastCustomerMessageAt: { lte: cutoff },
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
}

function startUnansweredAlertJob() {
  function scheduleNext() {
    setTimeout(async () => {
      await runAlertCheck().catch((err) =>
        console.error('[UnansweredAlertJob] Error:', err.message)
      );
      scheduleNext();
    }, 5 * 60 * 1000);
  }
  scheduleNext();
  console.log('[Jobs] Unanswered alert job started (every 5 minutes).');
}

module.exports = { startUnansweredAlertJob };
