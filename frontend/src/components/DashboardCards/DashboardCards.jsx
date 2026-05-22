import React, { useEffect, useState } from 'react';
import api from '../../services/apiClient';

function StatCard({ value, label, color = 'var(--wa-dark)' }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

export default function DashboardCards({ refreshTrigger }) {
  const [data, setData] = useState(null);

  const load = () => {
    api.get('/reports/summary')
      .then(({ data }) => setData(data))
      .catch(console.error);
  };

  useEffect(() => { load(); }, [refreshTrigger]);

  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="cards-grid">
      <StatCard value={data?.totalReceived} label="Mensagens recebidas hoje" color="var(--info)" />
      <StatCard value={data?.totalSent} label="Mensagens respondidas" color="var(--wa-dark)" />
      <StatCard value={data?.unresolved} label="Conversas pendentes" color="var(--warning)" />
      <StatCard value={data?.resolved} label="Conversas resolvidas" color="var(--wa-green)" />
      <StatCard value={data?.expired} label="Janela 24h expirada" color="var(--danger)" />
      <StatCard value={formatTime(data?.avgFirstResponseSeconds)} label="Tempo médio 1ª resposta" />
    </div>
  );
}
