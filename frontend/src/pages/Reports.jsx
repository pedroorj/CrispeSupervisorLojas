import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/apiClient';

function fmt(s) {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

export default function Reports() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState(null);
  const [storeData, setStoreData] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/reports/summary', { params: { from, to } }),
      api.get('/reports/by-store', { params: { from, to } }),
    ])
      .then(([s, bs]) => {
        setSummary(s.data);
        setStoreData(bs.data.stores);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: 16 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link to="/" className="btn btn-ghost" style={{ fontSize: 20 }}>←</Link>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Relatórios</h2>
        </div>

        {/* Filters */}
        <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <label>De</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <label>Até</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Buscando…' : 'Aplicar filtro'}
          </button>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="cards-grid" style={{ padding: 0, marginBottom: 16 }}>
            {[
              { v: summary.totalReceived,  l: 'Mensagens recebidas',       c: 'var(--info)' },
              { v: summary.totalSent,      l: 'Mensagens respondidas',     c: 'var(--wa-dark)' },
              { v: summary.unresolved,     l: 'Conversas pendentes',       c: 'var(--warning)' },
              { v: summary.resolved,       l: 'Conversas resolvidas',      c: 'var(--wa-green)' },
              { v: summary.expired,        l: '24h expiradas',             c: 'var(--danger)' },
              { v: fmt(summary.avgFirstResponseSeconds), l: 'Tempo médio 1ª resposta' },
            ].map(({ v, l, c }, i) => (
              <div key={i} className="stat-card">
                <div className="stat-value" style={{ color: c || 'var(--wa-dark)' }}>{v ?? '—'}</div>
                <div className="stat-label">{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* By store table */}
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Por loja</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Loja', 'Recebidas', 'Respondidas', 'Resolvidas', 'Tempo 1ª resp.'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeData.map(({ store, received, sent, resolved, avgFirstResponseSeconds }) => (
                  <tr key={store.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{store.displayName}</td>
                    <td style={{ padding: '10px 12px' }}>{received}</td>
                    <td style={{ padding: '10px 12px' }}>{sent}</td>
                    <td style={{ padding: '10px 12px' }}>{resolved}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(avgFirstResponseSeconds)}</td>
                  </tr>
                ))}
                {storeData.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Sem dados para o período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
