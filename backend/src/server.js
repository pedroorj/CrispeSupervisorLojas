'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = require('./app');
const env = require('./config/env');
const prisma = require('./db/prismaClient');
const { startUnansweredAlertJob } = require('./jobs/unansweredAlertJob');

const PORT = env.PORT;

async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to database.');

    const server = app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} (${env.NODE_ENV})`);
      console.log(`[Server] Webhook URL: ${env.APP_BASE_URL}/webhook/whatsapp`);
    });

    startUnansweredAlertJob();

    // Graceful shutdown
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
