// Server-Sent Events client
let eventSource = null;
const handlers = {};

export function connectSSE(token, onEvent) {
  if (eventSource) eventSource.close();

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
    // Auto-reconnect after 5s
    setTimeout(() => {
      const t = localStorage.getItem('token');
      if (t) connectSSE(t, onEvent);
    }, 5000);
  };

  return () => eventSource?.close();
}

export function disconnectSSE() {
  eventSource?.close();
  eventSource = null;
}
