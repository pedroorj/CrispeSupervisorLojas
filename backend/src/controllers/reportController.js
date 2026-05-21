'use strict';

const prisma = require('../db/prismaClient');

function getDateRange(from, to) {
  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function summary(req, res, next) {
  try {
    const { from, to } = req.query;
    const { start, end } = getDateRange(from, to);

    const [
      totalReceived,
      totalSent,
      unresolved,
      resolved,
      expired,
      avgFirstResponse,
    ] = await Promise.all([
      prisma.message.count({ where: { direction: 'inbound', createdAt: { gte: start, lte: end } } }),
      prisma.message.count({ where: { direction: 'outbound', createdAt: { gte: start, lte: end } } }),
      prisma.conversation.count({ where: { status: { in: ['new', 'open', 'waiting_store_response'] } } }),
      prisma.conversation.count({ where: { status: 'resolved', updatedAt: { gte: start, lte: end } } }),
      prisma.conversation.count({ where: { status: 'blocked_24h_expired' } }),
      prisma.conversation.aggregate({
        where: { firstResponseSeconds: { not: null }, createdAt: { gte: start, lte: end } },
        _avg: { firstResponseSeconds: true },
      }),
    ]);

    res.json({
      period: { from: start, to: end },
      totalReceived,
      totalSent,
      unresolved,
      resolved,
      expired,
      avgFirstResponseSeconds: Math.round(avgFirstResponse._avg.firstResponseSeconds || 0),
    });
  } catch (err) {
    next(err);
  }
}

async function byStore(req, res, next) {
  try {
    const { from, to, storeId } = req.query;
    const { start, end } = getDateRange(from, to);

    const storeWhere = storeId ? { id: parseInt(storeId) } : {};
    const stores = await prisma.store.findMany({
      where: storeWhere,
      select: { id: true, displayName: true },
    });

    const results = await Promise.all(
      stores.map(async (store) => {
        const [received, sent, resolved, avgResponse] = await Promise.all([
          prisma.message.count({
            where: { storeId: store.id, direction: 'inbound', createdAt: { gte: start, lte: end } },
          }),
          prisma.message.count({
            where: { storeId: store.id, direction: 'outbound', createdAt: { gte: start, lte: end } },
          }),
          prisma.conversation.count({
            where: { storeId: store.id, status: 'resolved', updatedAt: { gte: start, lte: end } },
          }),
          prisma.conversation.aggregate({
            where: { storeId: store.id, firstResponseSeconds: { not: null } },
            _avg: { firstResponseSeconds: true },
          }),
        ]);

        return {
          store,
          received,
          sent,
          resolved,
          avgFirstResponseSeconds: Math.round(avgResponse._avg.firstResponseSeconds || 0),
        };
      })
    );

    res.json({ period: { from: start, to: end }, stores: results });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, byStore };
