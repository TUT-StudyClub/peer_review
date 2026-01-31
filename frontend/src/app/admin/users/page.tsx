"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiAdminListUsers, apiAdminUpdateUser, formatApiError } from "@/lib/api";
import type { AdminUserPublic } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UserFormState = {
  email: string;
  name: string;
  role: "student" | "teacher";
  credits: string;
  overrides: {
    logic: string;
    specificity: string;
    structure: string;
    evidence: string;
    overall: string;
  };
};

const emptyFormState = (user: AdminUserPublic): UserFormState => ({
  email: user.email,
  name: user.name,
  role: user.role,
  credits: String(user.credits ?? 0),
  overrides: {
    logic: user.reviewer_skill_override.logic?.toString() ?? "",
    specificity: user.reviewer_skill_override.specificity?.toString() ?? "",
    structure: user.reviewer_skill_override.structure?.toString() ?? "",
    evidence: user.reviewer_skill_override.evidence?.toString() ?? "",
    overall: user.reviewer_skill_override.overall?.toString() ?? "",
  },
});

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null as number | null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false, value: null as number | null };
  return { ok: true, value: parsed };
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
};

export default function AdminUsersPage() {
  const { user, token, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserPublic[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserPublic | null>(null);
  const [formState, setFormState] = useState<UserFormState | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canView = !!user?.is_admin;

  const hasOverrides = useMemo(() => {
    if (!editingUser) return false;
    return Object.values(editingUser.reviewer_skill_override).some((value) => value !== null);
  }, [editingUser]);

  const loadUsers = useCallback(
    async (search = query) => {
      if (!token) return;
      setListLoading(true);
      setListError(null);
      try {
        const list = await apiAdminListUsers(token, { query: search });
        setUsers(list);
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
    void loadUsers();
  }, [token, canView, loadUsers]);

  const openEditor = (target: AdminUserPublic) => {
    setEditingUser(target);
    setFormState(emptyFormState(target));
    setSaveError(null);
    setEditOpen(true);
  };

  const closeEditor = () => {
    setEditOpen(false);
    setEditingUser(null);
    setFormState(null);
    setSaveError(null);
  };

  const updateForm = (key: keyof UserFormState, value: string) => {
    if (!formState) return;
    setFormState({ ...formState, [key]: value });
  };

  const updateOverride = (key: keyof UserFormState["overrides"], value: string) => {
    if (!formState) return;
    setFormState({
      ...formState,
      overrides: { ...formState.overrides, [key]: value },
    });
  };

  const clearOverrides = () => {
    if (!formState) return;
    setFormState({
      ...formState,
      overrides: {
        logic: "",
        specificity: "",
        structure: "",
        evidence: "",
        overall: "",
      },
    });
  };

  const handleSave = async () => {
    if (!token || !editingUser || !formState) return;
    setSaveError(null);

    const creditsValue = Number(formState.credits);
    if (!Number.isFinite(creditsValue)) {
      setSaveError("credits は数値で入力してください。");
      return;
    }

    const logic = parseOptionalNumber(formState.overrides.logic);
    const specificity = parseOptionalNumber(formState.overrides.specificity);
    const structure = parseOptionalNumber(formState.overrides.structure);
    const evidence = parseOptionalNumber(formState.overrides.evidence);
    const overall = parseOptionalNumber(formState.overrides.overall);

    if (![logic, specificity, structure, evidence, overall].every((item) => item.ok)) {
      setSaveError("レビュワースキルは 0〜5 の数値で入力してください。");
      return;
    }

    setSaveLoading(true);
    try {
      const updated = await apiAdminUpdateUser(token, editingUser.id, {
        email: formState.email,
        name: formState.name,
        role: formState.role,
        credits: creditsValue,
        reviewer_skill_override_logic: logic.value,
        reviewer_skill_override_specificity: specificity.value,
        reviewer_skill_override_structure: structure.value,
        reviewer_skill_override_evidence: evidence.value,
        reviewer_skill_override_overall: overall.value,
      });
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
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
          <h1 className="text-2xl font-semibold text-foreground">管理者 / ユーザー管理</h1>
          <p className="text-sm text-muted-foreground">
            ユーザー情報とレビュワースキル上書きを編集できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/users">ユーザー</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/assignments">課題</Link>
          </Button>
          <Button variant="outline" onClick={() => loadUsers()} disabled={listLoading}>
            {listLoading ? "更新中..." : "再読み込み"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>ユーザー一覧</CardTitle>
              <CardDescription>メール/名前で検索できます。</CardDescription>
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <Input
                placeholder="メール or 名前で検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button variant="secondary" onClick={() => loadUsers(query)} disabled={listLoading}>
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
              <div className="grid grid-cols-[1.2fr_1.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.4fr] gap-3 text-xs font-semibold text-muted-foreground">
                <div>名前</div>
                <div>メール</div>
                <div>role</div>
                <div>credits</div>
                <div>ランク</div>
                <div>上書き</div>
                <div></div>
              </div>
              {users.map((item) => {
                const hasOverrideRow = Object.values(item.reviewer_skill_override).some((value) => value !== null);
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1.2fr_1.6fr_0.6fr_0.6fr_0.6fr_0.6fr_0.4fr] items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div className="truncate font-medium text-foreground" title={item.name}>
                      {item.name}
                    </div>
                    <div className="truncate text-muted-foreground" title={item.email}>
                      {item.email}
                    </div>
                    <div className="text-muted-foreground">{item.role}</div>
                    <div className="text-muted-foreground">{item.credits}</div>
                    <div className="text-muted-foreground">{item.title}</div>
                    <div className="text-muted-foreground">{hasOverrideRow ? "あり" : "-"}</div>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEditor(item)}>
                        編集
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!listLoading && users.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  ユーザーが見つかりませんでした。
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(next) => (next ? null : closeEditor())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ユーザー編集</DialogTitle>
            <DialogDescription>メール、credits、レビュワースキル上書きを更新します。</DialogDescription>
          </DialogHeader>
          {editingUser && formState ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="メールアドレス">
                  <Input value={formState.email} onChange={(event) => updateForm("email", event.target.value)} />
                </Field>
                <Field label="氏名">
                  <Input value={formState.name} onChange={(event) => updateForm("name", event.target.value)} />
                </Field>
                <Field label="role">
                  <Select value={formState.role} onValueChange={(value) => updateForm("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">student</SelectItem>
                      <SelectItem value="teacher">teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="credits">
                  <Input
                    type="number"
                    min={0}
                    value={formState.credits}
                    onChange={(event) => updateForm("credits", event.target.value)}
                  />
                </Field>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">レビュワースキル上書き</p>
                    <p className="text-xs text-muted-foreground">空欄なら上書きなし。0〜5の範囲で指定。</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearOverrides}>
                    上書きをクリア
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="論理性">
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={formState.overrides.logic}
                      onChange={(event) => updateOverride("logic", event.target.value)}
                    />
                  </Field>
                  <Field label="具体性">
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={formState.overrides.specificity}
                      onChange={(event) => updateOverride("specificity", event.target.value)}
                    />
                  </Field>
                  <Field label="構成">
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={formState.overrides.structure}
                      onChange={(event) => updateOverride("structure", event.target.value)}
                    />
                  </Field>
                  <Field label="根拠">
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={formState.overrides.evidence}
                      onChange={(event) => updateOverride("evidence", event.target.value)}
                    />
                  </Field>
                  <Field label="総合">
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={formState.overrides.overall}
                      onChange={(event) => updateOverride("overall", event.target.value)}
                    />
                  </Field>
                </div>
                {hasOverrides ? (
                  <p className="text-xs text-muted-foreground">
                    現在の上書きは保存済みです。空欄にして保存すると解除されます。
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
                <div>ユーザーID: {editingUser.id}</div>
                <div>作成日: {formatDateTime(editingUser.created_at)}</div>
                <div>管理者: {editingUser.is_admin ? "はい" : "いいえ"}</div>
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
