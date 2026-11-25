self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let message;
  try { message = event.data.json(); } catch (_) { return; }
  if (message.kind !== 'self_blessing') return;
  const base = new URL('.', self.location.href);
  event.waitUntil(self.registration.showNotification(message.title || 'ברכה לעצמי', {
    body: message.body || '', icon: new URL('icons/Icon-192.png', base).href,
    tag: 'self-blessing-' + message.id, data: { id: message.id }, dir: 'rtl', lang: 'he',
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const base = new URL('.', self.location.href);
  const url = new URL('?v=' + Date.now() + '#/notifications?id=' + encodeURIComponent(event.notification.data?.id || ''), base).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
    const client = windows.find((item) => item.url.startsWith(base.href));
    if (client) { await client.navigate(url); return client.focus(); }
    return self.clients.openWindow(url);
  }));
});
