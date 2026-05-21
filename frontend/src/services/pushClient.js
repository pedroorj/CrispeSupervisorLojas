import api from './apiClient';

export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Not supported in this browser.');
    return false;
  }

  // iOS Safari requires user gesture — this is called from UI
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const { data } = await api.get('/push/vapid-key');
    if (!data.publicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });

    await api.post('/push/subscribe', sub.toJSON());
    return true;
  } catch (err) {
    console.error('[Push] Subscribe error:', err);
    return false;
  }
}

export async function testPushNotification() {
  await api.post('/push/test');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
