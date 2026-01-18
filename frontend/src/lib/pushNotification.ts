/**
 * プッシュ通知ユーティリティ
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/**
 * プッシュ通知がサポートされているか確認
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * 現在の通知許可状態を取得
 */
export function getPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Service Workerを登録
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    console.warn("[Push] Service Worker not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("[Push] Service Worker registered:", registration.scope);
    return registration;
  } catch (error) {
    console.error("[Push] Service Worker registration failed:", error);
    return null;
  }
}

/**
 * VAPID公開鍵を取得
 */
async function getVapidPublicKey(token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/notifications/vapid-public-key`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error("[Push] Failed to get VAPID key:", response.status);
      return null;
    }

    const data = await response.json();
    return data.public_key;
  } catch (error) {
    console.error("[Push] Failed to get VAPID key:", error);
    return null;
  }
}

/**
 * Base64文字列をUint8Arrayに変換（VAPID鍵用）
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * プッシュ通知を購読
 */
export async function subscribePush(token: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn("[Push] Push notifications not supported");
    return false;
  }

  try {
    // 1. 通知許可をリクエスト
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[Push] Notification permission denied");
      return false;
    }

    // 2. Service Worker登録を取得
    const registration = await navigator.serviceWorker.ready;

    // 3. VAPID公開鍵を取得
    const vapidPublicKey = await getVapidPublicKey(token);
    if (!vapidPublicKey) {
      console.error("[Push] VAPID public key not available");
      return false;
    }

    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

    // 4. プッシュマネージャーで購読
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey as BufferSource,
    });

    // 5. 購読情報をバックエンドに送信
    const subscriptionJson = subscription.toJSON();

    const response = await fetch(`${API_BASE}/api/notifications/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys?.p256dh,
        auth_key: subscriptionJson.keys?.auth,
        user_agent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save subscription");
    }

    console.log("[Push] Successfully subscribed");
    return true;
  } catch (error) {
    console.error("[Push] Failed to subscribe:", error);
    return false;
  }
}

/**
 * プッシュ通知の購読を解除
 */
export async function unsubscribePush(token: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // ブラウザ側の購読を解除
      await subscription.unsubscribe();

      // バックエンドに通知
      await fetch(
        `${API_BASE}/api/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }

    console.log("[Push] Successfully unsubscribed");
    return true;
  } catch (error) {
    console.error("[Push] Failed to unsubscribe:", error);
    return false;
  }
}

/**
 * 現在購読中か確認
 */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * 通知設定を取得
 */
export async function getNotificationPreferences(token: string) {
  const response = await fetch(`${API_BASE}/api/notifications/preferences`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get preferences");
  }

  return response.json();
}

/**
 * 通知設定を更新
 */
export async function updateNotificationPreferences(
  token: string,
  preferences: {
    push_review_received?: boolean;
    push_deadline_reminder?: boolean;
    push_feedback_received?: boolean;
    push_meta_review?: boolean;
  }
) {
  const response = await fetch(`${API_BASE}/api/notifications/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    throw new Error("Failed to update preferences");
  }

  return response.json();
}
