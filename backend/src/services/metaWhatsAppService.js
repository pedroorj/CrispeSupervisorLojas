'use strict';

const axios = require('axios');
const env = require('../config/env');

function getApiUrl(phoneNumberId) {
  return `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function sendTextMessage(phoneNumberId, toWaId, text) {
  if (!env.META_ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN not configured.');
  }

  const url = getApiUrl(phoneNumberId);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  };

  const response = await axios.post(url, payload, { headers: getHeaders() });
  return response.data;
}

async function markMessageAsRead(phoneNumberId, messageId) {
  if (!env.META_ACCESS_TOKEN) return;
  const url = getApiUrl(phoneNumberId);
  await axios.post(
    url.replace('/messages', ''),
    { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
    { headers: getHeaders() }
  ).catch(() => {}); // non-critical
}

module.exports = { sendTextMessage, markMessageAsRead };
