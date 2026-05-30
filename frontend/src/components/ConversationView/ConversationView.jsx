import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/apiClient';
import FreeWindowBadge from '../FreeWindowBadge/FreeWindowBadge';
import StatusBadge from '../StatusBadge/StatusBadge';

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/3gp',
  'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/mp4',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

function getMediaType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

const MEDIA_ICONS = { image: '🖼️', video: '🎬', audio: '🎵', document: '📄' };
const MEDIA_LABELS = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Documento' };

// Fetches media from backend proxy and renders as blob URL
function MediaBubble({ msg, convId }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl;
    if (!msg.mediaId) { setLoading(false); setError(true); return; }

    api.get(`/conversations/${convId}/messages/${msg.id}/media`, { responseType: 'blob', timeout: 30000 })
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data);
        setBlobUrl(objectUrl);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [msg.id, convId, msg.mediaId]);

  if (loading) {
    return (
      <div className="msg-media-loading">
        <span className="media-spinner" /> {MEDIA_LABELS[msg.type] || 'Mídia'}...
      </div>
    );
  }
  if (error || !blobUrl) {
    return (
      <div className="msg-media-error">
        {MEDIA_ICONS[msg.type] || '📎'} Mídia indisponível
      </div>
    );
  }

  if (msg.type === 'image') {
    return (
      <a href={blobUrl} target="_blank" rel="noopener noreferrer">
        <img src={blobUrl} alt="Imagem" className="msg-media-img" />
      </a>
    );
  }
  if (msg.type === 'video') {
    return <video src={blobUrl} controls className="msg-media-video" />;
  }
  if (msg.type === 'audio') {
    return <audio src={blobUrl} controls className="msg-media-audio" />;
  }
  // document
  return (
    <a href={blobUrl} download={msg.mediaFilename || 'documento'} className="msg-media-doc">
      📄 <span>{msg.mediaFilename || 'Documento'}</span>
    </a>
  );
}

function MessageItem({ msg, convId }) {
  const isOut = msg.direction === 'outbound';
  const time = format(new Date(msg.timestamp), 'HH:mm', { locale: ptBR });
  const isMedia = msg.type !== 'text' && msg.type !== 'unknown';

  const statusIcon = { sent: '✓', delivered: '✓✓', read: '✓✓', failed: '✗', received: '' }[msg.status] || '';

  return (
    <div className={`msg-bubble ${isOut ? 'msg-outbound' : 'msg-inbound'}`}>
      {isMedia
        ? <MediaBubble msg={msg} convId={convId} />
        : <div>{msg.textBody || <em style={{ color: '#999' }}>[{msg.type}]</em>}</div>
      }
      {isMedia && msg.textBody && (
        <div style={{ marginTop: 4, fontSize: 13 }}>{msg.textBody}</div>
      )}
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
  const [selectedFile, setSelectedFile] = useState(null); // { file, preview, type }
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

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
    clearFile();
  }, [initialConv?.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Polling fallback: refresh messages every 5s while this conversation is open.
  // SSE is the primary real-time path, but LiteSpeed may drop the connection or
  // the server may restart — polling ensures messages always appear within 5s.
  useEffect(() => {
    if (!conv?.id) return;
    const t = setInterval(loadMessages, 5000);
    return () => clearInterval(t);
  }, [conv?.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!realtimeEvent || !conv) return;

    const sameConv =
      String(realtimeEvent.data?.conversationId) === String(conv.id);

    if (sameConv && (
      realtimeEvent.type === 'new_message' ||
      realtimeEvent.type === 'conversation_updated'
    )) {
      loadMessages();
      loadConversation();
    }

    if (realtimeEvent.type === 'message_status_updated') {
      setMessages((prev) =>
        prev.map((m) =>
          m.metaMessageId === realtimeEvent.data.metaMessageId ? { ...m, status: realtimeEvent.data.status } : m
        )
      );
    }
  }, [realtimeEvent, conv, loadMessages, loadConversation]);

  function clearFile() {
    setSelectedFile((prev) => {
      if (prev?.preview) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }

  function handleFileSelect(e) {
    const f = e.target.files[0];
    if (!f) return;
    const mediaType = getMediaType(f.mimetype || f.type);
    const preview = mediaType === 'image' ? URL.createObjectURL(f) : null;
    setSelectedFile({ file: f, preview, type: mediaType });
    setSendError('');
    e.target.value = '';
  }

  const handleSend = async () => {
    if ((!text.trim() && !selectedFile) || sending) return;
    setSending(true);
    setBlockError('');
    setSendError('');

    try {
      let responseData;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile.file);
        formData.append('type', selectedFile.type);
        if (text.trim()) formData.append('caption', text.trim());

        const { data } = await api.post(`/conversations/${conv.id}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });
        responseData = data;
      } else {
        const { data } = await api.post(`/conversations/${conv.id}/messages`, { text: text.trim() });
        responseData = data;
      }

      setMessages((prev) => [...prev, responseData.message]);
      setText('');
      clearFile();
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
    if (e.key === 'Enter' && !e.shiftKey && !selectedFile) {
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
        <button className="btn btn-icon btn-ghost back-btn" style={{ color: '#fff' }} onClick={onBack}>←</button>
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
      <FreeWindowBadge freeWindowExpiresAt={conv.freeWindowExpiresAt} lastCustomerMessageAt={conv.lastCustomerMessageAt} />

      {/* Messages */}
      <div className="chat-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40, fontSize: 13 }}>
            Nenhuma mensagem ainda.
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} convId={conv.id} />
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

      {/* File preview */}
      {selectedFile && (
        <div className="file-preview-box">
          {selectedFile.preview
            ? <img src={selectedFile.preview} alt="preview" className="file-preview-img" />
            : <div className="file-preview-icon">{MEDIA_ICONS[selectedFile.type]}</div>
          }
          <div className="file-preview-info">
            <span className="file-preview-name">{selectedFile.file.name}</span>
            <span className="file-preview-size">{(selectedFile.file.size / 1024).toFixed(0)} KB · {MEDIA_LABELS[selectedFile.type]}</span>
          </div>
          <button className="file-preview-remove" onClick={clearFile} aria-label="Remover arquivo">✕</button>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Attach button */}
        <button
          className="btn btn-icon btn-ghost attach-btn"
          disabled={!canReply || sending}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar arquivo"
          title="Enviar imagem, vídeo, áudio ou documento"
        >
          📎
        </button>

        <textarea
          rows={1}
          placeholder={
            selectedFile
              ? 'Legenda (opcional)...'
              : canReply
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
          disabled={!canReply || (!text.trim() && !selectedFile) || sending}
          onClick={handleSend}
          aria-label="Enviar"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  );
}
