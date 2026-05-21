'use strict';

// Global cost-zero policy — all flags MUST stay true in production MVP.
// Changing these to false may cause charges from Meta.
const FREE_MODE_CONFIG = {
  freeOnlyMode: true,
  allowTemplates: false,
  allowMarketing: false,
  allowOutboundWithoutCustomerMessage: false,
  allowMessagesAfter24h: false,
  allowBulkSend: false,
  allowAutomationOutbound: false,
};

const BLOCK_MESSAGE =
  'Envio bloqueado para evitar cobrança. Este cliente não enviou mensagem nas últimas 24 horas ' +
  'ou a ação exigiria template/mensagem ativa. Para manter o modo gratuito, o sistema não permite ' +
  'iniciar conversa, enviar template, enviar marketing ou enviar mensagens fora da janela gratuita.';

module.exports = { FREE_MODE_CONFIG, BLOCK_MESSAGE };
