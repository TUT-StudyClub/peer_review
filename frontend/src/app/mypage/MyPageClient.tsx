"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGetReviewerSkill, apiListAssignments, apiListCourses, formatApiError } from "@/lib/api";
import type { AssignmentPublic, CoursePublic, ReviewerSkill } from "@/lib/types";
import { REVIEWER_SKILL_AXES } from "@/lib/reviewerSkill";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MyPageClientProps = {
  initialCourseId: string | null;
};

export default function MyPageClient({ initialCourseId }: MyPageClientProps) {
  const { user, token, loading, refreshMe } = useAuth();
  const router = useRouter();

  const [skill, setSkill] = useState<ReviewerSkill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CoursePublic[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId);
  const [refreshing, setRefreshing] = useState(false);

  const enrolledCourses = useMemo(() => courses.filter((course) => course.is_enrolled), [courses]);
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);

  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const loadSkill = useCallback(async () => {
    if (!token) return;
    setSkillLoading(true);
    setSkillError(null);
    try {
      const data = await apiGetReviewerSkill(token);
      setSkill(data);
    } catch (err) {
      setSkillError(formatApiError(err));
    } finally {
      setSkillLoading(false);
    }
  }, [token]);

  const loadCourses = useCallback(async () => {
    if (!token) return;
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const list = await apiListCourses(token);
      setCourses(list);
    } catch (err) {
      setCoursesError(formatApiError(err));
    } finally {
      setCoursesLoading(false);
    }
  }, [token]);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const list = await apiListAssignments();
      setAssignments(list);
    } catch (err) {
      setAssignmentsError(formatApiError(err));
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  const selectCourse = useCallback(
    (courseId: string) => {
      setSelectedCourseId(courseId);
      router.push(`/assignments?course_id=${courseId}`);
    },
    [router]
  );

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const tasks = [refreshMe(), loadSkill(), loadCourses(), loadAssignments()];
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshMe, loadSkill, loadCourses, loadAssignments]);

  useEffect(() => {
    if (!token || user?.role !== "student") return;
    void loadSkill();
    void loadCourses();
    void loadAssignments();
  }, [loadSkill, loadCourses, loadAssignments, token, user?.role]);

  useEffect(() => {
    setSelectedCourseId(initialCourseId);
  }, [initialCourseId]);

  useEffect(() => {
    if (!enrolledCourses.length) {
      setSelectedCourseId(null);
      return;
    }
    if (selectedCourseId && enrolledCourses.some((course) => course.id === selectedCourseId)) {
      return;
    }
    setSelectedCourseId(enrolledCourses[0].id);
  }, [enrolledCourses, selectedCourseId]);

  const timelineItems = useMemo(() => {
    if (!enrolledCourses.length) return [];
    const enrolledIds = new Set(enrolledCourses.map((course) => course.id));
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    const items = assignments.flatMap((assignment) => {
      if (!assignment.course_id || !enrolledIds.has(assignment.course_id) || !assignment.due_at) {
        return [];
      }
      const dueAt = new Date(assignment.due_at);
      const createdAt = new Date(assignment.created_at);
      if (Number.isNaN(dueAt.getTime())) return [];
      if (Number.isNaN(createdAt.getTime())) return [];

      const diffMs = dueAt.getTime() - now;
      const daysLeft = Math.ceil(diffMs / dayMs);
      let statusLabel = "";
      let tone: "overdue" | "soon" | "normal" = "normal";

      if (diffMs < 0) {
        statusLabel = "期限切れ";
        tone = "overdue";
      } else if (diffMs <= dayMs * 3) {
        statusLabel = diffMs <= dayMs ? "24時間以内" : `あと${daysLeft}日`;
        tone = "soon";
      } else {
        statusLabel = `あと${daysLeft}日`;
      }

      const startMs = Math.min(createdAt.getTime(), dueAt.getTime());
      const endMs = Math.max(createdAt.getTime(), dueAt.getTime());

      return [
        {
          id: assignment.id,
          title: assignment.title,
          courseTitle: courseById.get(assignment.course_id)?.title ?? "授業未設定",
          createdAt,
          dueAt,
          startAt: new Date(startMs),
          endAt: new Date(endMs),
          statusLabel,
          tone,
        },
      ];
    });

    return items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }, [assignments, courseById, enrolledCourses]);

  const timelineRange = useMemo(() => {
    if (!timelineItems.length) return null;
    const startMs = Math.min(...timelineItems.map((item) => item.startAt.getTime()));
    const endMs = Math.max(...timelineItems.map((item) => item.endAt.getTime()), Date.now());
    const rangeMs = Math.max(endMs - startMs, 1000 * 60 * 60 * 24);
    return { startMs, endMs, rangeMs };
  }, [timelineItems]);

  const timelineTicks = useMemo(() => {
    if (!timelineRange) return [];
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const ratio = index / steps;
      const tickDate = new Date(timelineRange.startMs + timelineRange.rangeMs * ratio);
      return {
        label: tickDate.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" }),
        percent: ratio * 100,
      };
    });
  }, [timelineRange]);

  const todayPercent = useMemo(() => {
    if (!timelineRange) return null;
    const percent = ((Date.now() - timelineRange.startMs) / timelineRange.rangeMs) * 100;
    return Math.min(100, Math.max(0, percent));
  }, [timelineRange]);

  const formatSkill = (value: number) => (value > 0 ? value.toFixed(1) : "-");

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学生マイページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">ログインするとマイページを利用できます。</p>
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
    );
  }

  if (user.role !== "student") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学生マイページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">このページは学生専用です。</p>
          <Button asChild variant="outline">
            <Link href="/assignments">課題一覧へ</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">学生マイページ</h1>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()} disabled={!token || refreshing}>
          {refreshing ? "更新中..." : "まとめて更新"}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>プロフィール</CardTitle>
          <div className="text-xs text-muted-foreground">joined: {new Date(user.created_at).toLocaleString()}</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">名前</div>
              <div className="text-sm font-medium">{user.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">メール</div>
              <div className="text-sm">{user.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ランク / タイトル</div>
              <div className="text-sm">
                {user.rank} / {user.title}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">credits / TA</div>
              <div className="text-sm">
                {user.credits} / {user.is_ta ? "TA" : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>レビュアースキル</CardTitle>
          <Button variant="outline" onClick={loadSkill} disabled={!token || skillLoading}>
            {skillLoading ? "読み込み中..." : "更新"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {skillError ? (
            <Alert variant="destructive">
              <AlertTitle>取得に失敗しました</AlertTitle>
              <AlertDescription>{skillError}</AlertDescription>
            </Alert>
          ) : null}
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
          ) : skillLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : skill ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
                <RadarSkillChart skill={skill} />
              </div>
              <div className="flex flex-col justify-center space-y-6">
                <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5">
                  <div className="text-sm font-medium text-slate-500">総合スコア</div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-blue-600">
                      {formatSkill(skill.overall)}
                    </span>
                    <span className="text-sm text-slate-400">/ 5.0</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {REVIEWER_SKILL_AXES.map((axis) => {
                    const value = skill[axis.key];
                    const percent = Math.min(100, Math.max(0, (value / 5) * 100));
                    return (
                      <div key={axis.key} className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                          <span>{axis.label}</span>
                          <span className="text-blue-600">{formatSkill(value)}</span>
                        </div>
                        <div
                          className="h-2 rounded-full bg-slate-100"
                          role="progressbar"
                          aria-label={`${axis.label} スコア`}
                          aria-valuenow={value}
                          aria-valuemin={0}
                          aria-valuemax={5}
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して取得してください</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>受講中の授業</CardTitle>
          <Button variant="outline" onClick={loadCourses} disabled={!token || coursesLoading}>
            {coursesLoading ? "読み込み中..." : "更新"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {coursesError ? (
            <Alert variant="destructive">
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>
                <ErrorMessages message={coursesError} />
              </AlertDescription>
            </Alert>
          ) : null}
          {coursesLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!coursesLoading && enrolledCourses.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">受講中の授業がありません。</p>
              <Button asChild variant="outline">
                <Link href="/assignments">授業一覧へ</Link>
              </Button>
            </div>
          ) : null}
          <ul className="space-y-2">
            {enrolledCourses.map((course) => {
              return (
                <li key={course.id}>
                  <div className="rounded-lg border border-border p-4 transition hover:bg-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{course.title}</div>
                        {course.description ? (
                          <div className="mt-1 text-sm text-muted-foreground">{course.description}</div>
                        ) : null}
                        {course.teacher_name ? (
                          <div className="mt-2 text-xs text-muted-foreground">teacher: {course.teacher_name}</div>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {course.student_count ? <div>受講生: {course.student_count}人</div> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        onClick={() => selectCourse(course.id)}
                      >
                        課題一覧へ
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>提出期限タイムライン</CardTitle>
          <Button variant="outline" onClick={() => void loadAssignments()} disabled={assignmentsLoading}>
            {assignmentsLoading ? "読み込み中..." : "更新"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignmentsError ? (
            <Alert variant="destructive">
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>
                <ErrorMessages message={assignmentsError} />
              </AlertDescription>
            </Alert>
          ) : null}
          {assignmentsLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!assignmentsLoading && timelineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">提出期限が設定された課題がありません。</p>
          ) : null}
          {timelineItems.length ? (
            <div className="space-y-4">
              {timelineRange ? (
                <div className="hidden sm:block">
                  <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] items-center gap-3 text-xs text-muted-foreground">
                    <div />
                    <div className="relative h-6">
                      {timelineTicks.map((tick) => (
                        <span
                          key={tick.percent}
                          className="absolute -translate-x-1/2 text-[11px]"
                          style={{ left: `${tick.percent}%` }}
                        >
                          {tick.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-3">
                    <div />
                    <div className="relative h-2 rounded-full bg-slate-100">
                      {timelineTicks.map((tick) => (
                        <span
                          key={`tick-${tick.percent}`}
                          className="absolute -top-1 h-4 w-px bg-slate-200"
                          style={{ left: `${tick.percent}%` }}
                          aria-hidden
                        />
                      ))}
                      {todayPercent !== null ? (
                        <span
                          className="absolute -top-1 h-4 w-px bg-sky-400/50"
                          style={{ left: `${todayPercent}%` }}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <ol className="space-y-3">
                {timelineItems.map((item) => {
                  const badgeClassName =
                    item.tone === "overdue"
                      ? "bg-rose-100 text-rose-700"
                      : item.tone === "soon"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-700";
                  const barClassName =
                    item.tone === "overdue"
                      ? "bg-rose-500"
                      : item.tone === "soon"
                      ? "bg-amber-500"
                      : "bg-emerald-500";
                  const range = timelineRange;
                  const startPercent = range
                    ? Math.min(
                        100,
                        Math.max(0, ((item.startAt.getTime() - range.startMs) / range.rangeMs) * 100)
                      )
                    : 0;
                  const endPercent = range
                    ? Math.min(
                        100,
                        Math.max(0, ((item.endAt.getTime() - range.startMs) / range.rangeMs) * 100)
                      )
                    : 0;
                  const minWidth = 2;
                  const rawWidth = endPercent - startPercent;
                  const widthPercent = Math.min(Math.max(rawWidth, minWidth), 100 - startPercent);
                  const markerLeft = Math.min(startPercent + widthPercent, 100);

                  return (
                    <li key={item.id} className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
                      <div className="space-y-1">
                        <Link
                          href={`/assignments/${item.id}`}
                          className="text-sm font-medium text-slate-900 hover:underline"
                        >
                          {item.title}
                        </Link>
                        <div className="text-xs text-slate-500">{item.courseTitle}</div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span>作成: {item.createdAt.toLocaleDateString()}</span>
                          <span>提出期限: {item.dueAt.toLocaleString()}</span>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${badgeClassName}`}>
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="relative h-10 rounded-full bg-slate-100">
                        {todayPercent !== null ? (
                          <span
                            className="absolute inset-y-0 w-px bg-sky-400/40"
                            style={{ left: `${todayPercent}%` }}
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${barClassName}`}
                          style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                          aria-hidden
                        />
                        <span
                          className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${barClassName}`}
                          style={{ left: `${markerLeft}%` }}
                          aria-hidden
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </CardContent>
      </Card>

    </div>
  );
}
