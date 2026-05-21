'use strict';

const prisma = require('../db/prismaClient');

async function getConversationsForUser(user, { storeId, status, search, page = 1, limit = 30 }) {
  const where = {};

  // Filter by accessible stores
  if (user.role !== 'owner' && user.role !== 'admin') {
    const userStores = await prisma.userStore.findMany({
      where: { userId: user.id },
      select: { storeId: true },
    });
    const allowedStoreIds = userStores.map((us) => us.storeId);
    where.storeId = storeId
      ? allowedStoreIds.includes(parseInt(storeId)) ? parseInt(storeId) : -1
      : { in: allowedStoreIds };
  } else if (storeId) {
    where.storeId = parseInt(storeId);
  }

  if (status) where.status = status;

  if (search) {
    where.contact = {
      OR: [
        { profileName: { contains: search } },
        { phoneNumber: { contains: search } },
        { waId: { contains: search } },
      ],
    };
  }

  const skip = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        contact: { select: { id: true, waId: true, phoneNumber: true, profileName: true } },
        store: { select: { id: true, displayName: true, whatsappPhoneNumber: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { total, page, limit, items };
}

async function canUserAccessConversation(userId, role, conversationId) {
  if (role === 'owner' || role === 'admin') return true;

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { storeId: true },
  });
  if (!conv) return false;

  const access = await prisma.userStore.findUnique({
    where: { userId_storeId: { userId, storeId: conv.storeId } },
  });
  return !!access;
}

module.exports = { getConversationsForUser, canUserAccessConversation };
