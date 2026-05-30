'use strict';

const prisma = require('../db/prismaClient');
const { canUserAccessConversation } = require('../services/conversationService');
const { checkCanSend, MessageBlockedError } = require('../services/messageGuardService');
const {
  sendTextMessage,
  uploadMedia,
  sendMediaMessage,
  getMediaDownloadInfo,
  downloadMediaBuffer,
} = require('../services/metaWhatsAppService');
const auditService = require('../services/auditService');
const realtimeService = require('../services/realtimeService');

const ALLOWED_MEDIA_TYPES = ['image', 'video', 'document', 'audio'];

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

    // Determine if this is a media or text send
    const file = req.file; // set by multer when Content-Type is multipart/form-data
    const messageType = file ? (req.body.type || 'document') : 'text';
    const text = req.body.text;
    const caption = req.body.caption;

    if (!file && (!text || !text.trim())) {
      return res.status(400).json({ error: 'Texto ou arquivo é obrigatório.' });
    }

    if (file && !ALLOWED_MEDIA_TYPES.includes(messageType)) {
      return res.status(400).json({ error: `Tipo de mídia inválido: ${messageType}` });
    }

    const allowed = await canUserAccessConversation(req.user.id, req.user.role, convId);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { contact: true, store: true },
    });

    if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });

    // Cost guard
    try {
      checkCanSend({ conversation, messageType, isTemplate: false, isMarketing: false });
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
          },
        });
        return res.status(403).json({ error: err.message, blocked: true });
      }
      throw err;
    }

    let metaResponse;
    let savedMediaId = null;
    let savedMimeType = null;
    let savedFilename = null;
    let preview;

    if (file) {
      // Upload file to Meta first, then send
      let uploadedMedia;
      try {
        uploadedMedia = await uploadMedia(
          conversation.store.metaPhoneNumberId,
          file.buffer,
          file.mimetype,
          file.originalname
        );
      } catch (err) {
        await auditService.log({
          userId: req.user.id,
          action: 'MESSAGE_SEND_FAILED',
          entityType: 'conversation',
          entityId: convId,
          details: { error: err.message, stage: 'media_upload' },
        });
        return res.status(502).json({ error: 'Falha ao fazer upload da mídia para a Meta.' });
      }

      savedMediaId = uploadedMedia.id;
      savedMimeType = file.mimetype;
      savedFilename = file.originalname;

      try {
        metaResponse = await sendMediaMessage(
          conversation.store.metaPhoneNumberId,
          conversation.contact.waId,
          messageType,
          savedMediaId,
          { caption: caption?.trim(), filename: file.originalname }
        );
      } catch (err) {
        await auditService.log({
          userId: req.user.id,
          action: 'MESSAGE_SEND_FAILED',
          entityType: 'conversation',
          entityId: convId,
          details: { error: err.message, stage: 'media_send' },
        });
        return res.status(502).json({ error: 'Falha ao enviar mídia pela Meta API.' });
      }

      preview = caption?.trim() || `[${messageType}]`;
    } else {
      // Text message
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
      preview = text.trim().slice(0, 200);
    }

    const metaMessageId = metaResponse?.messages?.[0]?.id || null;
    const now = new Date();
    const isFirstResponse = !conversation.firstResponseAt;

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        storeId: conversation.storeId,
        contactId: conversation.contactId,
        metaMessageId,
        direction: 'outbound',
        type: messageType,
        textBody: messageType === 'text' ? text.trim() : (caption?.trim() || null),
        mediaId: savedMediaId,
        mediaMimeType: savedMimeType,
        mediaFilename: savedFilename,
        status: 'sent',
        sentByUserId: req.user.id,
        timestamp: now,
      },
    });

    const firstResponseSeconds =
      isFirstResponse && conversation.lastCustomerMessageAt
        ? Math.round((now - new Date(conversation.lastCustomerMessageAt)) / 1000)
        : conversation.firstResponseSeconds;

    await prisma.conversation.update({
      where: { id: convId },
      data: {
        status: 'waiting_customer',
        lastMessageAt: now,
        lastMessagePreview: preview,
        ...(isFirstResponse && { firstResponseAt: now, firstResponseSeconds }),
      },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'MESSAGE_SENT',
      entityType: 'conversation',
      entityId: convId,
      details: { storeId: conversation.storeId, waId: conversation.contact.waId, metaMessageId, type: messageType },
    });

    realtimeService.broadcast('new_message', {
      conversationId: convId,
      direction: 'outbound',
      preview,
      timestamp: now.toISOString(),
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

// Proxy endpoint — streams received media from Meta to the client.
async function getMessageMedia(req, res, next) {
  try {
    const convId = parseInt(req.params.id);
    const msgId = parseInt(req.params.msgId);

    const allowed = await canUserAccessConversation(req.user.id, req.user.role, convId);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const message = await prisma.message.findFirst({
      where: { id: msgId, conversationId: convId },
      select: { mediaId: true, mediaMimeType: true, mediaFilename: true },
    });

    if (!message || !message.mediaId) return res.status(404).json({ error: 'Mídia não encontrada.' });

    const info = await getMediaDownloadInfo(message.mediaId);
    const { buffer, contentType } = await downloadMediaBuffer(info.url);

    res.setHeader('Content-Type', contentType || message.mediaMimeType || 'application/octet-stream');
    if (message.mediaFilename) {
      res.setHeader('Content-Disposition', `inline; filename="${message.mediaFilename}"`);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { getMessages, sendMessage, getMessageMedia };
