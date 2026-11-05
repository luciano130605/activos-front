self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = {}; }
  event.waitUntil(self.registration.showNotification(payload.title || 'Alza', {
    body: payload.body || 'Tenés una novedad en tu cartera.',
    icon: '/icon.png', badge: '/icon.png',
    data: { url: ['/dividendos', '/precios'].includes(payload.url) ? payload.url : '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(window => window?.focus());
    return clients.openWindow(target);
  }));
});
