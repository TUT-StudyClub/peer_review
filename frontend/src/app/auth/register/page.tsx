"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { useAuth } from "@/app/providers";
import { Card } from "@/components/legacy-ui/Card";
import { Field, PrimaryButton, Select, TextInput } from "@/components/legacy-ui/Form";
import type { UserRole } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading } = useAuth();
  const [role, setRole] = useState<UserRole>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register({ role, name, email, password });
      router.push("/assignments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card title="新規登録">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Role" hint="teacher は .env の ALLOW_TEACHER_REGISTRATION=true が必要です（開発用）">
            <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
            </Select>
          </Field>
          <Field label="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" hint="8文字以上">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <PrimaryButton type="submit" disabled={loading}>
            登録してログイン
          </PrimaryButton>
        </form>
      </Card>

      <div className="text-sm text-black">
        すでにアカウントがある場合は <Link className="underline" href="/auth/login">ログイン</Link>
      </div>
    </div>
  );
}
