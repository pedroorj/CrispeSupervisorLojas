'use strict';

const prisma = require('../db/prismaClient');
const { canUserAccessConversation } = require('../services/conversationService');
const { checkCanSend, MessageBlockedError } = require('../services/messageGuardService');
const { sendTextMessage } = require('../services/metaWhatsAppService');
const auditService = require('../services/auditService');
const realtimeService = require('../services/realtimeService');

async function getMessages(req, res, next) {
  try {
    const convId = parseInt(req.params.id);
    const allowed = await canUserAccessConversation(req.user.id, req.user.role, convId);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const [total, messages] = await Promise.all([
      prisma.message.count({ where: { conversationId: convId } }),
      prisma.message.findMany({
        where: { conversationId: convId },
        orderBy: { timestamp: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          metaMessageId: true,
          direction: true,
          type: true,
          textBody: true,
          mediaId: true,
          mediaMimeType: true,
          mediaFilename: true,
          status: true,
          timestamp: true,
          createdAt: true,
          sentByUser: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({ total, page, limit, messages });
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const convId = parseInt(req.params.id);
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Texto da mensagem é obrigatório.' });
    }

    const allowed = await canUserAccessConversation(req.user.id, req.user.role, convId);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      include: {
        contact: true,
        store: true,
      },
    });

    if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });

    // === COST GUARD — must pass before any Meta API call ===
    try {
      checkCanSend({ conversation, messageType: 'text', isTemplate: false, isMarketing: false });
    } catch (err) {
      if (err instanceof MessageBlockedError) {
        await auditService.log({
          userId: req.user.id,
          action: 'MESSAGE_BLOCKED',
          entityType: 'conversation',
          entityId: convId,
          details: {
            reason: err.message,
            storeId: conversation.storeId,
            waId: conversation.contact.waId,
            attemptedText: text.slice(0, 200),
          },
        });
        return res.status(403).json({ error: err.message, blocked: true });
      }
      throw err;
    }

    // Send via Meta Graph API
    let metaResponse;
    try {
      metaResponse = await sendTextMessage(
        conversation.store.metaPhoneNumberId,
        conversation.contact.waId,
        text.trim()
      );
    } catch (err) {
      await auditService.log({
        userId: req.user.id,
        action: 'MESSAGE_SEND_FAILED',
        entityType: 'conversation',
        entityId: convId,
        details: { error: err.message },
      });
      return res.status(502).json({ error: 'Falha ao enviar mensagem pela Meta API.' });
    }

    const metaMessageId = metaResponse?.messages?.[0]?.id || null;
    const now = new Date();
    const isFirstResponse = !conversation.firstResponseAt;

    // Save outbound message
    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        storeId: conversation.storeId,
        contactId: conversation.contactId,
        metaMessageId,
        direction: 'outbound',
        type: 'text',
        textBody: text.trim(),
        status: 'sent',
        sentByUserId: req.user.id,
        timestamp: now,
      },
    });

    // Update conversation
    const firstResponseSeconds = isFirstResponse && conversation.lastCustomerMessageAt
      ? Math.round((now - new Date(conversation.lastCustomerMessageAt)) / 1000)
      : conversation.firstResponseSeconds;

    await prisma.conversation.update({
      where: { id: convId },
      data: {
        status: 'waiting_customer',
        lastMessageAt: now,
        lastMessagePreview: text.trim().slice(0, 200),
        ...(isFirstResponse && {
          firstResponseAt: now,
          firstResponseSeconds,
        }),
      },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'MESSAGE_SENT',
      entityType: 'conversation',
      entityId: convId,
      details: {
        storeId: conversation.storeId,
        waId: conversation.contact.waId,
        metaMessageId,
      },
    });

    realtimeService.broadcast('new_message', {
      conversationId: convId,
      direction: 'outbound',
      preview: text.trim().slice(0, 100),
      timestamp: now.toISOString(),
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMessages, sendMessage };
