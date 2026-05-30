'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const { getMessages, sendMessage, getMessageMedia } = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const { sendMessageLimiter } = require('../middlewares/rateLimiter');

// Memory storage — file is available as req.file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(_req, file, cb) {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/3gp',
      'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/mp4',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
  },
});

router.use(authMiddleware);

router.get('/', getMessages);
router.post('/', sendMessageLimiter, upload.single('file'), sendMessage);
router.get('/:msgId/media', getMessageMedia);

module.exports = router;
