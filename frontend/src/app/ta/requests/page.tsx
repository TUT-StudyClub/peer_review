"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiAcceptTARequest, apiDeclineTARequest, apiListMyTARequests, formatApiError } from "@/lib/api";
import type { TAReviewRequestPublic, TAReviewRequestStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABEL: Record<TAReviewRequestStatus, string> = {
  offered: "依頼中",
  accepted: "受諾済み",
  declined: "辞退",
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function StatusPill({ status }: { status: TAReviewRequestStatus }) {
  const color = status === "offered" ? "bg-amber-100 text-amber-900" : status === "accepted" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-900";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{STATUS_LABEL[status]}</span>;
}

export default function TARequestsPage() {
  const { token, user, refreshMe } = useAuth();
  const [requests, setRequests] = useState<TAReviewRequestPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TAReviewRequestStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiListMyTARequests(token, filter === "all" ? undefined : filter);
      setRequests(list);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    setNotice(null);
    setError(null);
    try {
      await apiAcceptTARequest(token, id);
      setNotice("TA依頼を受諾しました。課題ページでレビュータスクを取得してください。");
      await load();
      await refreshMe();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    setNotice(null);
    setError(null);
    try {
      await apiDeclineTARequest(token, id);
      setNotice("TA依頼を辞退しました。");
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">TA依頼</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ログインするとTA依頼を確認できます。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && !user.is_ta) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">TA依頼</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>TA資格のある学生のみ、この画面で依頼を受け取れます。</p>
            <p>レビューを重ねてクレジットが閾値に達すると TA になります。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const offered = requests.filter((r) => r.status === "offered");
  const accepted = requests.filter((r) => r.status === "accepted");
  const declined = requests.filter((r) => r.status === "declined");

  const RequestList = ({ items, emptyText }: { items: TAReviewRequestPublic[]; emptyText: string }) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        items.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Submission {shortId(r.submission_id)}</div>
              <StatusPill status={r.status} />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>assignment: {shortId(r.assignment_id)}</div>
              <div>teacher: {shortId(r.teacher_id)}</div>
              <div>依頼日時: {new Date(r.created_at).toLocaleString()}</div>
              {r.responded_at ? <div>回答日時: {new Date(r.responded_at).toLocaleString()}</div> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/assignments/${r.assignment_id}`}
                className="text-xs text-primary underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                課題ページを開く
              </Link>
              {r.status === "offered" ? (
                <>
                  <Button size="sm" onClick={() => accept(r.id)} disabled={busyId === r.id || loading}>
                    {busyId === r.id ? "処理中..." : "受諾する"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decline(r.id)}
                    disabled={busyId === r.id || loading}
                  >
                    辞退する
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {r.status === "accepted"
                    ? "受諾済み: 課題ページでレビューを取得してください（別タブで開けます）"
                    : "辞退済み"}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <CardTitle className="text-base">TA依頼一覧</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as TAReviewRequestStatus | "all")}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="状態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="offered">依頼中のみ</SelectItem>
                <SelectItem value="accepted">受諾のみ</SelectItem>
                <SelectItem value="declined">辞退のみ</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? "更新中..." : "更新"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            受諾すると対応する課題ページで「次のレビュー」を取得できます。辞退した依頼は、先生が再オファーするまで表示されません。
          </p>

          {notice ? (
            <Alert>
              <AlertTitle>通知</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">{notice}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          ) : null}

          {(filter === "all" || filter === "offered") && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">依頼中</div>
              <RequestList items={offered} emptyText="依頼中はありません。" />
            </div>
          )}

          {(filter === "all" || filter === "accepted") && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">受諾済み（別タブで課題ページを開けます）</div>
              <RequestList items={accepted} emptyText="受諾済みの依頼はありません。" />
            </div>
          )}

          {(filter === "all" || filter === "declined") && declined.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">辞退済み</div>
              <RequestList items={declined} emptyText="辞退した依頼はありません。" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
