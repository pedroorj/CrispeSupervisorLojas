import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FreeWindowBadge({ freeWindowExpiresAt, lastCustomerMessageAt }) {
  if (!lastCustomerMessageAt) {
    return (
      <div className="free-window-banner blocked">
        ⛔ Nenhuma mensagem do cliente. Envio bloqueado para evitar cobrança.
      </div>
    );
  }

  const now = new Date();
  const expires = freeWindowExpiresAt ? new Date(freeWindowExpiresAt) : null;

  if (!expires || now > expires) {
    return (
      <div className="free-window-banner expired">
        ⏰ Janela gratuita expirada. Envio bloqueado para evitar cobrança.
      </div>
    );
  }

  const timeLeft = formatDistanceToNow(expires, { locale: ptBR, addSuffix: false });
  const until = format(expires, 'HH:mm', { locale: ptBR });

  return (
    <div className="free-window-banner active">
      ✅ Pode responder gratuitamente até <strong>{until}</strong> (em {timeLeft})
    </div>
  );
}
