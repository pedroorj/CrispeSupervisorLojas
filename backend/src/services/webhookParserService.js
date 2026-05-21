'use strict';

const prisma = require('../db/prismaClient');
const realtimeService = require('./realtimeService');
const pushNotificationService = require('./pushNotificationService');
const auditService = require('./auditService');

const FREE_WINDOW_HOURS = 24;

function extractMessages(body) {
  try {
    return body.entry?.[0]?.changes?.[0]?.value?.messages || [];
  } catch { return []; }
}

function extractStatuses(body) {
  try {
    return body.entry?.[0]?.changes?.[0]?.value?.statuses || [];
  } catch { return []; }
}

function extractPhoneNumberId(body) {
  try {
    return body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || null;
  } catch { return null; }
}

function extractContacts(body) {
  try {
    return body.entry?.[0]?.changes?.[0]?.value?.contacts || [];
  } catch { return []; }
}

function parseMessageType(msg) {
  const valid = ['text', 'image', 'audio', 'document', 'video', 'location'];
  return valid.includes(msg.type) ? msg.type : 'unknown';
}

function getTextBody(msg) {
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'image') return '[Imagem recebida]';
  if (msg.type === 'audio') return '[Áudio recebido]';
  if (msg.type === 'video') return '[Vídeo recebido]';
  if (msg.type === 'document') return `[Documento: ${msg.document?.filename || 'arquivo'}]`;
  if (msg.type === 'location') return '[Localização recebida]';
  return '[Mensagem não suportada]';
}

function getMediaInfo(msg) {
  const media = msg.image || msg.audio || msg.video || msg.document || null;
  if (!media) return {};
  return {
    mediaId: media.id || null,
    mediaMimeType: media.mime_type || null,
    mediaFilename: media.filename || null,
  };
}

async function processWebhookPayload(body) {
  const phoneNumberId = extractPhoneNumberId(body);
  const messages = extractMessages(body);
  const statuses = extractStatuses(body);
  const contactsInfo = extractContacts(body);

  // Process inbound messages
  for (const msg of messages) {
    try {
      await processInboundMessage(msg, phoneNumberId, contactsInfo, body);
    } catch (err) {
      console.error('[Webhook] Error processing message:', err.message);
      await auditService.log({
        action: 'WEBHOOK_MESSAGE_ERROR',
        details: { error: err.message, msgId: msg.id },
      });
    }
  }

  // Process status updates
  for (const status of statuses) {
    try {
      await processStatusUpdate(status);
    } catch (err) {
      console.error('[Webhook] Error processing status:', err.message);
    }
  }
}

async function processInboundMessage(msg, phoneNumberId, contactsInfo, rawBody) {
  if (!phoneNumberId) return;

  // Find store by phone_number_id
  const store = await prisma.store.findUnique({
    where: { metaPhoneNumberId: phoneNumberId },
  });
  if (!store) {
    console.warn(`[Webhook] No store found for phone_number_id: ${phoneNumberId}`);
    return;
  }

  // Upsert contact
  const waId = msg.from;
  const profileName =
    contactsInfo.find((c) => c.wa_id === waId)?.profile?.name || waId;

  const contact = await prisma.contact.upsert({
    where: { waId },
    update: { profileName, phoneNumber: waId },
    create: { waId, phoneNumber: waId, profileName },
  });

  // Upsert conversation
  let conversation = await prisma.conversation.findFirst({
    where: { storeId: store.id, contactId: contact.id },
  });

  const now = new Date();
  const freeWindowExpiresAt = new Date(now.getTime() + FREE_WINDOW_HOURS * 60 * 60 * 1000);
  const textBody = getTextBody(msg);

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        storeId: store.id,
        contactId: contact.id,
        status: 'waiting_store_response',
        lastCustomerMessageAt: now,
        freeWindowExpiresAt,
        lastMessageAt: now,
        lastMessagePreview: textBody.slice(0, 200),
        unreadCountOwner: 1,
        unreadCountStore: 1,
      },
    });
  } else {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'waiting_store_response',
        lastCustomerMessageAt: now,
        freeWindowExpiresAt,
        lastMessageAt: now,
        lastMessagePreview: textBody.slice(0, 200),
        unreadCountOwner: { increment: 1 },
        unreadCountStore: { increment: 1 },
      },
    });
  }

  // Save message (check duplicate)
  const exists = await prisma.message.findUnique({ where: { metaMessageId: msg.id } });
  if (exists) return;

  const msgTimestamp = msg.timestamp
    ? new Date(parseInt(msg.timestamp, 10) * 1000)
    : now;

  const { mediaId, mediaMimeType, mediaFilename } = getMediaInfo(msg);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      storeId: store.id,
      contactId: contact.id,
      metaMessageId: msg.id,
      direction: 'inbound',
      type: parseMessageType(msg),
      textBody,
      mediaId,
      mediaMimeType,
      mediaFilename,
      status: 'received',
      timestamp: msgTimestamp,
      rawPayload: rawBody,
    },
  });

  await auditService.log({
    action: 'MESSAGE_RECEIVED',
    entityType: 'conversation',
    entityId: conversation.id,
    details: { storeId: store.id, waId, msgType: msg.type },
  });

  // SSE broadcast to all connected clients
  realtimeService.broadcast('new_message', {
    conversationId: conversation.id,
    storeId: store.id,
    contactName: profileName,
    preview: textBody.slice(0, 100),
    timestamp: now.toISOString(),
  });

  realtimeService.broadcast('conversation_updated', {
    conversationId: conversation.id,
    storeId: store.id,
    status: conversation.status,
    lastMessageAt: now.toISOString(),
    lastMessagePreview: textBody.slice(0, 100),
    unreadCountOwner: conversation.unreadCountOwner,
  });

  // Push notification
  await pushNotificationService.notifyNewMessage(
    store.displayName,
    profileName,
    textBody.slice(0, 100),
    conversation.id
  );
}

async function processStatusUpdate(status) {
  const { id: metaMessageId, status: newStatus } = status;
  if (!metaMessageId) return;

  const statusMap = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  const mappedStatus = statusMap[newStatus];
  if (!mappedStatus) return;

  const msg = await prisma.message.findUnique({ where: { metaMessageId } });
  if (!msg) return;

  await prisma.message.update({
    where: { id: msg.id },
    data: { status: mappedStatus },
  });

  realtimeService.broadcast('message_status_updated', {
    messageId: msg.id,
    metaMessageId,
    status: mappedStatus,
  });
}

module.exports = { processWebhookPayload };
