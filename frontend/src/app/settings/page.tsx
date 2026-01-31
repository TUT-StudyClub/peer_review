'use client';

import { usePushNotification } from '@/hooks/usePushNotification';
import { Bell, BellOff, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
    const { permission, isSupported, isLoading, isSubscribed, requestPermission, disableNotifications } = usePushNotification();
    const [isTesting, setIsTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);

    // テスト通知を送信
    const sendTestNotification = async () => {
        setIsTesting(true);
        setTestMessage(null);
        try {
            const token = localStorage.getItem('pure-review-token') ?? sessionStorage.getItem('pure-review-token');
            const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${apiUrl}/notifications/test`, {
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
            setTimeout(() => setTestMessage(null), 5000);
        }
    };

    // 通知のステータスを取得
    const getNotificationStatus = () => {
        if (!isSupported) {
            return { icon: <XCircle className="text-gray-400" size={20} />, text: '非対応', color: 'text-gray-500' };
        }
        if (permission === 'denied') {
            return { icon: <XCircle className="text-red-500" size={20} />, text: 'ブロック中', color: 'text-red-500' };
        }
        if (permission === 'granted' && isSubscribed) {
            return { icon: <CheckCircle className="text-green-500" size={20} />, text: '有効', color: 'text-green-500' };
        }
        return { icon: <AlertCircle className="text-yellow-500" size={20} />, text: '無効', color: 'text-yellow-500' };
    };

    const status = getNotificationStatus();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">設定</h1>
                <p className="text-muted-foreground mt-1">アプリの設定を管理します</p>
            </div>

            {/* 通知設定セクション */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Bell className="text-gray-600" size={20} />
                        <h2 className="font-semibold text-gray-900">プッシュ通知</h2>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* ステータス表示 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">通知ステータス</p>
                            <p className="text-sm text-gray-500">レビューを受け取ったときに通知されます</p>
                        </div>
                        <div className={`flex items-center gap-2 ${status.color}`}>
                            {status.icon}
                            <span className="font-medium">{status.text}</span>
                        </div>
                    </div>

                    {/* 通知ON/OFFボタン */}
                    {isSupported && permission !== 'denied' && (
                        <div className="flex items-center justify-between py-4 border-t border-gray-100">
                            <div>
                                <p className="font-medium text-gray-900">
                                    {permission === 'granted' && isSubscribed ? '通知を無効にする' : '通知を有効にする'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {permission === 'granted' && isSubscribed
                                        ? 'プッシュ通知の受信を停止します'
                                        : 'ブラウザからプッシュ通知を受け取れます'}
                                </p>
                            </div>
                            {permission === 'granted' && isSubscribed ? (
                                <button
                                    onClick={disableNotifications}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 text-red-700 font-medium rounded-lg transition"
                                >
                                    <BellOff size={18} />
                                    {isLoading ? '処理中...' : 'オフにする'}
                                </button>
                            ) : (
                                <button
                                    onClick={requestPermission}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
                                >
                                    <Bell size={18} />
                                    {isLoading ? '処理中...' : 'オンにする'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* ブロック時のメッセージ */}
                    {permission === 'denied' && (
                        <div className="py-4 border-t border-gray-100">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-700">
                                    通知がブラウザでブロックされています。通知を受け取るには、ブラウザの設定から通知を許可してください。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* テスト通知 */}
                    {permission === 'granted' && isSubscribed && (
                        <div className="flex items-center justify-between py-4 border-t border-gray-100">
                            <div>
                                <p className="font-medium text-gray-900">テスト通知</p>
                                <p className="text-sm text-gray-500">
                                    通知が正しく届くかテストします
                                </p>
                                {testMessage && (
                                    <p className="text-sm text-green-600 mt-1">{testMessage}</p>
                                )}
                            </div>
                            <button
                                onClick={sendTestNotification}
                                disabled={isTesting}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
                            >
                                <Send size={18} />
                                {isTesting ? '送信中...' : 'テスト送信'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
