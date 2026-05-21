'use strict';

const prisma = require('../db/prismaClient');

async function log({ userId = null, action, entityType = null, entityId = null, details = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        detailsJson: details ? details : undefined,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err.message);
  }
}

module.exports = { log };
