'use strict';

// messageGuardService — enforces the cost-zero policy.
// EVERY outbound send MUST pass through checkCanSend() before hitting the Meta API.

const { FREE_MODE_CONFIG, BLOCK_MESSAGE } = require('../config/freeMode');

class MessageBlockedError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'MessageBlockedError';
    this.status = 403;
    this.blocked = true;
  }
}

function block(reason) {
  throw new MessageBlockedError(reason);
}

function checkCanSend({ conversation, messageType = 'text', isTemplate = false, isMarketing = false }) {
  const cfg = FREE_MODE_CONFIG;

  if (!cfg.freeOnlyMode) return; // Guard off — should never happen in MVP

  if (isTemplate || !cfg.allowTemplates) {
    if (isTemplate) block(BLOCK_MESSAGE);
  }

  if (isMarketing || !cfg.allowMarketing) {
    if (isMarketing) block(BLOCK_MESSAGE);
  }

  // Must have a customer message
  if (!conversation.lastCustomerMessageAt) {
    if (!cfg.allowOutboundWithoutCustomerMessage) {
      block(BLOCK_MESSAGE);
    }
  }

  // Check 24h window
  if (conversation.freeWindowExpiresAt) {
    const now = new Date();
    if (now > new Date(conversation.freeWindowExpiresAt)) {
      if (!cfg.allowMessagesAfter24h) {
        block(BLOCK_MESSAGE);
      }
    }
  } else {
    // No window set means no customer message — block
    if (!cfg.allowOutboundWithoutCustomerMessage) {
      block(BLOCK_MESSAGE);
    }
  }

  // MVP: text only
  if (messageType !== 'text') {
    block('No modo gratuito do MVP, apenas texto livre dentro da janela de 24h é permitido.');
  }
}

module.exports = { checkCanSend, MessageBlockedError };
