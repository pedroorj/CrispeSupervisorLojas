'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = require('./app');
const env = require('./config/env');
const prisma = require('./db/prismaClient');
const { startUnansweredAlertJob } = require('./jobs/unansweredAlertJob');

const PORT = env.PORT;

function isPanic(err) {
  return err && err.message && err.message.includes('PANIC');
}

// Catch PANIC from libuv/Prisma timers on Hostinger shared hosting
process.on('uncaughtException', (err) => {
  if (isPanic(err)) {
    console.warn('[Server] Hostinger timer warning (suppressed):', err.message);
    return;
  }
  console.error('[Server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  if (isPanic(reason)) {
    console.warn('[Server] Hostinger timer warning (suppressed):', reason && reason.message);
    return;
  }
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

    // Delay alert job 10s to let server stabilize before starting timers
    setTimeout(() => {
      try {
        startUnansweredAlertJob();
      } catch (err) {
        if (isPanic(err)) {
          console.warn('[Server] Hostinger timer warning in job (suppressed):', err.message);
        } else {
          console.error('[Server] Alert job error:', err.message);
        }
      }
    }, 10000);

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
    if (isPanic(err)) {
      console.warn('[Server] Hostinger timer warning in startup (suppressed):', err.message);
      return; // server already listening — do NOT exit
    }
    console.error('[Server] Startup error:', err);
    process.exit(1);
  }
}

start();
