"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGetCoursePage, apiGetMyGrade, apiGetMySubmission, apiUnenrollCourse, formatApiError } from "@/lib/api";
import type { AssignmentPublic, CoursePublic, GradeMe, SubmissionPublic } from "@/lib/types";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CourseThemeOption = {
  value: string;
  label: string;
  cardTone: string;
};

const COURSE_THEME_OPTIONS: CourseThemeOption[] = [
  { value: "sky", label: "スカイ", cardTone: "border-sky-200/70 bg-sky-50/60" },
  { value: "emerald", label: "エメラルド", cardTone: "border-emerald-200/70 bg-emerald-50/60" },
  { value: "amber", label: "アンバー", cardTone: "border-amber-200/70 bg-amber-50/60" },
  { value: "rose", label: "ローズ", cardTone: "border-rose-200/70 bg-rose-50/60" },
  { value: "slate", label: "スレート", cardTone: "border-slate-200/70 bg-slate-50/60" },
  { value: "violet", label: "バイオレット", cardTone: "border-violet-200/70 bg-violet-50/60" },
];

const COURSE_THEME_BY_VALUE = COURSE_THEME_OPTIONS.reduce<Record<string, CourseThemeOption>>(
  (acc, option) => {
    acc[option.value] = option;
    return acc;
  },
  {}
);

