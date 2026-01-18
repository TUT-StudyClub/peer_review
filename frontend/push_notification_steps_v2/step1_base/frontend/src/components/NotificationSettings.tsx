"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import {
  getNotificationPreferences,
  getPermissionState,
  isPushSupported,
  isSubscribed,
  registerServiceWorker,
  subscribePush,
  unsubscribePush,
  updateNotificationPreferences,
} from "@/lib/pushNotification";

type Preferences = {
  push_review_received: boolean;
  push_deadline_reminder: boolean;
  push_feedback_received: boolean;
  push_meta_review: boolean;
};

export function NotificationSettings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);

  // 初期化
  useEffect(() => {
    const init = async () => {
      // プッシュ通知のサポート確認
      const supported = isPushSupported();
      setPushSupported(supported);

      if (supported) {
        await registerServiceWorker();
        setPushPermission(getPermissionState());
        setPushSubscribed(await isSubscribed());
      }

      // 通知設定を取得
      if (token) {
        try {
          const prefs = await getNotificationPreferences(token);
          setPreferences(prefs);
        } catch (e) {
          console.error("Failed to load preferences:", e);
        }
      }

      setLoading(false);
    };

    init();
  }, [token]);

  // プッシュ通知を有効化
  const handleEnablePush = async () => {
    if (!token) return;
    setSaving(true);

    const success = await subscribePush(token);
    if (success) {
      setPushPermission("granted");
      setPushSubscribed(true);
      // 設定を再取得
      try {
        const prefs = await getNotificationPreferences(token);
        setPreferences(prefs);
      } catch (e) {
        console.error("Failed to load preferences:", e);
      }
    }

    setSaving(false);
  };

  // プッシュ通知を無効化
  const handleDisablePush = async () => {
    if (!token) return;
    setSaving(true);

    await unsubscribePush(token);
    setPushSubscribed(false);

    setSaving(false);
  };

  // 設定を更新
  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    if (!token || !preferences) return;

    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);

    try {
      await updateNotificationPreferences(token, { [key]: value });
    } catch (e) {
      console.error("Failed to update preference:", e);
      // 失敗したら戻す
      setPreferences(preferences);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">🔔 プッシュ通知</h2>
      <p className="mt-1 text-sm text-slate-500">
        ブラウザを閉じていても通知を受け取れます
      </p>

      <div className="mt-4">
        {!pushSupported ? (
          <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
            このブラウザはプッシュ通知に対応していません
          </div>
        ) : pushPermission === "denied" ? (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              プッシュ通知がブロックされています
            </p>
            <p className="mt-1 text-sm text-red-600">
              ブラウザの設定から通知を許可してください
            </p>
          </div>
        ) : !pushSubscribed ? (
          <button
            onClick={handleEnablePush}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "処理中..." : "プッシュ通知を有効にする"}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-600">
                ✅ プッシュ通知は有効です
              </span>
              <button
                onClick={handleDisablePush}
                disabled={saving}
                className="text-sm text-slate-500 underline hover:text-slate-700"
              >
                無効にする
              </button>
            </div>

            {/* 個別設定 */}
            {preferences && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-slate-700">通知の種類</p>
                <ToggleItem
                  label="レビュー受信時"
                  description="自分の提出物にレビューが届いたとき"
                  checked={preferences.push_review_received}
                  onChange={(v) => updatePreference("push_review_received", v)}
                />
                <ToggleItem
                  label="締切リマインダー"
                  description="課題の締切が近づいたとき"
                  checked={preferences.push_deadline_reminder}
                  onChange={(v) =>
                    updatePreference("push_deadline_reminder", v)
                  }
                />
                <ToggleItem
                  label="教授フィードバック"
                  description="教授からフィードバックが届いたとき"
                  checked={preferences.push_feedback_received}
                  onChange={(v) =>
                    updatePreference("push_feedback_received", v)
                  }
                />
                <ToggleItem
                  label="メタ評価"
                  description="自分のレビューが評価されたとき"
                  checked={preferences.push_meta_review}
                  onChange={(v) => updatePreference("push_meta_review", v)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// トグルスイッチコンポーネント
function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <p className="text-xs text-slate-500">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
