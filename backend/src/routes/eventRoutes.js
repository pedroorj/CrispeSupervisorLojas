'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const realtimeService = require('../services/realtimeService');

// SSE endpoint — clients connect here for real-time updates
router.get('/', (req, res) => {
  // Token via query param (SSE can't set headers on some clients)
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');

  let userId;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  realtimeService.addClient(userId, res);

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtimeService.removeClient(userId, res);
  });
});

module.exports = router;
