'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const env = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const pushRoutes = require('./routes/pushRoutes');
const reportRoutes = require('./routes/reportRoutes');
const eventRoutes = require('./routes/eventRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://graph.facebook.com'],
      },
    },
  })
);

// CORS — restrict to known origin in production
const allowedOrigins = env.APP_BASE_URL
  ? [env.APP_BASE_URL, 'http://localhost:5173', 'http://localhost:3001']
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Webhook route needs raw body for signature validation
app.use('/webhook', express.json({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations/:id/messages', messageRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/events', eventRoutes);

// Webhook (no auth middleware)
app.use('/webhook', webhookRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Serve frontend build in production
if (env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../public');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler);

module.exports = app;
