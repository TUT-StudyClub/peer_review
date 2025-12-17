"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { useAuth } from "@/app/providers";
import { Card } from "@/components/ui/Card";
import { Field, PrimaryButton, TextInput } from "@/components/ui/Form";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("t@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.push("/assignments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card title="ログイン">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <PrimaryButton type="submit" disabled={loading}>
            ログイン
          </PrimaryButton>
        </form>
      </Card>

      <div className="text-sm text-zinc-600">
        まだアカウントが無い場合は <Link className="underline" href="/auth/register">新規登録</Link>
      </div>
    </div>
  );
}
