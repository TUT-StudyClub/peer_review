"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiAdminListAssignments, apiAdminUpdateAssignment, formatApiError } from "@/lib/api";
import type { AssignmentPublic } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AssignmentFormState = {
  title: string;
  description: string;
  targetReviews: string;
  dueAt: string;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
};

const toLocalInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const toIsoStringOrNull = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default function AdminAssignmentsPage() {
  const { user, token, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentPublic | null>(null);
  const [formState, setFormState] = useState<AssignmentFormState | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canView = !!user?.is_admin;

  const loadAssignments = useCallback(
    async (search = query) => {
      if (!token) return;
      setListLoading(true);
      setListError(null);
      try {
        const list = await apiAdminListAssignments(token, { query: search });
        setAssignments(list);
      } catch (err) {
        setListError(formatApiError(err));
      } finally {
        setListLoading(false);
      }
    },
    [token, query]
  );

  useEffect(() => {
    if (!token || !canView) return;
    void loadAssignments();
  }, [token, canView, loadAssignments]);

  const openEditor = (target: AssignmentPublic) => {
    setEditingAssignment(target);
    setFormState({
      title: target.title,
      description: target.description ?? "",
      targetReviews: String(target.target_reviews_per_submission ?? 2),
      dueAt: toLocalInputValue(target.due_at ?? null),
    });
    setSaveError(null);
    setEditOpen(true);
  };

  const closeEditor = () => {
    setEditOpen(false);
    setEditingAssignment(null);
    setFormState(null);
    setSaveError(null);
  };

  const updateForm = (key: keyof AssignmentFormState, value: string) => {
    if (!formState) return;
    setFormState({ ...formState, [key]: value });
  };

  const handleSave = async () => {
    if (!token || !editingAssignment || !formState) return;
    setSaveError(null);

    const targetReviewsValue = Number(formState.targetReviews);
    if (!Number.isFinite(targetReviewsValue) || targetReviewsValue < 1 || targetReviewsValue > 3) {
      setSaveError("レビュー数は 1〜3 の範囲で入力してください。");
      return;
    }

    const dueAtIso = toIsoStringOrNull(formState.dueAt);
    if (formState.dueAt && !dueAtIso) {
      setSaveError("提出期限の形式が正しくありません。");
      return;
    }

    setSaveLoading(true);
    try {
      const updated = await apiAdminUpdateAssignment(token, editingAssignment.id, {
        title: formState.title,
        description: formState.description.trim() ? formState.description : null,
        target_reviews_per_submission: targetReviewsValue,
        due_at: dueAtIso,
      });
      setAssignments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      closeEditor();
    } catch (err) {
      setSaveError(formatApiError(err));
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">読み込み中...</div>;
  }

  if (!user) {
    return <div className="text-sm text-muted-foreground">ログインが必要です。</div>;
  }

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTitle>権限がありません</AlertTitle>
        <AlertDescription>管理者のみがアクセスできます。</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">管理者 / 課題管理</h1>
          <p className="text-sm text-muted-foreground">提出期限や課題情報を更新できます。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/users">ユーザー</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/assignments">課題</Link>
          </Button>
          <Button variant="outline" onClick={() => loadAssignments()} disabled={listLoading}>
            {listLoading ? "更新中..." : "再読み込み"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>課題一覧</CardTitle>
              <CardDescription>タイトルで検索できます。</CardDescription>
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <Input
                placeholder="課題タイトルで検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button variant="secondary" onClick={() => loadAssignments(query)} disabled={listLoading}>
                検索
              </Button>
            </div>
          </div>
          {listError ? (
            <Alert variant="destructive">
              <AlertTitle>取得に失敗しました</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[860px] space-y-2">
              <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.4fr] gap-3 text-xs font-semibold text-muted-foreground">
                <div>タイトル</div>
                <div>提出期限</div>
                <div>レビュー数</div>
                <div>作成日</div>
                <div></div>
              </div>
              {assignments.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.4fr] items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <div className="truncate font-medium text-foreground" title={item.title}>
                    {item.title}
                  </div>
                  <div className="text-muted-foreground">{item.due_at ? formatDateTime(item.due_at) : "なし"}</div>
                  <div className="text-muted-foreground">{item.target_reviews_per_submission}</div>
                  <div className="text-muted-foreground">{formatDateTime(item.created_at)}</div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => openEditor(item)}>
                      編集
                    </Button>
                  </div>
                </div>
              ))}
              {!listLoading && assignments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  課題が見つかりませんでした。
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(next) => (next ? null : closeEditor())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>課題編集</DialogTitle>
            <DialogDescription>提出期限と課題情報を更新します。</DialogDescription>
          </DialogHeader>
          {editingAssignment && formState ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="タイトル">
                  <Input value={formState.title} onChange={(event) => updateForm("title", event.target.value)} />
                </Field>
                <Field label="レビュー数 (1〜3)">
                  <Input
                    type="number"
                    min={1}
                    max={3}
                    value={formState.targetReviews}
                    onChange={(event) => updateForm("targetReviews", event.target.value)}
                  />
                </Field>
              </div>
              <Field label="説明">
                <Textarea value={formState.description} onChange={(event) => updateForm("description", event.target.value)} />
              </Field>
              <Field label="提出期限">
                <Input
                  type="datetime-local"
                  value={formState.dueAt}
                  onChange={(event) => updateForm("dueAt", event.target.value)}
                />
              </Field>
              <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
                <div>課題ID: {editingAssignment.id}</div>
                <div>コースID: {editingAssignment.course_id ?? "-"}</div>
                <div>作成日: {formatDateTime(editingAssignment.created_at)}</div>
              </div>
              {saveError ? (
                <Alert variant="destructive">
                  <AlertTitle>更新に失敗しました</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={saveLoading}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saveLoading}>
              {saveLoading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
