"use client";

import Link from "next/link";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  GraduationCap,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import {
  apiAcceptTARequest,
  apiDeclineTARequest,
  apiListAssignments,
  apiListCourses,
  apiListMyTARequests,
  formatApiError,
} from "@/lib/api";
import type { AssignmentPublic, CoursePublic, TAReviewRequestPublic, TAReviewRequestStatus } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABEL: Record<TAReviewRequestStatus, string> = {
  offered: "依頼中",
  accepted: "受諾済み",
  declined: "完了",
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getDeadlineLabel(dueAt?: string | null) {
  if (!dueAt) return { label: "未設定", urgent: false };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { label: "-", urgent: false };
  const diffMs = due.getTime() - Date.now();
  if (diffMs <= 0) return { label: "締切済み", urgent: false };
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 2) return { label: `あと${diffDays}日`, urgent: diffDays <= 3 };
  if (diffDays === 1) return { label: "あと1日", urgent: true };
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  return { label: diffHours > 0 ? `あと${diffHours}時間` : "締切間近", urgent: true };
}

function StatusPill({ status }: { status: TAReviewRequestStatus }) {
  const color =
    status === "offered"
      ? "bg-amber-100 text-amber-900"
      : status === "accepted"
        ? "bg-blue-100 text-blue-900"
        : "bg-emerald-100 text-emerald-900";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{STATUS_LABEL[status]}</span>;
}

