'use strict';

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3001'), 10),
  APP_BASE_URL: optional('APP_BASE_URL', 'http://localhost:3001'),

  // Meta / WhatsApp
  META_GRAPH_API_VERSION: optional('META_GRAPH_API_VERSION', 'v25.0'),
  META_ACCESS_TOKEN: optional('META_ACCESS_TOKEN'),
  META_VERIFY_TOKEN: optional('META_VERIFY_TOKEN'),
  META_APP_ID: optional('META_APP_ID'),
  META_APP_SECRET: optional('META_APP_SECRET'),
  DEFAULT_WABA_ID: optional('DEFAULT_WABA_ID'),

  // Auth
  JWT_SECRET: optional('JWT_SECRET', 'change-me-in-production'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

  // VAPID
  VAPID_PUBLIC_KEY: optional('VAPID_PUBLIC_KEY'),
  VAPID_PRIVATE_KEY: optional('VAPID_PRIVATE_KEY'),
  VAPID_SUBJECT: optional('VAPID_SUBJECT', 'mailto:admin@example.com'),

  // Alerts
  ALERT_UNANSWERED_AFTER_MINUTES: parseInt(
    optional('ALERT_UNANSWERED_AFTER_MINUTES', '10'),
    10
  ),
};

module.exports = env;
