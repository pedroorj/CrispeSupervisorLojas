import React, { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/apiClient';
import StatusBadge from '../StatusBadge/StatusBadge';
import StoreFilter from '../StoreFilter/StoreFilter';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function isFreeWindowActive(expiresAt) {
  if (!expiresAt) return false;
  return new Date() < new Date(expiresAt);
}

export default function ConversationList({ selectedId, onSelect, realtimeEvent }) {
  const [conversations, setConversations] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const params = {};
    if (storeId) params.storeId = storeId;
    if (status) params.status = status;
    if (search) params.search = search;

    api.get('/conversations', { params })
      .then(({ data }) => setConversations(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId, status, search]);

  useEffect(() => { load(); }, [load]);

  // React to SSE events
  useEffect(() => {
    if (!realtimeEvent) return;
    if (realtimeEvent.type === 'new_message' || realtimeEvent.type === 'conversation_updated') {
      load();
    }
  }, [realtimeEvent, load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search bar */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <input
          className="input"
          placeholder="🔍 Buscar conversa..."
          style={{ fontSize: 14 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Store filter */}
      <StoreFilter value={storeId} onChange={setStoreId} />

      {/* Status filter */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ fontSize: 13 }}
        >
          <option value="">Todos os status</option>
          <option value="new">Nova</option>
          <option value="waiting_store_response">Aguardando resposta</option>
          <option value="open">Aberta</option>
          <option value="waiting_customer">Aguardando cliente</option>
          <option value="resolved">Resolvida</option>
          <option value="blocked_24h_expired">24h expirada</option>
        </select>
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Carregando…
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhuma conversa encontrada.
          </div>
        )}

        {conversations.map((conv) => {
          const name = conv.contact?.profileName || conv.contact?.phoneNumber || 'Desconhecido';
          const isActive = isFreeWindowActive(conv.freeWindowExpiresAt);
          const lastAt = conv.lastMessageAt
            ? formatDistanceToNow(new Date(conv.lastMessageAt), { locale: ptBR, addSuffix: true })
            : '';

          return (
            <div
              key={conv.id}
              className={`conv-item${selectedId === conv.id ? ' active' : ''}`}
              onClick={() => onSelect(conv)}
            >
              <div className="avatar">{getInitials(name)}</div>

              <div className="min-w-0" style={{ flex: 1 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{name}</span>
                  <span className="text-xs text-secondary" style={{ whiteSpace: 'nowrap' }}>{lastAt}</span>
                </div>

                <div className="flex items-center justify-between gap-2" style={{ marginTop: 2 }}>
                  <span className="text-sm text-secondary truncate">{conv.lastMessagePreview}</span>
                  {conv.unreadCountOwner > 0 && (
                    <span className="unread-badge">{conv.unreadCountOwner}</span>
                  )}
                </div>

                <div className="flex items-center gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                  <span className="text-xs text-secondary" style={{ background: '#f3f4f6', padding: '1px 7px', borderRadius: 99 }}>
                    {conv.store?.displayName}
                  </span>
                  <StatusBadge status={conv.status} />
                  {isActive && (
                    <span className="badge badge-green" title="Janela gratuita ativa">✅ 24h</span>
                  )}
                  {conv.lastCustomerMessageAt && !isActive && (
                    <span className="badge badge-red" title="Janela gratuita expirada">⏰ Expirada</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
