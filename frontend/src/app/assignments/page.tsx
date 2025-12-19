"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiCreateAssignment, apiListAssignments, formatApiError } from "@/lib/api";
import type { AssignmentPublic } from "@/lib/types";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
      setError(formatApiError(err));
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
      setError(formatApiError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>課題一覧</CardTitle>
          <Button variant="outline" onClick={load} disabled={loading}>
            更新
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>
                <ErrorMessages message={error} />
              </AlertDescription>
            </Alert>
          ) : null}

          {loading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!loading && assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ課題がありません（teacherが作成してください）</p>
          ) : null}

          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id}>
                <Link href={`/assignments/${a.id}`} className="block">
                  <div className="rounded-lg border border-border p-4 transition hover:bg-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{a.title}</div>
                        {a.description ? <div className="mt-1 text-sm text-muted-foreground">{a.description}</div> : null}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>reviews/submission: {a.target_reviews_per_submission}</div>
                        <div>{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {user?.role === "teacher" ? (
        <Card>
          <CardHeader>
            <CardTitle>（teacher）課題を作成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="タイトル">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="レビュー人数（1〜3）">
                <Input
                  type="number"
                  min={1}
                  max={3}
                  value={targetReviews}
                  onChange={(e) => setTargetReviews(Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="説明（任意）">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>
            <div>
              <Button onClick={create} disabled={creating || !title.trim()}>
                作成
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {user ? null : (
        <Card>
          <CardHeader>
            <CardTitle>ログインについて</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              課題一覧の閲覧は可能ですが、提出・レビュー・作成はログインが必要です。
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/auth/login">ログイン</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/register">新規登録</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
