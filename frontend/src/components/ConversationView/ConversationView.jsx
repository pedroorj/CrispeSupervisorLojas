import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/apiClient';
import FreeWindowBadge from '../FreeWindowBadge/FreeWindowBadge';
import StatusBadge from '../StatusBadge/StatusBadge';

const BLOCK_MSG = 'Envio bloqueado para evitar cobrança. Este cliente não enviou mensagem nas últimas 24 horas ou a ação exigiria template/mensagem ativa. Para manter o modo gratuito, o sistema não permite iniciar conversa, enviar template, enviar marketing ou enviar mensagens fora da janela gratuita.';

function MessageItem({ msg }) {
  const isOut = msg.direction === 'outbound';
  const time = format(new Date(msg.timestamp), 'HH:mm', { locale: ptBR });

  const statusIcon = {
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
    failed: '✗',
    received: '',
  }[msg.status] || '';

  return (
    <div className={`msg-bubble ${isOut ? 'msg-outbound' : 'msg-inbound'}`}>
      <div>{msg.textBody || <em style={{ color: '#999' }}>[{msg.type}]</em>}</div>
      <span className="msg-time">
        {time} {isOut && <span style={{ color: msg.status === 'read' ? '#34B7F1' : '#aaa' }}>{statusIcon}</span>}
      </span>
    </div>
  );
}

export default function ConversationView({ conversation: initialConv, realtimeEvent, onBack }) {
  const [conv, setConv] = useState(initialConv);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);

  const canReply = conv?.freeWindowExpiresAt && new Date() < new Date(conv.freeWindowExpiresAt);

  const loadMessages = useCallback(() => {
    if (!conv?.id) return;
    api.get(`/conversations/${conv.id}/messages`, { params: { limit: 100 } })
      .then(({ data }) => setMessages(data.messages))
      .catch(console.error);
  }, [conv?.id]);

  const loadConversation = useCallback(() => {
    if (!conv?.id) return;
    api.get(`/conversations/${conv.id}`)
      .then(({ data }) => setConv(data.conversation))
      .catch(console.error);
  }, [conv?.id]);

  useEffect(() => {
    setConv(initialConv);
    setMessages([]);
    setText('');
    setBlockError('');
    setSendError('');
  }, [initialConv?.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle SSE events
  useEffect(() => {
    if (!realtimeEvent || !conv) return;
    if (
      realtimeEvent.type === 'new_message' &&
      realtimeEvent.data?.conversationId === conv.id
    ) {
      loadMessages();
      loadConversation();
    }
    if (realtimeEvent.type === 'message_status_updated') {
      setMessages((prev) =>
        prev.map((m) =>
          m.metaMessageId === realtimeEvent.data.metaMessageId
            ? { ...m, status: realtimeEvent.data.status }
            : m
        )
      );
    }
  }, [realtimeEvent, conv, loadMessages, loadConversation]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setBlockError('');
    setSendError('');

    try {
      const { data } = await api.post(`/conversations/${conv.id}/messages`, { text: text.trim() });
      setMessages((prev) => [...prev, data.message]);
      setText('');
      loadConversation();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Erro ao enviar mensagem.';
      if (err.response?.data?.blocked) {
        setBlockError(errMsg);
      } else {
        setSendError(errMsg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!window.confirm('Marcar conversa como resolvida?')) return;
    try {
      const { data } = await api.post(`/conversations/${conv.id}/resolve`);
      setConv(data.conversation);
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conv) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>💬</div>
        <div>Selecione uma conversa para começar</div>
        <div style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: 99, fontWeight: 600 }}>
          🔒 Modo Gratuito Ativo
        </div>
      </div>
    );
  }

  const contactName = conv.contact?.profileName || conv.contact?.phoneNumber || 'Desconhecido';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="header" style={{ gap: 10 }}>
        {/* Back button (mobile only) */}
        <button className="btn btn-icon btn-ghost back-btn" style={{ color: '#fff' }} onClick={onBack}>
          ←
        </button>

        <div className="avatar" style={{ width: 38, height: 38, fontSize: 15, flexShrink: 0 }}>
          {contactName[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{contactName}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }} className="truncate">
            {conv.store?.displayName} · {conv.contact?.phoneNumber}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <StatusBadge status={conv.status} />
          {conv.status !== 'resolved' && (
            <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--wa-dark)', fontSize: 12 }} onClick={handleResolve}>
              ✓ Resolver
            </button>
          )}
        </div>
      </div>

      {/* Free window banner */}
      <FreeWindowBadge
        freeWindowExpiresAt={conv.freeWindowExpiresAt}
        lastCustomerMessageAt={conv.lastCustomerMessageAt}
      />

      {/* Messages */}
      <div className="chat-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40, fontSize: 13 }}>
            Nenhuma mensagem ainda.
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Block error */}
      {blockError && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', color: '#b91c1c', fontSize: 13, borderTop: '1px solid #fecaca' }}>
          ⛔ {blockError}
        </div>
      )}

      {/* Send error */}
      {sendError && (
        <div style={{ padding: '8px 16px', background: '#fff7ed', color: '#c2410c', fontSize: 13, borderTop: '1px solid #fed7aa' }}>
          ⚠️ {sendError}
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <textarea
          rows={1}
          placeholder={
            canReply
              ? 'Digite uma mensagem... (Enter para enviar)'
              : 'Resposta bloqueada — janela gratuita expirada ou sem mensagem do cliente'
          }
          disabled={!canReply || sending}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />
        <button
          className="btn btn-primary btn-icon"
          style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }}
          disabled={!canReply || !text.trim() || sending}
          onClick={handleSend}
          aria-label="Enviar"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  );
}
