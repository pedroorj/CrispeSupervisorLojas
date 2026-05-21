'use strict';

const webpush = require('web-push');
const env = require('../config/env');
const prisma = require('../db/prismaClient');

let vapidConfigured = false;

function initVapid() {
  if (vapidConfigured) return;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  } else {
    console.warn('[Push] VAPID keys not configured — push notifications disabled.');
  }
}

initVapid();

async function sendPushToUser(userId, title, body, url = '/') {
  if (!vapidConfigured) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId, active: true },
  });

  const payload = JSON.stringify({ title, body, url });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — deactivate
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { active: false } });
      } else {
        console.error('[Push] sendNotification error:', err.message);
      }
    }
  }
}

async function broadcastPush(title, body, url = '/') {
  if (!vapidConfigured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { active: true } });
  const payload = JSON.stringify({ title, body, url });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { active: false } });
      }
    }
  }
}

// Notify owner/manager roles about new inbound message
async function notifyNewMessage(storeDisplayName, contactName, messagePreview, conversationId) {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ['owner', 'manager'] } },
    select: { id: true },
  });
  const url = `/conversations/${conversationId}`;
  for (const u of users) {
    await sendPushToUser(
      u.id,
      `Nova mensagem - ${storeDisplayName}`,
      `${contactName}: ${messagePreview}`,
      url
    );
  }
}

// Notify owners/managers about unanswered conversation
async function notifyUnanswered(storeDisplayName, contactName, minutes, conversationId) {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ['owner', 'manager'] } },
    select: { id: true },
  });
  const url = `/conversations/${conversationId}`;
  for (const u of users) {
    await sendPushToUser(
      u.id,
      `Cliente aguardando resposta - ${storeDisplayName}`,
      `${contactName} está sem resposta há ${minutes} minutos.`,
      url
    );
  }
}

module.exports = { sendPushToUser, broadcastPush, notifyNewMessage, notifyUnanswered, initVapid };
