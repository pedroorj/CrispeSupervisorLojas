import React, { useEffect, useState } from 'react';
import api from '../../services/apiClient';

export default function StoreFilter({ value, onChange }) {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    api.get('/stores').then(({ data }) => setStores(data.stores)).catch(console.error);
  }, []);

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
      <select
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ fontSize: 14 }}
      >
        <option value="">Todas as lojas</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>{s.displayName}</option>
        ))}
      </select>
    </div>
  );
}