export default function CoursePage() {
  const { token, loading } = useAuth();
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<CoursePublic | null>(null);
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [completedAssignments, setCompletedAssignments] = useState<
    { assignment: AssignmentPublic; submission: SubmissionPublic; grade: GradeMe | null }[]
  >([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(10); // ページネーション用：初期表示件数
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [unenrollPending, setUnenrollPending] = useState(false);
  const [unenrollError, setUnenrollError] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('course-show-scores');
    return saved !== null ? saved === 'true' : true;
  });

  // 得点表示設定をlocalStorageに保存
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course-show-scores', String(showScores));
    }
  }, [showScores]);

  const loadCoursePage = useCallback(async () => {
    if (!token || !courseId) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const data = await apiGetCoursePage(token, courseId);
      setCourse(data.course);
      setAssignments(data.assignments);
    } catch (err) {
      setPageError(formatApiError(err));
    } finally {
      setPageLoading(false);
    }
  }, [token, courseId]);

  // 表示対象の課題（ページネーション）
  const displayAssignments = useMemo(() => {
    return assignments.slice(0, displayCount);
  }, [assignments, displayCount]);

  const isEnrolled = course?.is_enrolled ?? false;

  const loadCompleted = useCallback(async () => {
    // 表示対象の課題の完了状況を読み込み
    if (!token || !course || !isEnrolled || displayAssignments.length === 0) {
      setCompletedAssignments([]);
      return;
    }
    setCompletedLoading(true);
    try {
      // ページネーション：指定件数までのみ読み込み
      const CHUNK_SIZE = 5; // チャンク単位で並列処理
      const results: ({ assignment: AssignmentPublic; submission: SubmissionPublic; grade: GradeMe | null } | null)[] = [];

      for (let i = 0; i < displayAssignments.length; i += CHUNK_SIZE) {
        const chunk = displayAssignments.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (assignment) => {
            try {
              const submission = await apiGetMySubmission(token, assignment.id);
              let grade: GradeMe | null = null;
              try {
                grade = await apiGetMyGrade(token, assignment.id);
              } catch (err) {
                console.warn(`成績の取得に失敗しました (assignment: ${assignment.id}):`, err);
                grade = null;
              }
              return { assignment, submission, grade };
            } catch (err) {
              console.warn(`提出物の取得に失敗しました (assignment: ${assignment.id}):`, err);
              return null;
            }
          })
        );
        results.push(...chunkResults);
      }

      setCompletedAssignments(results.filter((item): item is { assignment: AssignmentPublic; submission: SubmissionPublic; grade: GradeMe | null } => Boolean(item)));
    } finally {
      setCompletedLoading(false);
    }
  }, [token, course, isEnrolled, displayAssignments]);

  useEffect(() => {
    if (loading) return;
    void loadCoursePage();
  }, [loading, loadCoursePage]);

  useEffect(() => {
    if (!course) return;
    void loadCompleted();
  }, [course, loadCompleted]);

  const renderScore = (grade: GradeMe | null): string => {
    const score = grade?.final_score ?? grade?.assignment_score;
    if (score == null) return "採点待ち";
    return `${score.toFixed(1)}%`;
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>講義ページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">ログインするとページを利用できます。</p>
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

  return (
    <div className="space-y-6">
      {pageError ? (
        <Alert variant="destructive">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>
            <ErrorMessages message={pageError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {unenrollError ? (
        <Alert variant="destructive">
          <AlertTitle>受講取り消しできません</AlertTitle>
          <AlertDescription>
            <ErrorMessages message={unenrollError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {pageLoading && !course ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : !course ? (
        <Alert>
          <AlertTitle>見つかりません</AlertTitle>
          <AlertDescription>この講義は見つかりませんでした。</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* 上段：講義ヘッダー（要約） */}
          {(() => {
            let themeKey = course?.theme;
            if (!themeKey) {
              const themeKeys = ["sky", "emerald", "amber", "rose", "slate", "violet"];
              if (courseId) {
                const firstCharCode = courseId.charCodeAt(0);
                themeKey = themeKeys[firstCharCode % themeKeys.length];
              } else {
                themeKey = "sky";
              }
            }

            const theme = COURSE_THEME_BY_VALUE[themeKey] ?? COURSE_THEME_BY_VALUE.sky;
            const cardTone = theme.cardTone;

            return (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-md">
                <div className={`rounded-t-2xl border-b border-slate-200/60 p-6 ${cardTone}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-slate-900">{course.title}</h1>
                      {course.teacher_name && (
                        <p className="mt-1 text-sm text-slate-600">講師: {course.teacher_name}</p>
                      )}
                      {course.description && (
                        <p className="mt-3 text-sm text-slate-700 line-clamp-2">{course.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      {course.is_enrolled && (
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2">
                            <span className="h-2 w-2 rounded-full bg-green-600"></span>
                            <span className="text-sm font-semibold text-green-700">受講中</span>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={unenrollPending}
                            onClick={async () => {
                              if (!course) return;
                              const ok = window.confirm("受講を取り消します。提出や進捗が失われる場合があります。よろしいですか？");
                              if (!ok) return;
                              setUnenrollError(null);
                              try {
                                setUnenrollPending(true);
                                await apiUnenrollCourse(token, course.id);
                                setCourse((prev) => (prev ? { ...prev, is_enrolled: false } : prev));
                                setCompletedAssignments([]);
                                router.push("/assignments");
                              } catch (err) {
                                setUnenrollError(formatApiError(err));
                              } finally {
                                setUnenrollPending(false);
                              }
                            }}
                          >
                            {unenrollPending ? "処理中..." : "受講を取り消す"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 中段：重要メトリクス */}
          {/* メトリクスの課題数カードはヘッダー横に移設のため削除 */}

          {/* 下段：課題一覧（主役） */}
          {course.is_enrolled ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">課題一覧</h2>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {assignments.length}件
                  </span>
                </div>
              </div>
              <div className="p-6">
                {assignments.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">この授業にはまだ課題がありません。</p>
                ) : (
                  (() => {
                    const completedIds = new Set(completedAssignments.map((item) => item.assignment.id));
                    return (
                      <ul className="space-y-3">
                        {assignments.map((assignment) => {
                          const isCompleted = completedIds.has(assignment.id);
                          return (
                            <li key={assignment.id}>
                              <Link href={`/assignments/${assignment.id}`} className="block">
                                <div
                                  className={`rounded-lg border p-4 transition ${
                                    isCompleted
                                      ? "border-slate-300 bg-slate-50 hover:border-slate-300 hover:bg-slate-50"
                                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="font-semibold text-slate-900">{assignment.title}</div>
                                      {assignment.description && (
                                        <div className="mt-1 text-sm text-slate-600">{assignment.description}</div>
                                      )}
                                    </div>
                                    <div className="text-right text-xs text-slate-500">
                                      {isCompleted ? (
                                        <div className="mt-0.5 font-semibold text-indigo-600">提出済み</div>
                                      ) : assignment.due_at ? (
                                        <>
                                          <div>締切: {new Date(assignment.due_at).toLocaleDateString("ja-JP")}</div>
                                          {(() => {
                                            const now = new Date();
                                            const due = new Date(assignment.due_at);
                                            const diffMs = due.getTime() - now.getTime();
                                            const msPerDay = 1000 * 60 * 60 * 24;
                                            if (diffMs < 0) {
                                              const overdueDays = Math.ceil(Math.abs(diffMs) / msPerDay);
                                              return (
                                                <div className="mt-0.5 font-semibold text-red-600">超過: {overdueDays}日</div>
                                              );
                                            }

                                            if (
                                              due.getFullYear() === now.getFullYear() &&
                                              due.getMonth() === now.getMonth() &&
                                              due.getDate() === now.getDate()
                                            ) {
                                              return <div className="mt-0.5 font-semibold text-red-600">本日中</div>;
                                            }

                                            const remainingDays = Math.ceil(diffMs / msPerDay);
                                            return (
                                              <div className="mt-0.5 font-semibold text-green-600">締切まで: {remainingDays}日</div>
                                            );
                                          })()}
                                        </>
                                      ) : (
                                        <div>締切なし</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()
                )}
              </div>
            </div>
          ) : null}

          {course.is_enrolled ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">完了した課題</h2>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {completedAssignments.length}件
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScores(!showScores)}
                >
                  {showScores ? "得点を隠す" : "得点を表示"}
                </Button>
              </div>
              <div className="p-6">
                {completedLoading ? (
                  <p className="text-sm text-slate-500">読み込み中...</p>
                ) : completedAssignments.length === 0 ? (
                  <p className="text-sm text-slate-500">完了した課題はまだありません。</p>
                ) : (
                  <ul className="space-y-3">
                    {completedAssignments.map((item) => (
                      <li key={item.assignment.id}>
                        <Link href={`/assignments/${item.assignment.id}`} className="block">
                          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:bg-slate-50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="font-semibold text-slate-900">{item.assignment.title}</div>
                                {item.assignment.description ? (
                                  <div className="mt-1 text-sm text-slate-600 line-clamp-2">{item.assignment.description}</div>
                                ) : null}
                                <div className="mt-2 text-xs text-slate-500">
                                  提出日: {new Date(item.submission.created_at).toLocaleDateString("ja-JP")}
                                </div>
                              </div>
                              <div className="text-right">
                                {showScores ? (
                                  <div className="text-sm font-semibold text-slate-900">得点率: {renderScore(item.grade)}</div>
                                ) : (
                                  <div className="text-sm font-semibold text-slate-400">得点非表示</div>
                                )}
                                {item.assignment.due_at ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    締切: {new Date(item.assignment.due_at).toLocaleDateString("ja-JP")}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!completedLoading && displayCount < assignments.length ? (
                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayCount(prev => Math.min(prev + 10, assignments.length))}
                    >
                      もっと見る (+{Math.min(10, assignments.length - displayCount)}件)
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
