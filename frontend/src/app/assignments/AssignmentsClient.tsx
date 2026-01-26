"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Calendar, ClipboardList, Users } from "lucide-react";

import { useAuth } from "@/app/providers";
import {
  apiCreateAssignment,
  apiCreateCourse,
  apiEnrollCourse,
  apiListAssignments,
  apiListCourseStudents,
  apiListCourses,
  formatApiError,
} from "@/lib/api";
import type { AssignmentPublic, CoursePublic, UserPublic } from "@/lib/types";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AssignmentsClientProps = {
  initialCourseId: string | null;
  initialCourseView: "list" | "create";
};

type CourseThemeOption = {
  value: string;
  label: string;
  cardTone: string;
  iconTone: string;
  dotTone: string;
};

const COURSE_THEME_OPTIONS: CourseThemeOption[] = [
  {
    value: "sky",
    label: "スカイ",
    cardTone: "border-sky-200/70 bg-sky-50/60",
    iconTone: "text-sky-600",
    dotTone: "bg-sky-500",
  },
  {
    value: "emerald",
    label: "エメラルド",
    cardTone: "border-emerald-200/70 bg-emerald-50/60",
    iconTone: "text-emerald-600",
    dotTone: "bg-emerald-500",
  },
  {
    value: "amber",
    label: "アンバー",
    cardTone: "border-amber-200/70 bg-amber-50/60",
    iconTone: "text-amber-600",
    dotTone: "bg-amber-500",
  },
  {
    value: "rose",
    label: "ローズ",
    cardTone: "border-rose-200/70 bg-rose-50/60",
    iconTone: "text-rose-600",
    dotTone: "bg-rose-500",
  },
  {
    value: "slate",
    label: "スレート",
    cardTone: "border-slate-200/70 bg-slate-50/60",
    iconTone: "text-slate-600",
    dotTone: "bg-slate-500",
  },
  {
    value: "violet",
    label: "バイオレット",
    cardTone: "border-violet-200/70 bg-violet-50/60",
    iconTone: "text-violet-600",
    dotTone: "bg-violet-500",
  },
];

const COURSE_THEME_BY_VALUE = COURSE_THEME_OPTIONS.reduce<Record<string, CourseThemeOption>>(
  (acc, option) => {
    acc[option.value] = option;
    return acc;
  },
  {}
);

