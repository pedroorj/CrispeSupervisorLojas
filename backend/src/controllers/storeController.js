'use strict';

const prisma = require('../db/prismaClient');
const auditService = require('../services/auditService');

async function listStores(req, res, next) {
  try {
    let stores;
    if (req.user.role === 'owner' || req.user.role === 'admin') {
      stores = await prisma.store.findMany({ orderBy: { displayName: 'asc' } });
    } else {
      const userStores = await prisma.userStore.findMany({
        where: { userId: req.user.id },
        include: { store: true },
      });
      stores = userStores.map((us) => us.store);
    }
    res.json({ stores });
  } catch (err) {
    next(err);
  }
}

async function getStore(req, res, next) {
  try {
    const store = await prisma.store.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });
    res.json({ store });
  } catch (err) {
    next(err);
  }
}

async function createStore(req, res, next) {
  try {
    const { name, displayName, whatsappPhoneNumber, metaPhoneNumberId, metaWabaId } = req.body;

    if (!name || !displayName || !whatsappPhoneNumber || !metaPhoneNumberId || !metaWabaId) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const store = await prisma.store.create({
      data: { name, displayName, whatsappPhoneNumber, metaPhoneNumberId, metaWabaId },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'STORE_CREATED',
      entityType: 'store',
      entityId: store.id,
      details: { name },
    });

    res.status(201).json({ store });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'meta_phone_number_id já cadastrado.' });
    }
    next(err);
  }
}

async function updateStore(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { name, displayName, whatsappPhoneNumber, metaPhoneNumberId, metaWabaId, active } = req.body;

    const store = await prisma.store.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(whatsappPhoneNumber && { whatsappPhoneNumber }),
        ...(metaPhoneNumberId && { metaPhoneNumberId }),
        ...(metaWabaId && { metaWabaId }),
        ...(active !== undefined && { active }),
      },
    });

    await auditService.log({
      userId: req.user.id,
      action: 'STORE_UPDATED',
      entityType: 'store',
      entityId: id,
    });

    res.json({ store });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStores, getStore, createStore, updateStore };
