"use client";

import { NotificationSettings } from "@/components/NotificationSettings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">設定</h1>
      </div>

      {/* 通知設定 */}
      <NotificationSettings />
    </div>
  );
}
