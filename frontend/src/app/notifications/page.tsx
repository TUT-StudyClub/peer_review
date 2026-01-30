'use client';

import { useState } from 'react';
import { usePushNotification } from '@/hooks/usePushNotification';
import { Bell, BellOff } from 'lucide-react';

// 通知データの型定義
type NotificationItem = {
    id: string;
    title: string;
    description: string;
    time: string;
    isRead: boolean;
};

// ダミーデータ（将来的にはAPIから取得）
const initialNotifications: NotificationItem[] = [
    {
        id: '1',
        title: '新しい課題が割り当てられました',
        description: 'プログラミング基礎の課題をレビューしてください',
        time: '2時間前',
        isRead: false,
    },
    {
        id: '2',
        title: 'レビュー期限が近づいています',
        description: 'データベース設計のレビュー期限は明日です',
        time: '5時間前',
        isRead: false,
    },
    {
        id: '3',
        title: 'レビューが承認されました',
        description: 'あなたのレビューが承認されました',
        time: '1日前',
        isRead: true,
    },
    {
        id: '4',
        title: 'クレジットが付与されました',
        description: 'レビュー完了により5クレジットが付与されました',
        time: '2日前',
        isRead: true,
    },
    {
        id: '5',
        title: '新しいメッセージ',
        description: '教員から新しいコメントがあります',
        time: '3日前',
        isRead: true,
    },
];

export default function NotificationsPage() {
    const { permission, isSupported, isLoading, isSubscribed, requestPermission, disableNotifications } = usePushNotification();
    const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

    // 既読にする
    const markAsRead = (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
    };

    // すべて既読にする
    const markAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    };

    // 通知トグルハンドラ
    const handleToggle = async () => {
        if (isSubscribed) {
            await disableNotifications();
        } else {
            await requestPermission();
        }
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            {/* ヘッダーセクション */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">通知</h1>
                        <p className="mt-1 text-sm text-slate-500">未読の通知が表示されます</p>
                    </div>
                    {/* 通知ON/OFFトグル */}
                    {isSupported && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">
                                {isSubscribed ? 'プッシュ通知ON' : 'プッシュ通知OFF'}
                            </span>
                            <button
                                onClick={handleToggle}
                                disabled={isLoading || permission === 'denied'}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${isSubscribed ? 'bg-blue-600' : 'bg-slate-300'
                                    }`}
                                title={permission === 'denied' ? 'ブラウザの設定で通知がブロックされています' : ''}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isSubscribed ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    )}
                </div>
                {permission === 'denied' && (
                    <p className="mt-3 text-xs text-amber-600">
                        ⚠️ ブラウザの設定で通知がブロックされています。ブラウザの設定から通知を許可してください。
                    </p>
                )}
            </div>

            {/* 通知一覧セクション */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">通知一覧</h2>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            すべて既読にする
                        </button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Bell className="mb-4 h-12 w-12" />
                        <p>通知はありません</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className="flex items-start gap-3 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                            >
                                {/* 既読/未読マーカー */}
                                <div className="mt-1.5 flex-shrink-0">
                                    <span
                                        className={`inline-block h-2 w-2 rounded-full ${notification.isRead ? 'bg-slate-300' : 'bg-slate-900'
                                            }`}
                                    />
                                </div>

                                {/* 通知内容 */}
                                <div className="flex-1 min-w-0">
                                    <p
                                        className={`text-sm ${notification.isRead
                                                ? 'text-slate-500'
                                                : 'font-medium text-slate-900'
                                            }`}
                                    >
                                        {notification.title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                                        {notification.description}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">{notification.time}</p>
                                </div>

                                {/* 既読ボタン（未読の場合のみ） */}
                                {!notification.isRead && (
                                    <button
                                        onClick={() => markAsRead(notification.id)}
                                        className="flex-shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        既読にする
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
