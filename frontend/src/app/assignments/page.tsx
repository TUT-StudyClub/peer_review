"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiCreateAssignment, apiListAssignments } from "@/lib/api";
import type { AssignmentPublic } from "@/lib/types";
import { Card } from "@/components/legacy-ui/Card";
import { Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "@/components/legacy-ui/Form";

export default function AssignmentsPage() {
  const { user, token } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetReviews, setTargetReviews] = useState(2);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiListAssignments();
      setAssignments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!token) {
      setError("課題作成にはログインが必要です");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await apiCreateAssignment(token, {
        title,
        description: description || null,
        target_reviews_per_submission: targetReviews,
      });
      setTitle("");
      setDescription("");
      setTargetReviews(2);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="課題一覧"
        actions={
          <SecondaryButton onClick={load} disabled={loading}>
            更新
          </SecondaryButton>
        }
      >
        {error ? (
          <div className="whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {loading ? <div className="text-sm text-black">読み込み中...</div> : null}
        {!loading && assignments.length === 0 ? (
          <div className="text-sm text-black">まだ課題がありません（teacherが作成してください）</div>
        ) : null}

        <ul className="mt-4 space-y-2">
          {assignments.map((a) => (
            <li key={a.id} className="rounded-lg border p-4 hover:bg-slate-50">
              <Link href={`/assignments/${a.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    {a.description ? <div className="mt-1 text-sm text-black">{a.description}</div> : null}
                  </div>
                  <div className="text-right text-xs text-black">
                    <div>reviews/submission: {a.target_reviews_per_submission}</div>
                    <div>{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {user?.role === "teacher" ? (
        <Card title="（teacher）課題を作成">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="タイトル">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="レビュー人数（1〜3）">
              <TextInput
                type="number"
                min={1}
                max={3}
                value={targetReviews}
                onChange={(e) => setTargetReviews(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="説明（任意）">
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>
          </div>
          <div className="mt-4">
            <PrimaryButton onClick={create} disabled={creating || !title.trim()}>
              作成
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {user ? null : (
        <Card title="ログインについて">
          <div className="text-sm text-black">
            課題一覧の閲覧は可能ですが、提出・レビュー・作成はログインが必要です。
          </div>
          <div className="mt-3 flex gap-2">
            <Link className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700" href="/auth/login">
              ログイン
            </Link>
            <Link className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" href="/auth/register">
              新規登録
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
