'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const { getMessages, sendMessage } = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const { sendMessageLimiter } = require('../middlewares/rateLimiter');

router.use(authMiddleware);

router.get('/', getMessages);
router.post('/', sendMessageLimiter, sendMessage);

module.exports = router;
