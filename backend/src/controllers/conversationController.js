'use strict';

const prisma = require('../db/prismaClient');
const { getConversationsForUser, canUserAccessConversation } = require('../services/conversationService');
const auditService = require('../services/auditService');
const realtimeService = require('../services/realtimeService');

async function listConversations(req, res, next) {
  try {
    const { storeId, status, search, page, limit } = req.query;
    const result = await getConversationsForUser(req.user, {
      storeId,
      status,
      search,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 30, 100),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getConversation(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const allowed = await canUserAccessConversation(req.user.id, req.user.role, id);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        store: { select: { id: true, displayName: true, whatsappPhoneNumber: true, metaPhoneNumberId: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });

    // Reset unread count for owner
    await prisma.conversation.update({
      where: { id },
      data: { unreadCountOwner: 0 },
    });

    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['new', 'open', 'waiting_store_response', 'waiting_customer', 'resolved', 'blocked_24h_expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }

    const allowed = await canUserAccessConversation(req.user.id, req.user.role, id);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const conv = await prisma.conversation.update({
      where: { id },
      data: { status },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'CONVERSATION_STATUS_CHANGED',
      entityType: 'conversation',
      entityId: id,
      details: { newStatus: status },
    });

    realtimeService.broadcast('conversation_updated', { conversationId: id, status });
    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
}

async function assignConversation(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { userId } = req.body;

    const allowed = await canUserAccessConversation(req.user.id, req.user.role, id);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const conv = await prisma.conversation.update({
      where: { id },
      data: { assignedUserId: userId || null },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'CONVERSATION_ASSIGNED',
      entityType: 'conversation',
      entityId: id,
      details: { assignedUserId: userId },
    });

    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
}

async function resolveConversation(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const allowed = await canUserAccessConversation(req.user.id, req.user.role, id);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão.' });

    const conv = await prisma.conversation.update({
      where: { id },
      data: { status: 'resolved' },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'CONVERSATION_RESOLVED',
      entityType: 'conversation',
      entityId: id,
    });

    realtimeService.broadcast('conversation_updated', { conversationId: id, status: 'resolved' });
    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
}

module.exports = { listConversations, getConversation, updateStatus, assignConversation, resolveConversation };
