// Service Worker for Push Notifications

// プッシュ通知を受信したとき
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
    //icon: data.icon || "/icon-192.png",
    //badge: data.badge || "/badge-72.png",
    data: {
      url: data.url || "/",
    },
    // 通知の動作設定
    requireInteraction: true, // 自動で消さず、ユーザーが気づくまで残す
    silent: false, // 音を鳴らす
    vibrate: [200, 100, 200], // バイブレーション（モバイル）
    tag: data.tag || "default", // 同じtagの通知は上書き
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Peer Review", options)
  );
});

// 通知をクリックしたとき
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);

  event.notification.close();

  const url = event.notification.data?.url || "/";
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 既に開いているタブがあればフォーカス
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client) {
                return client.navigate(fullUrl);
              }
            });
          }
        }
        // なければ新しいタブで開く
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Service Workerがインストールされたとき
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  self.skipWaiting();
});

// Service Workerがアクティブになったとき
self.addEventListener("activate", (event) => {
  console.log("[SW] Activated");
  event.waitUntil(clients.claim());
});
