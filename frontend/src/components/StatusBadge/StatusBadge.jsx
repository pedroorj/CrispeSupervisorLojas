import React from 'react';

const STATUS_MAP = {
  new:                    { label: 'Nova',           cls: 'badge-blue' },
  open:                   { label: 'Aberta',         cls: 'badge-green' },
  waiting_store_response: { label: 'Aguardando loja',cls: 'badge-orange' },
  waiting_customer:       { label: 'Aguardando cliente', cls: 'badge-gray' },
  resolved:               { label: 'Resolvida',      cls: 'badge-gray' },
  blocked_24h_expired:    { label: '24h expirada',   cls: 'badge-red' },
};

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'badge-gray' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
