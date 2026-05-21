'use strict';

const env = require('../config/env');
const { processWebhookPayload } = require('../services/webhookParserService');

function verify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully.');
    return res.status(200).send(challenge);
  }
  console.warn('[Webhook] Verification failed — token mismatch.');
  return res.status(403).json({ error: 'Forbidden' });
}

function receive(req, res) {
  // Respond 200 immediately — Meta requires fast response
  res.status(200).json({ status: 'ok' });

  // Process async — do not await
  processWebhookPayload(req.body).catch((err) => {
    console.error('[Webhook] processWebhookPayload error:', err.message);
  });
}

module.exports = { verify, receive };
