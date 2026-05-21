'use strict';

const prisma = require('../db/prismaClient');
const env = require('../config/env');
const { sendPushToUser } = require('../services/pushNotificationService');

async function getVapidKey(req, res) {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY || null });
}

async function subscribe(req, res, next) {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Dados de assinatura inválidos.' });
    }

    // Deactivate existing subscription with same endpoint
    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { active: false },
    });

    const sub = await prisma.pushSubscription.create({
      data: {
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent']?.slice(0, 500) || null,
        active: true,
      },
    });

    res.status(201).json({ id: sub.id });
  } catch (err) {
    next(err);
  }
}

async function unsubscribe(req, res, next) {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.updateMany({
      where: { userId: req.user.id, endpoint },
      data: { active: false },
    });
    res.json({ message: 'Assinatura removida.' });
  } catch (err) {
    next(err);
  }
}

async function testPush(req, res, next) {
  try {
    await sendPushToUser(
      req.user.id,
      'Teste de Notificação',
      'As notificações estão funcionando!'
    );
    res.json({ message: 'Push de teste enviado.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getVapidKey, subscribe, unsubscribe, testPush };
