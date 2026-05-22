'use strict';

const { PrismaClient } = require('@prisma/client');

// datasources override injects connection_limit=1 at runtime so the Prisma
// connection pool keeps exactly one connection with no pool-management timers.
// pool_timeout=0 disables the pool acquisition timeout timer entirely.
// Both reduce the number of active libuv timer handles, which on Hostinger
// shared hosting are limited and cause PANIC when exhausted.
const datasourceUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.includes('connection_limit')
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=1&pool_timeout=0'
  : undefined;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
});

module.exports = prisma;
