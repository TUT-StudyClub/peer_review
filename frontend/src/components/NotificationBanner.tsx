'use client';

import { usePushNotification } from '@/hooks/usePushNotification';
import { X, Bell } from 'lucide-react';
import { useState } from 'react';

export default function NotificationBanner() {
    const { permission, isSupported, isLoading, requestPermission } = usePushNotification();
    const [isVisible, setIsVisible] = useState(true);

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
