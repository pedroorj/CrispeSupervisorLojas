'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/conversationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', ctrl.listConversations);
router.get('/:id', ctrl.getConversation);
router.put('/:id/status', ctrl.updateStatus);
router.put('/:id/assign', ctrl.assignConversation);
router.post('/:id/resolve', ctrl.resolveConversation);

module.exports = router;
