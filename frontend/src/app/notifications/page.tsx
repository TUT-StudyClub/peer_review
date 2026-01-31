"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, ClipboardList, Clock, Loader2, RefreshCcw } from "lucide-react";

import { useAuth } from "@/app/providers";
import { apiListMyTARequests, formatApiError } from "@/lib/api";
import type { TAReviewRequestPublic, TAReviewRequestStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    getNotificationHistory,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    type NotificationItem,
} from "@/lib/notifications";

const STATUS_LABEL: Record<TAReviewRequestStatus, string> = {
    offered: "依頼中",
    accepted: "受諾済み",
    declined: "完了",
};

const statusTone = (status: TAReviewRequestStatus) =>
    status === "offered"
        ? "bg-amber-100 text-amber-900"
        : status === "accepted"
            ? "bg-blue-100 text-blue-900"
            : "bg-emerald-100 text-emerald-900";

function StatusPill({ status }: { status: TAReviewRequestStatus }) {
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(status)}`}>{STATUS_LABEL[status]}</span>;
}

function shortId(id: string) {
    return id.slice(0, 8);
}

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

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

    if (diffMinutes < 1) return "たった今";
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString("ja-JP");
}

export default function NotificationsPage() {
    const { token, user } = useAuth();

    // TA依頼関連の状態
    const [requests, setRequests] = useState<TAReviewRequestPublic[]>([]);
    const [loadingTA, setLoadingTA] = useState(false);
    const [errorTA, setErrorTA] = useState<string | null>(null);
    const isTA = user?.is_ta === true;

    // 通知履歴関連の状態
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(true);
    const [errorNotifications, setErrorNotifications] = useState<string | null>(null);

    // TA依頼を読み込む
    const loadRequests = useCallback(async () => {
        if (!token || !isTA) {
            setRequests([]);
            setErrorTA(null);
            setLoadingTA(false);
            return;
        }
        setLoadingTA(true);
        setErrorTA(null);
        try {
            const list = await apiListMyTARequests(token);
            setRequests(list);
        } catch (err) {
            setErrorTA(formatApiError(err));
        } finally {
            setLoadingTA(false);
        }
    }, [token, isTA]);

    // 通知履歴を取得する
    const fetchNotifications = useCallback(async () => {
        setLoadingNotifications(true);
        setErrorNotifications(null);
        try {
            const data = await getNotificationHistory();
            if (data) {
                setNotifications(data.notifications);
                setUnreadCount(data.unread_count);
            } else {
                setErrorNotifications("通知の取得に失敗しました");
            }
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
            setErrorNotifications("通知の取得に失敗しました");
        } finally {
            setLoadingNotifications(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

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

    const normalizedRequests = useMemo(
        () =>
            requests.map((request) => ({
                request,
                status: request.review_submitted ? "declined" : request.status,
            })),
        [requests]
    );

    const summary = useMemo(() => {
        return normalizedRequests.reduce(
            (acc, item) => {
                acc.total += 1;
                acc[item.status] += 1;
                return acc;
            },
            { total: 0, offered: 0, accepted: 0, declined: 0 }
        );
    }, [normalizedRequests]);

    const latestRequests = useMemo(() => {
        const sorted = [...normalizedRequests].sort((a, b) => {
            const aTime = new Date(a.request.created_at).getTime();
            const bTime = new Date(b.request.created_at).getTime();
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });
        return sorted.slice(0, 5);
    }, [normalizedRequests]);

    if (!user) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">通知</h1>
                <p className="text-muted-foreground">ログインすると通知を確認できます。</p>
                <Button asChild>
                    <Link href="/auth/login">ログイン</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">通知</h1>
                    <p className="text-sm text-muted-foreground">TA依頼やシステム通知をまとめて確認できます。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isTA ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void loadRequests()}
                                disabled={loadingTA}
                                className="gap-2"
                            >
                                <RefreshCcw className="h-4 w-4" />
                                {loadingTA ? "更新中..." : "更新"}
                            </Button>
                            <Button asChild size="sm">
                                <Link href="/ta/requests">TA依頼一覧へ</Link>
                            </Button>
                        </>
                    ) : (
                        <Button asChild variant="outline" size="sm">
                            <Link href="/mypage">マイページへ</Link>
                        </Button>
                    )}
                </div>
            </div>

            {errorTA ? (
                <Alert variant="destructive">
                    <AlertTitle>TA依頼の取得に失敗しました</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">{errorTA}</AlertDescription>
                </Alert>
            ) : null}

            {/* 通知履歴セクション */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            通知一覧
                        </CardTitle>
                        {unreadCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                            >
                                すべて既読にする
                            </Button>
                        )}
                    </div>
                    <CardDescription>未読の通知が表示されます</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingNotifications ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                            <p>読み込み中...</p>
                        </div>
                    ) : errorNotifications ? (
                        <div className="flex flex-col items-center justify-center py-12 text-red-400">
                            <p>{errorNotifications}</p>
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
                                            className={`inline-block h-2 w-2 rounded-full ${notification.is_read ? "bg-slate-300" : "bg-slate-900"}`}
                                        />
                                    </div>

                                    {/* 通知内容 */}
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={`text-sm ${notification.is_read
                                                ? "text-slate-500"
                                                : "font-medium text-slate-900"
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
                </CardContent>
            </Card>

            {/* TA依頼セクション（TAのみ表示） */}
            {isTA ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">総依頼数</div>
                                <div className="text-lg font-semibold">{summary.total}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">依頼中</div>
                                <div className="text-lg font-semibold">{summary.offered}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">受諾済み</div>
                                <div className="text-lg font-semibold">{summary.accepted}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">完了</div>
                                <div className="text-lg font-semibold">{summary.declined}</div>
                            </div>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>最近のTA依頼</CardTitle>
                            <CardDescription>最新5件の依頼を表示します。</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingTA ? (
                                <p className="text-sm text-muted-foreground">読み込み中...</p>
                            ) : latestRequests.length === 0 ? (
                                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                    <div>新しいTA依頼はありません。</div>
                                    <div>依頼が届いたらここに表示されます。</div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {latestRequests.map((item) => (
                                        <div key={item.request.id} className="rounded-lg border bg-background p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-foreground">
                                                        TA依頼 #{shortId(item.request.id)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        提出ID: {shortId(item.request.submission_id)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        依頼日時: {formatDateTime(item.request.created_at)}
                                                    </div>
                                                </div>
                                                <StatusPill status={item.status} />
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Button asChild variant="outline" size="sm">
                                                    <Link href="/ta/requests">TA依頼一覧を開く</Link>
                                                </Button>
                                                <Button asChild size="sm">
                                                    <Link href={`/assignments/${item.request.assignment_id}`}>課題ページを開く</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-muted-foreground" />
                            TA依頼
                        </CardTitle>
                        <CardDescription>現在表示できるTA依頼はありません。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>TA依頼はTA資格のある学生にのみ届きます。</p>
                        <p>資格やクレジット状況はマイページで確認できます。</p>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/mypage">マイページで確認</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
