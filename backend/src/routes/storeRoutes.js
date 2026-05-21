'use strict';

const express = require('express');
const router = express.Router();
const { listStores, getStore, createStore, updateStore } = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/', listStores);
router.get('/:id', getStore);
router.post('/', requireRole('owner', 'admin'), createStore);
router.put('/:id', requireRole('owner', 'admin'), updateStore);

module.exports = router;