export default function AssignmentsClient({ initialCourseId, initialCourseView }: AssignmentsClientProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(initialCourseId);

  const courseTitleOptions = [
    "プログラミング基礎",
    "データ構造とアルゴリズム",
    "離散数学",
    "計算機アーキテクチャ",
    "オペレーティングシステム",
    "データベースシステム",
    "コンピュータネットワーク",
    "ソフトウェア工学",
    "情報セキュリティ基礎",
    "機械学習入門",
  ];

  const [courses, setCourses] = useState<CoursePublic[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const coursesRequestId = useRef(0);
  const [courseView, setCourseView] = useState<"list" | "create">(initialCourseView);
  const [courseAssignments, setCourseAssignments] = useState<AssignmentPublic[]>([]);
  const [courseAssignmentsLoading, setCourseAssignmentsLoading] = useState(false);
  const [courseAssignmentsError, setCourseAssignmentsError] = useState<string | null>(null);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseTheme, setCourseTheme] = useState(COURSE_THEME_OPTIONS[0]?.value ?? "sky");
  const [courseCreating, setCourseCreating] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [targetReviews, setTargetReviews] = useState(2);
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  const [courseStudents, setCourseStudents] = useState<UserPublic[]>([]);
  const [courseStudentsLoading, setCourseStudentsLoading] = useState(false);
  const [courseStudentsError, setCourseStudentsError] = useState<string | null>(null);

  const activeCourse = useMemo(
    () => courses.find((course) => course.id === activeCourseId) ?? null,
    [courses, activeCourseId]
  );
  const showCourseSelection = !activeCourseId;
  const courseErrorMessage = coursesError ?? courseAssignmentsError;
  const isCourseRefreshing = coursesLoading || courseAssignmentsLoading;

  const filteredCourses = courses;

  const assignmentStats = useMemo(() => {
    const counts = new Map<string, number>();
    const latestByCourse = new Map<string, Date>();
    for (const assignment of courseAssignments) {
      if (!assignment.course_id) continue;
      counts.set(assignment.course_id, (counts.get(assignment.course_id) ?? 0) + 1);
      const createdAt = new Date(assignment.created_at);
      if (Number.isNaN(createdAt.getTime())) continue;
      const prev = latestByCourse.get(assignment.course_id);
      if (!prev || createdAt > prev) {
        latestByCourse.set(assignment.course_id, createdAt);
      }
    }
    return { counts, latestByCourse };
  }, [courseAssignments]);

  const formatShortDate = (value: Date) =>
    value
      .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/\//g, "-");


  const loadCourses = useCallback(async () => {
    const requestId = ++coursesRequestId.current;
    if (!token) {
      if (requestId !== coursesRequestId.current) return;
      setCourses([]);
      setCoursesLoading(false);
      setCoursesError(null);
      return;
    }
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const list = await apiListCourses(token);
      if (requestId !== coursesRequestId.current) return;
      setCourses(list);
    } catch (err) {
      if (requestId !== coursesRequestId.current) return;
      setCoursesError(formatApiError(err));
    } finally {
      if (requestId === coursesRequestId.current) {
        setCoursesLoading(false);
      }
    }
  }, [token]);

  const loadCourseAssignments = useCallback(async () => {
    setCourseAssignmentsLoading(true);
    setCourseAssignmentsError(null);
    try {
      const list = await apiListAssignments();
      setCourseAssignments(list);
    } catch (err) {
      setCourseAssignmentsError(formatApiError(err));
    } finally {
      setCourseAssignmentsLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(async (courseId: string) => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const list = await apiListAssignments(courseId);
      setAssignments(list);
    } catch (err) {
      setAssignmentsError(formatApiError(err));
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  const loadCourseStudents = useCallback(
    async (courseId: string) => {
      if (!token) return;
      setCourseStudentsLoading(true);
      setCourseStudentsError(null);
      try {
        const list = await apiListCourseStudents(token, courseId);
        setCourseStudents(list);
      } catch (err) {
        setCourseStudentsError(formatApiError(err));
      } finally {
        setCourseStudentsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!showCourseSelection) return;
    setCourseView(initialCourseView);
  }, [initialCourseView, showCourseSelection]);

  useEffect(() => {
    if (!token || !showCourseSelection) return;
    void loadCourseAssignments();
  }, [loadCourseAssignments, showCourseSelection, token]);

  useEffect(() => {
    setActiveCourseId(initialCourseId);
  }, [initialCourseId]);

  useEffect(() => {
    if (token) return;
    if (activeCourseId) {
      router.replace("/assignments");
    }
    setActiveCourseId(null);
    setAssignments([]);
    setCourseStudents([]);
  }, [token, activeCourseId, router]);

  useEffect(() => {
    if (!activeCourseId) {
      setAssignments([]);
      return;
    }
    void loadAssignments(activeCourseId);
  }, [activeCourseId, loadAssignments]);

  useEffect(() => {
    if (user?.role !== "teacher" || !activeCourseId) {
      setCourseStudents([]);
      return;
    }
    void loadCourseStudents(activeCourseId);
  }, [activeCourseId, loadCourseStudents, user?.role]);

  const createCourse = async () => {
    if (!token) {
      setCoursesError("授業作成にはログインが必要です");
      return;
    }
    setCourseCreating(true);
    setCoursesError(null);
    try {
      const course = await apiCreateCourse(token, {
        title: courseTitle,
        description: courseDescription || null,
        theme: courseTheme || null,
      });
      setCourseTitle("");
      setCourseDescription("");
      setCourseTheme(COURSE_THEME_OPTIONS[0]?.value ?? "sky");
      await loadCourses();
      setActiveCourseId(course.id);
      router.push(`/assignments?course_id=${course.id}`);
    } catch (err) {
      setCoursesError(formatApiError(err));
    } finally {
      setCourseCreating(false);
    }
  };

  const enrollCourse = async (courseId: string) => {
    if (!token) {
      setCoursesError("受講登録にはログインが必要です");
      return;
    }
    setEnrollingCourseId(courseId);
    setCoursesError(null);
    try {
      await apiEnrollCourse(token, courseId);
      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, is_enrolled: true } : course
        )
      );
      setActiveCourseId(courseId);
      router.push(`/assignments?course_id=${courseId}`);
    } catch (err) {
      setCoursesError(formatApiError(err));
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const createAssignment = async () => {
    if (!token) {
      setAssignmentsError("課題作成にはログインが必要です");
      return;
    }
    if (!activeCourseId) {
      setAssignmentsError("授業を選択してください");
      return;
    }
    setCreatingAssignment(true);
    setAssignmentsError(null);
    try {
      await apiCreateAssignment(token, {
        course_id: activeCourseId,
        title: assignmentTitle,
        description: assignmentDescription || null,
        target_reviews_per_submission: targetReviews,
        due_at: assignmentDueAt ? new Date(assignmentDueAt).toISOString() : null,
      });
      setAssignmentTitle("");
      setAssignmentDescription("");
      setTargetReviews(2);
      setAssignmentDueAt("");
      await loadAssignments(activeCourseId);
    } catch (err) {
      setAssignmentsError(formatApiError(err));
    } finally {
      setCreatingAssignment(false);
    }
  };

  return (
    <div className="space-y-6">
      {showCourseSelection ? (
        <div className="space-y-6">
          {courseErrorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>
                <ErrorMessages message={courseErrorMessage} />
              </AlertDescription>
            </Alert>
          ) : null}

          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると授業一覧が表示されます。</p>
          ) : null}
          {isCourseRefreshing ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!isCourseRefreshing && token && filteredCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ授業がありません（teacherが作成してください）
            </p>
          ) : null}

          {user?.role === "teacher" && courseView === "create" ? (
            <Card>
              <CardHeader>
                <CardTitle>授業を作成</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label={
                    <span className="inline-flex items-center gap-1">
                      授業名
                      <span className="text-red-500">*</span>
                    </span>
                  }
                >
                  <Select value={courseTitle || undefined} onValueChange={setCourseTitle}>
                    <SelectTrigger className="bg-slate-100">
                      <SelectValue placeholder="授業名を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseTitleOptions.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="説明（任意）">
                  <Textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-100"
                  />
                </Field>
                <Field label="カラーテーマ">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {COURSE_THEME_OPTIONS.map((theme) => {
                      const isActive = courseTheme === theme.value;
                      return (
                        <button
                          key={theme.value}
                          type="button"
                          onClick={() => setCourseTheme(theme.value)}
                          className={[
                            "group rounded-xl border p-3 text-left transition",
                            theme.cardTone,
                            isActive
                              ? "border-slate-900 ring-2 ring-slate-900/20"
                              : "hover:-translate-y-0.5 hover:shadow-sm",
                          ].join(" ")}
                          aria-pressed={isActive}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                            <span className={`h-2.5 w-2.5 rounded-full ${theme.dotTone}`} />
                            {theme.label}
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                            <span className={`inline-flex h-6 w-10 items-center justify-center rounded-md bg-white/80 ${theme.iconTone}`}>
                              <BookOpen className="h-4 w-4" />
                            </span>
                            プレビュー
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="w-full sm:flex-[7]"
                      onClick={createCourse}
                      disabled={courseCreating || !courseTitle.trim()}
                    >
                      作成
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:flex-[3]"
                      onClick={() => {
                        setCourseTitle("");
                        setCourseDescription("");
                        setCourseTheme(COURSE_THEME_OPTIONS[0]?.value ?? "sky");
                        setCourseView("list");
                        router.replace("/assignments");
                      }}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {filteredCourses.map((course, index) => {
                const canSelect = user?.role !== "student" || course.is_enrolled;
                const isEnrolled = user?.role === "student" && course.is_enrolled;
                const fallbackThemeKey = index % 2 === 0 ? "sky" : "violet";
                const theme =
                  COURSE_THEME_BY_VALUE[course.theme ?? fallbackThemeKey] ??
                  COURSE_THEME_BY_VALUE.sky;
                const cardTone = theme.cardTone;
                const iconTone = theme.iconTone;
                const assignmentCount = courseAssignmentsLoading
                  ? "-"
                  : assignmentStats.counts.get(course.id) ?? 0;
                const latestDate =
                  assignmentStats.latestByCourse.get(course.id) ?? new Date(course.created_at);

                return (
                  <li
                    key={course.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className={`rounded-2xl border-b border-slate-200/60 p-4 ${cardTone}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 ${iconTone}`}
                          >
                            <BookOpen className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="text-lg font-semibold text-slate-900">{course.title}</div>
                            {course.teacher_name ? (
                              <div className="text-sm text-slate-500">teacher: {course.teacher_name}</div>
                            ) : null}
                          </div>
                        </div>
                        {user?.role === "student" ? (
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-medium",
                              isEnrolled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                            ].join(" ")}
                          >
                            {isEnrolled ? "受講中" : "未受講"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-3 px-4 pb-4 pt-3">
                      <p className="min-h-[2.5rem] text-sm text-slate-600 line-clamp-2">
                        {course.description ?? ""}
                      </p>
                      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        {typeof course.student_count === "number" ? (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            受講生: {course.student_count}人
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-slate-400" />
                          課題: {assignmentCount}件
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          最終更新: {formatShortDate(latestDate)}
                        </div>
                      </div>
                      <div className="pt-2">
                        {user?.role === "student" && !course.is_enrolled ? (
                          <Button
                            className="w-full"
                            onClick={() => enrollCourse(course.id)}
                            disabled={enrollingCourseId === course.id}
                          >
                            {enrollingCourseId === course.id ? "登録中..." : "受講する"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              if (!canSelect) return;
                              setActiveCourseId(course.id);
                              router.push(`/assignments?course_id=${course.id}`);
                            }}
                            disabled={!canSelect}
                            title={!canSelect ? "受講してから選択できます" : undefined}
                          >
                            選択
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {!showCourseSelection ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>課題一覧</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveCourseId(null);
                  router.push("/assignments");
                }}
              >
                授業一覧へ戻る
              </Button>
              <Button
                variant="outline"
                onClick={() => activeCourseId && loadAssignments(activeCourseId)}
                disabled={assignmentsLoading || !activeCourseId}
              >
                更新
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignmentsError ? (
              <Alert variant="destructive">
                <AlertTitle>エラー</AlertTitle>
                <AlertDescription>
                  <ErrorMessages message={assignmentsError} />
                </AlertDescription>
              </Alert>
            ) : null}

            {!activeCourseId ? (
              <p className="text-sm text-muted-foreground">授業を選択してください。</p>
            ) : null}
            {assignmentsLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
            {!assignmentsLoading && activeCourseId && assignments.length === 0 ? (
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
                          {a.description ? (
                            <div className="mt-1 text-sm text-muted-foreground">{a.description}</div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            必要レビュー数: {a.target_reviews_per_submission}
                          </div>
                          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            作成日: {new Date(a.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {user?.role === "teacher" && !showCourseSelection ? (
        <Card>
          <CardHeader>
          <CardTitle>課題を作成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="授業">
              <Input
                value={activeCourse?.title ?? ""}
                placeholder={coursesLoading ? "読み込み中..." : "授業を選択してください"}
                disabled
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="タイトル">
                <Input value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} />
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
            <Field label="提出期限">
              <Input
                type="datetime-local"
                value={assignmentDueAt}
                onChange={(e) => setAssignmentDueAt(e.target.value)}
              />
            </Field>
            <Field label="説明（任意）">
              <Textarea
                value={assignmentDescription}
                onChange={(e) => setAssignmentDescription(e.target.value)}
                rows={3}
              />
            </Field>
            <div>
              <Button
                onClick={createAssignment}
                disabled={creatingAssignment || !assignmentTitle.trim() || !activeCourseId}
              >
                作成
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {user?.role === "teacher" && !showCourseSelection ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>受講生一覧</CardTitle>
            <Button
              variant="outline"
              onClick={() => activeCourseId && loadCourseStudents(activeCourseId)}
              disabled={courseStudentsLoading || !activeCourseId}
            >
              更新
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {courseStudentsError ? (
              <Alert variant="destructive">
                <AlertTitle>エラー</AlertTitle>
                <AlertDescription>
                  <ErrorMessages message={courseStudentsError} />
                </AlertDescription>
              </Alert>
            ) : null}
            {!activeCourseId ? (
              <p className="text-sm text-muted-foreground">授業を選択してください。</p>
            ) : null}
            {courseStudentsLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
            {!courseStudentsLoading && activeCourseId && courseStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">まだ受講生がいません。</p>
            ) : null}
            <ul className="space-y-2">
              {courseStudents.map((student) => (
                <li key={student.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium">{student.name}</div>
                  <div className="text-xs text-muted-foreground">{student.email}</div>
                </li>
              ))}
            </ul>
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
              課題の提出・レビュー・作成はログインが必要です。
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