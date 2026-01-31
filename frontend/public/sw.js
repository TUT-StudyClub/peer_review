// Service Worker: Push通知の受信とクリック処理
// v1.0.0

self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);

  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const title = data.title || '通知';
  const options = {
    body: data.body || '',
    // icon/badge を使う場合は public/ に配置してから指定する
    // icon: '/icon-192x192.png',
    // badge: '/badge-72x72.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // 既に開いているタブがあれば、そこに移動
        for (let client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // なければ新しいタブを開く
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
