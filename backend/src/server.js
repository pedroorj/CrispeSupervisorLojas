'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = require('./app');
const env = require('./config/env');
const prisma = require('./db/prismaClient');
const { startUnansweredAlertJob } = require('./jobs/unansweredAlertJob');

const PORT = env.PORT;

// Hostinger shared hosting emits "PANIC: timer has gone away" from libuv internals.
// Catching it here prevents the process from crashing — the server keeps running normally.
process.on('uncaughtException', (err) => {
  if (err && err.message && err.message.includes('PANIC')) {
    console.warn('[Server] Suppressed known Hostinger timer warning:', err.message);
    return; // do NOT exit — server is healthy
  }
  console.error('[Server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to database.');

    const server = app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} (${env.NODE_ENV})`);
      console.log(`[Server] Webhook URL: ${env.APP_BASE_URL}/webhook/whatsapp`);
    });

    startUnansweredAlertJob();

    const shutdown = async (signal) => {
      console.log(`[Server] ${signal} received — shutting down.`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[Server] Startup error:', err);
    process.exit(1);
  }
}

start();
