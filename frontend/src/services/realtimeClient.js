// Server-Sent Events client
let eventSource = null;
let reconnectTimer = null;
let lastOnEvent = null;

export function connectSSE(token, onEvent) {
  lastOnEvent = onEvent;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const url = `/api/events?token=${encodeURIComponent(token)}`;
  eventSource = new EventSource(url);

  eventSource.addEventListener('new_message', (e) => {
    try { onEvent('new_message', JSON.parse(e.data)); } catch {}
  });

  eventSource.addEventListener('conversation_updated', (e) => {
    try { onEvent('conversation_updated', JSON.parse(e.data)); } catch {}
  });

  eventSource.addEventListener('message_status_updated', (e) => {
    try { onEvent('message_status_updated', JSON.parse(e.data)); } catch {}
  });

  eventSource.onerror = () => {
    eventSource?.close();
    eventSource = null;
    // Reconnect after 3s
    reconnectTimer = setTimeout(() => {
      const t = localStorage.getItem('token');
      if (t && lastOnEvent) connectSSE(t, lastOnEvent);
    }, 3000);
  };

  return () => {
    eventSource?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

export function disconnectSSE() {
  eventSource?.close();
  eventSource = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
}
