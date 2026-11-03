self.addEventListener('push', event => {
  let data = { title: 'FreshCart update', body: 'Your order has a new update.', url: '/' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'FreshCart update', {
    body: data.body || 'Your order has a new update.', icon: '/favicon.svg', badge: '/favicon.svg',
    data: { url: data.url || '/' }, tag: data.tag || 'freshcart-order-update', renotify: true
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) { if (client.url.startsWith(self.location.origin) && 'focus' in client) return client.focus().then(() => client.navigate(target)); }
    return clients.openWindow(target);
  }));
});
