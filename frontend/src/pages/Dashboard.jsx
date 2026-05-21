import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectSSE } from '../services/realtimeClient';
import { subscribePush } from '../services/pushClient';
import ConversationList from '../components/ConversationList/ConversationList';
import ConversationView from '../components/ConversationView/ConversationView';
import DashboardCards from '../components/DashboardCards/DashboardCards';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [selectedConv, setSelectedConv] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [realtimeEvent, setRealtimeEvent] = useState(null);
  const [cardsTrigger, setCardsTrigger] = useState(0);
  const [pushStatus, setPushStatus] = useState('idle');

  // Subscribe to SSE
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    const cleanup = connectSSE(token, (type, data) => {
      setRealtimeEvent({ type, data, ts: Date.now() });
      if (type === 'new_message') setCardsTrigger((n) => n + 1);
    });
    return cleanup;
  }, []);

  const handleSelect = useCallback((conv) => {
    setSelectedConv(conv);
    setShowChat(true);
  }, []);

  const handleBack = () => {
    setShowChat(false);
    setSelectedConv(null);
  };

  const handleEnablePush = async () => {
    setPushStatus('loading');
    const ok = await subscribePush();
    setPushStatus(ok ? 'enabled' : 'denied');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className={`sidebar${showChat ? ' hidden' : ''}`}>
        {/* Sidebar header */}
        <div className="header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>💬 WA Supervisor</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>🔒 Modo Gratuito Ativo</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {pushStatus !== 'enabled' && (
              <button
                className="btn btn-icon btn-ghost"
                style={{ color: '#fff', fontSize: 18 }}
                title="Ativar notificações"
                onClick={handleEnablePush}
                disabled={pushStatus === 'loading'}
              >
                🔔
              </button>
            )}
            <Link
              to="/stores"
              className="btn btn-icon btn-ghost"
              style={{ color: '#fff', fontSize: 16 }}
              title="Lojas"
            >
              🏪
            </Link>
            <Link
              to="/reports"
              className="btn btn-icon btn-ghost"
              style={{ color: '#fff', fontSize: 16 }}
              title="Relatórios"
            >
              📊
            </Link>
            <button
              className="btn btn-icon btn-ghost"
              style={{ color: '#fff', fontSize: 16 }}
              title={`Sair (${user?.name})`}
              onClick={logout}
            >
              👤
            </button>
          </div>
        </div>

        {/* Dashboard cards */}
        <DashboardCards refreshTrigger={cardsTrigger} />

        {/* Conversation list */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ConversationList
            selectedId={selectedConv?.id}
            onSelect={handleSelect}
            realtimeEvent={realtimeEvent}
          />
        </div>
      </div>

      {/* Main panel */}
      <div className={`main-panel${showChat ? ' visible' : ''}`}>
        <ConversationView
          conversation={selectedConv}
          realtimeEvent={realtimeEvent}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}
