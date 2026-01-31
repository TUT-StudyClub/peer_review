"use client";

import { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
    getNotificationHistory,
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

export function RecentNotifications() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getNotificationHistory(5); // 最新5件のみ取得
            if (data) {
                setNotifications(data.notifications);
                setUnreadCount(data.unread_count);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <p className="text-sm">読み込み中...</p>
            </div>
        );
    }

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Bell className="mb-2 h-8 w-8 opacity-20" />
                <p className="text-sm">通知はありません</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">最新の通知</span>
                    {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white bg-slate-900 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <Link
                    href="/notifications"
                    className="flex items-center text-xs text-blue-600 hover:underline"
                >
                    すべて見る
                    <ChevronRight size={14} />
                </Link>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className="flex items-start gap-3 p-3 transition-colors hover:bg-white"
                    >
                        <div className="mt-1 flex-shrink-0">
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-slate-900'
                                    }`}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs ${notification.is_read ? 'text-slate-500' : 'font-medium text-slate-900'} truncate`}>
                                {notification.title}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                                {formatTime(notification.created_at)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
