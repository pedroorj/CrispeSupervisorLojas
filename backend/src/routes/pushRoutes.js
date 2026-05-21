'use strict';

const express = require('express');
const router = express.Router();
const { getVapidKey, subscribe, unsubscribe, testPush } = require('../controllers/pushController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/vapid-key', getVapidKey);
router.post('/subscribe', authMiddleware, subscribe);
router.post('/unsubscribe', authMiddleware, unsubscribe);
router.post('/test', authMiddleware, testPush);

module.exports = router;
