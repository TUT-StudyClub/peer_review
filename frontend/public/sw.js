// Service Worker for Push Notifications

// プッシュ通知を受信したとき（eventを使うのでそのまま）
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  if (!event.data) {
    console.log("[SW] No data in push event");
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error("[SW] Failed to parse push data:", e);
    return;
  }

  const options = {
    body: data.body || "",
    data: {
      url: data.url || "/",
    },
    requireInteraction: false,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Peer Review", options)
  );
});

// 通知をクリックしたとき（eventを使うのでそのまま）
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);

  event.notification.close();

  const url = event.notification.data?.url || "/";
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client) {
                return client.navigate(fullUrl);
              }
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// 引数を使わないので () にする
self.addEventListener("install", () => {
  console.log("[SW] Installing...");
  self.skipWaiting();
});

// event.waitUntil を使っているので (event) に戻し、名前を一致させる
self.addEventListener("activate", (event) => {
  console.log("[SW] Activated");
  event.waitUntil(clients.claim());
});
