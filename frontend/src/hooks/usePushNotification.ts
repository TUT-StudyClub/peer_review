'use client';

import { useState, useEffect } from 'react';
import { subscribeUser, unsubscribeUser, checkSubscriptionExists } from '@/lib/notifications';

export function usePushNotification() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    // ページロード時・フォーカス復帰時に通知の状態を確認
    useEffect(() => {
        // ブラウザがPush通知に対応しているか確認
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }
        setIsSupported(true);
        setPermission(Notification.permission);

        // サブスクリプション状態を確認
        checkSubscriptionExists().then(setIsSubscribed);

        // 通知が許可されている場合、サブスクリプションの状態を確認して自動再登録
        if (Notification.permission === 'granted') {
            ensureSubscription();
        }

        // タブがフォーカスされた時に権限とサブスクリプションを再確認
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const currentPermission = Notification.permission;
                setPermission(currentPermission);
                checkSubscriptionExists().then(setIsSubscribed);

                // 権限が許可されていればサブスクリプションを確認・再登録
                if (currentPermission === 'granted') {
                    ensureSubscription();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // サブスクリプションが存在しない場合は再登録
    const ensureSubscription = async () => {
        try {
            const exists = await checkSubscriptionExists();
            setIsSubscribed(exists);
            if (!exists) {
                console.log('Subscription not found, auto-subscribing...');
                await subscribeUser();
                setIsSubscribed(true);
            }
        } catch (error) {
            console.error('Failed to ensure subscription:', error);
        }
    };

    const requestPermission = async () => {
        setIsLoading(true);
        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                await subscribeUser();
                setIsSubscribed(true);
            }
        } catch (error) {
            console.error('Notification setup failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    const disableNotifications = async () => {
        setIsLoading(true);
        try {
            await unsubscribeUser();
            setIsSubscribed(false);
            setPermission(Notification.permission);
        } catch (error) {
            console.error('Failed to disable notifications', error);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        permission,
        isSupported,
        isLoading,
        isSubscribed,
        requestPermission,
        disableNotifications
    };
}
