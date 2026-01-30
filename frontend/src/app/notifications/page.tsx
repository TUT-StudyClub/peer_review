'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import {
    getNotificationHistory,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    type NotificationItem,
} from '@/lib/notifications';

/**
 * 日時をフレンドリーな形式に変換する
 */
function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP');
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 通知履歴を取得する
    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getNotificationHistory();
            if (data) {
                setNotifications(data.notifications);
                setUnreadCount(data.unread_count);
            } else {
                setError('通知の取得に失敗しました');
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
            setError('通知の取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // 既読にする
    const handleMarkAsRead = async (id: string) => {
        const success = await markNotificationAsRead(id);
        if (success) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
    };

    // すべて既読にする
    const handleMarkAllAsRead = async () => {
        const success = await markAllNotificationsAsRead();
        if (success) {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                {/* ヘッダーセクション */}
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">通知</h1>
                <p className="text-muted-foreground mt-1">未読の通知が表示されます</p>
            </div>

            {/* 通知一覧セクション */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">通知一覧</h2>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            すべて既読にする
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                        <p>読み込み中...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-red-400">
                        <p>{error}</p>
                        <button
                            onClick={fetchNotifications}
                            className="mt-4 text-blue-600 hover:underline"
                        >
                            再試行
                        </button>
                    </div>
                ) : notifications.length === 0 ? (
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
                                        className={`inline-block h-2 w-2 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-slate-900'
                                            }`}
                                    />
                                </div>

                                {/* 通知内容 */}
                                <div className="flex-1 min-w-0">
                                    <p
                                        className={`text-sm ${notification.is_read
                                                ? 'text-slate-500'
                                                : 'font-medium text-slate-900'
                                            }`}
                                    >
                                        {notification.title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                                        {notification.body}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {formatTime(notification.created_at)}
                                    </p>
                                </div>

                                {/* 既読ボタン（未読の場合のみ） */}
                                {!notification.is_read && (
                                    <button
                                        onClick={() => handleMarkAsRead(notification.id)}
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
