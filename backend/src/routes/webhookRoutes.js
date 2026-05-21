'use strict';

const express = require('express');
const router = express.Router();
const { verify, receive } = require('../controllers/webhookController');

router.get('/whatsapp', verify);
router.post('/whatsapp', receive);

module.exports = router;
