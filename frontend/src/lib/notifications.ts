/**
 * Push通知関連のユーティリティ関数
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Service Workerを登録する
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Push通知のサブスクリプションを作成し、サーバーに送信する
 */
export async function subscribeUser(): Promise<boolean> {
    try {
        // 1. Service Worker登録
        const registration = await registerServiceWorker();
        if (!registration) {
            throw new Error('Service Worker registration failed');
        }

        // 2. VAPID公開鍵を取得
        const vapidResponse = await fetch(`${API_BASE_URL}/notifications/vapid-public-key`);
        if (!vapidResponse.ok) {
            throw new Error(`Failed to fetch VAPID public key: ${vapidResponse.status}`);
        }
        const vapidData = await vapidResponse.json();
        const publicKey = vapidData.publicKey;

        if (!publicKey) {
            console.error('VAPID public key response:', vapidData);
            throw new Error('VAPID public key is not configured on the server');
        }

        // 3. Push通知サブスクリプションを作成
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer
        });

        // 4. サブスクリプション情報を取得
        const subscriptionJson = subscription.toJSON();
        if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
            throw new Error('Invalid subscription object');
        }

        // 5. サーバーに送信
        const token = localStorage.getItem('pure-review-token') ?? sessionStorage.getItem('pure-review-token');

        if (!token) {
            console.error('No auth token found - user may not be logged in');
            throw new Error('認証トークンがありません。再度ログインしてください。');
        }

        console.log('Sending subscription to server...');
        const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                endpoint: subscriptionJson.endpoint,
                p256dh_key: subscriptionJson.keys.p256dh,
                auth_key: subscriptionJson.keys.auth
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', response.status, errorText);
            throw new Error(`サーバーへの登録に失敗しました: ${response.status}`);
        }

        console.log('Push notification subscription successful');
        return true;
    } catch (error) {
        console.error('Failed to subscribe user:', error);
        alert('通知の登録に失敗しました。ページをリロードして再度お試しください。');
        return false;
    }
}

/**
 * Push通知のサブスクリプションを解除する
 */
export async function unsubscribeUser(): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            console.log('No active subscription found');
            return true;
        }

        // 1. ブラウザ側のサブスクリプションを解除
        await subscription.unsubscribe();

        // 2. サーバー側のサブスクリプションを削除
        const token = localStorage.getItem('pure-review-token') ?? sessionStorage.getItem('pure-review-token');
        const response = await fetch(
            `${API_BASE_URL}/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete subscription: ${response.statusText}`);
        }

        console.log('Push notification unsubscribed');
        return true;
    } catch (error) {
        console.error('Failed to unsubscribe user:', error);
        return false;
    }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * ブラウザにアクティブなサブスクリプションが存在するか確認する
 */
export async function checkSubscriptionExists(): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator)) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return subscription !== null;
    } catch (error) {
        console.error('Failed to check subscription:', error);
        return false;
    }
}
