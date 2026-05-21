import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

const EMPTY = { name: '', displayName: '', whatsappPhoneNumber: '', metaPhoneNumberId: '', metaWabaId: '' };

export default function Stores() {
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/stores').then(({ data }) => setStores(data.stores)).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/stores/${editId}`, form);
      } else {
        await api.post('/stores', form);
      }
      setForm(EMPTY);
      setEditId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar loja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: 16 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Link to="/" className="btn btn-ghost" style={{ fontSize: 20 }}>←</Link>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Lojas WhatsApp</h2>
          {canEdit && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true); }}
            >
              + Nova loja
            </button>
          )}
        </div>

        {showForm && canEdit && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>{editId ? 'Editar loja' : 'Nova loja'}</h3>
            {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['name', 'Nome interno (slug)', 'ex: loja-centro'],
                ['displayName', 'Nome exibido', 'ex: Loja Centro'],
                ['whatsappPhoneNumber', 'Número WhatsApp', 'ex: 5511999999999'],
                ['metaPhoneNumberId', 'Phone Number ID (Meta)', 'do painel Meta Developers'],
                ['metaWabaId', 'WABA ID (Meta)', 'WhatsApp Business Account ID'],
              ].map(([field, label, ph]) => (
                <div className="form-group" key={field}>
                  <label>{label}</label>
                  <input
                    className="input"
                    placeholder={ph}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    required
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {stores.map((s) => (
          <div key={s.id} className="card" style={{ marginBottom: 10, display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{s.displayName}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.whatsappPhoneNumber}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                Phone ID: {s.metaPhoneNumberId}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <span className={`badge ${s.active ? 'badge-green' : 'badge-gray'}`}>
                {s.active ? 'Ativa' : 'Inativa'}
              </span>
              {canEdit && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setForm({ name: s.name, displayName: s.displayName, whatsappPhoneNumber: s.whatsappPhoneNumber, metaPhoneNumberId: s.metaPhoneNumberId, metaWabaId: s.metaWabaId }); setEditId(s.id); setShowForm(true); window.scrollTo(0, 0); }}
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        ))}

        {stores.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
            Nenhuma loja cadastrada ainda.
          </div>
        )}
      </div>
    </div>
  );
}
