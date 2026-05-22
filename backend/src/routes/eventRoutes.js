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
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx
  res.setHeader('X-LiteSpeed-Cache', 'no'); // LiteSpeed
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.flushHeaders();

  realtimeService.addClient(userId, res);

  // Heartbeat every 15s — self-rescheduling setTimeout instead of setInterval.
  // Each connected SSE client used to hold a permanent setInterval handle.
  // On Hostinger shared hosting the timerfd limit is low; multiple clients
  // would exhaust it and trigger PANIC. setTimeout releases the handle after
  // each fire, so each client holds at most one timerfd slot at a time.
  let heartbeatTimer = null;
  function scheduleHeartbeat() {
    heartbeatTimer = setTimeout(() => {
      try { res.write(':heartbeat\n\n'); } catch {}
      if (!res.writableEnded) scheduleHeartbeat();
    }, 15000);
  }
  scheduleHeartbeat();

  req.on('close', () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    realtimeService.removeClient(userId, res);
  });
});

module.exports = router;