export default function TARequestsPage() {
  const { token, user, refreshMe } = useAuth();
  const [requests, setRequests] = useState<TAReviewRequestPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TAReviewRequestStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [courses, setCourses] = useState<CoursePublic[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiListMyTARequests(token);
      setRequests(list);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMeta = useCallback(async () => {
    if (!token) return;
    setMetaLoading(true);
    setError(null);
    try {
      const [assignmentList, courseList] = await Promise.all([
        apiListAssignments(),
        apiListCourses(token),
      ]);
      setAssignments(assignmentList);
      setCourses(courseList);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setMetaLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

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

  const assignmentById = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const requestCards = useMemo(() => {
    return requests.map((request) => {
      const assignment = assignmentById.get(request.assignment_id);
      const course = assignment?.course_id ? courseById.get(assignment.course_id) : undefined;
      const title = assignment?.title ?? `課題 ${shortId(request.assignment_id)}`;
      const courseTitle = course?.title;
      const teacherName = course?.teacher_name ?? `教員 ${shortId(request.teacher_id)}`;
      const deadline = getDeadlineLabel(assignment?.due_at ?? null);
      return {
        request,
        assignment,
        course,
        title,
        courseTitle,
        teacherName,
        deadline,
        reviewTarget: assignment?.target_reviews_per_submission ?? null,
      };
    });
  }, [requests, assignmentById, courseById]);
  const filteredCards = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return requestCards.filter((card) => {
      if (filter !== "all" && card.request.status !== filter) return false;
      if (!keyword) return true;
      const haystack = [
        card.title,
        card.courseTitle ?? "",
        card.teacherName,
        card.request.id,
        card.request.submission_id,
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystack.some((value) => value.includes(keyword));
    });
  }, [filter, requestCards, searchTerm]);
  const offered = filteredCards.filter((card) => card.request.status === "offered");
  const accepted = filteredCards.filter((card) => card.request.status === "accepted");
  const declined = filteredCards.filter((card) => card.request.status === "declined");
  const summary = useMemo(() => {
    return {
      total: requests.length,
      offered: requests.filter((r) => r.status === "offered").length,
      accepted: requests.filter((r) => r.status === "accepted").length,
      declined: requests.filter((r) => r.status === "declined").length,
    };
  }, [requests]);

  if (!token) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h1 className="text-base font-semibold">TA依頼</h1>
          <p className="mt-2 text-sm text-muted-foreground">ログインするとTA依頼を確認できます。</p>
        </div>
      </div>
    );
  }

  if (user && !user.is_ta) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h1 className="text-base font-semibold">TA依頼</h1>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p>TA資格のある学生のみ、この画面で依頼を受け取れます。</p>
            <p>レビューを重ねてクレジットが閾値に達すると TA になります。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">TA依頼一覧</h1>
          <p className="text-sm text-muted-foreground">
            受諾すると対応する課題ページで「次のレビュー」を取得できます。辞退した依頼は、先生が再オファーするまで表示されません。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void load();
            void loadMeta();
          }}
          disabled={loading || metaLoading}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          {loading || metaLoading ? "更新中..." : "更新"}
        </Button>
      </div>

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">総依頼数</div>
            <div className="text-lg font-semibold">{summary.total}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">依頼中</div>
            <div className="text-lg font-semibold">{summary.offered}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">受諾済み</div>
            <div className="text-lg font-semibold">{summary.accepted}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">完了</div>
            <div className="text-lg font-semibold">{summary.declined}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="学生名、課題名、教員名で検索..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as TAReviewRequestStatus | "all")}>
            <SelectTrigger className="w-32 bg-white">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="offered">依頼中</SelectItem>
              <SelectItem value="accepted">受諾済み</SelectItem>
              <SelectItem value="declined">完了</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            フィルター
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}

      {(filter === "all" || filter === "offered") && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">依頼中 ({offered.length})</div>
          {offered.length === 0 ? (
            <p className="text-sm text-muted-foreground">依頼中はありません。</p>
          ) : (
            offered.map((card) => {
              const borderClass = card.deadline.urgent ? "border-amber-300" : "border-amber-200";
              return (
                <div key={card.request.id} className={`rounded-xl border ${borderClass} bg-white p-4 shadow-sm`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {card.deadline.urgent ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          緊急
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill status={card.request.status} />
                      {card.deadline.urgent ? (
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">
                          優先度: 高
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <div>
                      {card.title}
                      {card.courseTitle ? (
                        <span className="text-muted-foreground">（{card.courseTitle}）</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    依頼元: {card.teacherName} ・ 依頼ID: {shortId(card.request.id)}
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">提出ID: {shortId(card.request.submission_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        課題ページで「次のレビュー」を取得してください。
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">依頼日時</div>
                        <div className="text-sm font-medium text-foreground">
                          {formatDateTime(card.request.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">締切</div>
                        <div className="text-sm font-medium text-amber-700">{card.deadline.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">レビュー数</div>
                        <div className="text-sm font-medium text-foreground">
                          {card.reviewTarget == null ? "-" : `${card.reviewTarget}件`}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/assignments/${card.request.assignment_id}`} target="_blank" rel="noreferrer">
                        課題ページを開く
                      </Link>
                    </Button>
                    <Button size="sm" onClick={() => accept(card.request.id)} disabled={busyId === card.request.id || loading}>
                      {busyId === card.request.id ? "処理中..." : "受諾する"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decline(card.request.id)}
                      disabled={busyId === card.request.id || loading}
                    >
                      辞退する
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {(filter === "all" || filter === "accepted") && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">受諾済み ({accepted.length})</div>
          {accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground">受諾済みの依頼はありません。</p>
          ) : (
            accepted.map((card) => (
              <div key={card.request.id} className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <div>
                      {card.title}
                      {card.courseTitle ? (
                        <span className="text-muted-foreground">（{card.courseTitle}）</span>
                      ) : null}
                    </div>
                  </div>
                  <StatusPill status={card.request.status} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  依頼元: {card.teacherName} ・ 依頼ID: {shortId(card.request.id)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/assignments/${card.request.assignment_id}`}>続きを見る</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {(filter === "all" || filter === "declined") && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">完了 ({declined.length})</div>
          {declined.length === 0 ? (
            <p className="text-sm text-muted-foreground">完了した依頼はありません。</p>
          ) : (
            declined.map((card) => (
              <div key={card.request.id} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <div>
                      {card.title}
                      {card.courseTitle ? (
                        <span className="text-muted-foreground">（{card.courseTitle}）</span>
                      ) : null}
                    </div>
                  </div>
                  <StatusPill status={card.request.status} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  依頼元: {card.teacherName} ・ 依頼ID: {shortId(card.request.id)}
                </div>
                <div className="mt-4 text-xs text-muted-foreground">完了した依頼です。</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
