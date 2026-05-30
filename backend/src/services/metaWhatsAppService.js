'use strict';

const axios = require('axios');
const FormData = require('form-data');
const env = require('../config/env');

function getApiUrl(phoneNumberId) {
  return `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

function getAuthHeaders() {
  return { Authorization: `Bearer ${env.META_ACCESS_TOKEN}` };
}

function getJsonHeaders() {
  return { ...getAuthHeaders(), 'Content-Type': 'application/json' };
}

async function sendTextMessage(phoneNumberId, toWaId, text) {
  if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN not configured.');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type: 'text',
    text: { preview_url: false, body: text },
  };

  const response = await axios.post(getApiUrl(phoneNumberId), payload, { headers: getJsonHeaders() });
  return response.data;
}

// Upload a file buffer to Meta and return the mediaId.
async function uploadMedia(phoneNumberId, buffer, mimeType, filename) {
  if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN not configured.');

  const url = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${phoneNumberId}/media`;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', buffer, { filename, contentType: mimeType });

  const response = await axios.post(url, form, {
    headers: { ...getAuthHeaders(), ...form.getHeaders() },
  });
  return response.data; // { id: "media_id" }
}

// Send an image, video, document or audio message using an already-uploaded mediaId.
async function sendMediaMessage(phoneNumberId, toWaId, type, mediaId, { caption, filename } = {}) {
  if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN not configured.');

  const mediaPayload = { id: mediaId };
  if (caption && type !== 'audio') mediaPayload.caption = caption;
  if (filename && type === 'document') mediaPayload.filename = filename;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type,
    [type]: mediaPayload,
  };

  const response = await axios.post(getApiUrl(phoneNumberId), payload, { headers: getJsonHeaders() });
  return response.data;
}

// Get the temporary download URL for a received media message.
async function getMediaDownloadInfo(mediaId) {
  if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN not configured.');

  const url = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${mediaId}`;
  const response = await axios.get(url, { headers: getAuthHeaders() });
  return response.data; // { url, mime_type, sha256, file_size, id }
}

// Download the actual media bytes from a temporary Meta URL.
async function downloadMediaBuffer(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    headers: getAuthHeaders(),
    responseType: 'arraybuffer',
  });
  return {
    buffer: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'application/octet-stream',
  };
}

async function markMessageAsRead(phoneNumberId, messageId) {
  if (!env.META_ACCESS_TOKEN) return;
  const readUrl = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${phoneNumberId}`;
  await axios
    .post(readUrl, { messaging_product: 'whatsapp', status: 'read', message_id: messageId }, { headers: getJsonHeaders() })
    .catch(() => {}); // non-critical
}

module.exports = {
  sendTextMessage,
  uploadMedia,
  sendMediaMessage,
  getMediaDownloadInfo,
  downloadMediaBuffer,
  markMessageAsRead,
};
