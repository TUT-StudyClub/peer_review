'use client';

import { usePushNotification } from '@/hooks/usePushNotification';
import { X, Bell, Send } from 'lucide-react';
import { useState } from 'react';

export default function NotificationBanner() {
    const { permission, isSupported, isLoading, isSubscribed, requestPermission } = usePushNotification();
    const [isVisible, setIsVisible] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);

    // テスト通知を送信
    const sendTestNotification = async () => {
        setIsTesting(true);
        setTestMessage(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                setTestMessage('テスト通知を送信しました！');
            } else {
                setTestMessage('送信に失敗しました');
            }
        } catch {
            setTestMessage('エラーが発生しました');
        } finally {
            setIsTesting(false);
            setTimeout(() => setTestMessage(null), 3000);
        }
    };

    // 通知が許可されている場合はテストボタンを表示
    if (isSupported && permission === 'granted' && isSubscribed) {
        return (
            <div className="bg-green-50 border border-green-200 p-4 fixed bottom-20 md:bottom-4 right-4 max-w-sm shadow-xl rounded-2xl z-50">
                <div className="flex gap-3 items-center">
                    <div className="flex-shrink-0 bg-green-100 p-2 rounded-full">
                        <Bell className="text-green-600" size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-green-700 text-sm">通知が有効です</p>
                        {testMessage && (
                            <p className="text-green-600 text-xs mt-1">{testMessage}</p>
                        )}
                    </div>
                    <button
                        onClick={sendTestNotification}
                        disabled={isTesting}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-xs font-bold py-2 px-3 rounded-full transition flex items-center gap-1"
                    >
                        <Send size={14} />
                        {isTesting ? '送信中...' : 'テスト'}
                    </button>
                </div>
            </div>
        );
    }

    // 非対応、既に許可済み、拒否済み、またはユーザーが閉じた場合は表示しない
    if (!isSupported || permission !== 'default' || !isVisible) {
        return null;
    }

    return (
        <div className="bg-blue-50 border border-blue-200 p-4 fixed bottom-20 md:bottom-4 right-4 max-w-sm shadow-xl rounded-2xl z-50">
            <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 mt-0.5 bg-blue-100 p-2 rounded-full">
                    <Bell className="text-blue-600" size={18} />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-blue-700 text-sm">通知をオンにしませんか？</p>
                    <p className="text-blue-600 text-xs mt-1">
                        レビューが届いたときに、ブラウザを閉じていても通知を受け取れます。
                    </p>
                    <button
                        onClick={requestPermission}
                        disabled={isLoading}
                        className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold py-2 px-4 rounded-full transition"
                    >
                        {isLoading ? '設定中...' : '通知を許可する'}
                    </button>
                </div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-blue-400 hover:text-blue-600 flex-shrink-0 p-1 hover:bg-blue-100 rounded-full transition"
                    aria-label="閉じる"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
