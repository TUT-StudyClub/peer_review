"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/app/providers";
import {
  apiCreateAssignment,
  apiCreateCourse,
  apiEnrollCourse,
  apiGetReviewerSkill,
  apiListAssignments,
  apiListCourseStudents,
  apiListCourses,
  formatApiError,
} from "@/lib/api";
import type { AssignmentPublic, CoursePublic, ReviewerSkill, UserPublic } from "@/lib/types";
import { REVIEWER_SKILL_AXES } from "@/lib/reviewerSkill";
import { ErrorMessages } from "@/components/ErrorMessages";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AssignmentsClientProps = {
  initialCourseId: string | null;
};

export default function AssignmentsClient({ initialCourseId }: AssignmentsClientProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const activeCourseId = initialCourseId;

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

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseCreating, setCourseCreating] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [targetReviews, setTargetReviews] = useState(2);
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  const [courseStudents, setCourseStudents] = useState<UserPublic[]>([]);
  const [courseStudentsLoading, setCourseStudentsLoading] = useState(false);
  const [courseStudentsError, setCourseStudentsError] = useState<string | null>(null);

  const [overallSkill, setOverallSkill] = useState<ReviewerSkill | null>(null);
  const [overallSkillLoading, setOverallSkillLoading] = useState(false);
  const [overallSkillError, setOverallSkillError] = useState<string | null>(null);

  const activeCourse = useMemo(
    () => courses.find((course) => course.id === activeCourseId) ?? null,
    [courses, activeCourseId]
  );
  const showCourseSelection = !activeCourseId;

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
    if (token) return;
    if (activeCourseId) {
      router.replace("/assignments");
    }
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

  const loadOverallSkill = useCallback(async () => {
    if (!token) return;
    setOverallSkillLoading(true);
    setOverallSkillError(null);
    try {
      const skill = await apiGetReviewerSkill(token);
      setOverallSkill(skill);
    } catch (err) {
      setOverallSkillError(formatApiError(err));
    } finally {
      setOverallSkillLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role !== "student") {
      setOverallSkill(null);
      return;
    }
    void loadOverallSkill();
  }, [loadOverallSkill, user?.role]);

  const formatSkill = (value: number) => (value > 0 ? value.toFixed(2) : "-");

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
      });
      setCourseTitle("");
      setCourseDescription("");
      await loadCourses();
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
      });
      setAssignmentTitle("");
      setAssignmentDescription("");
      setTargetReviews(2);
      await loadAssignments(activeCourseId);
    } catch (err) {
      setAssignmentsError(formatApiError(err));
    } finally {
      setCreatingAssignment(false);
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === "student" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <CardTitle className="text-base">レビュアースキル（総合 / teacher比較）</CardTitle>
            <div className="shrink-0">
              <Button variant="outline" onClick={loadOverallSkill} disabled={!token || overallSkillLoading}>
                更新
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!token ? (
              <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
            ) : overallSkillLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : overallSkillError ? (
              <Alert variant="destructive">
                <AlertTitle>取得に失敗しました</AlertTitle>
                <AlertDescription>{overallSkillError}</AlertDescription>
              </Alert>
            ) : overallSkill ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 text-sm text-muted-foreground">
                  {REVIEWER_SKILL_AXES.map((axis) => (
                    <div key={axis.key}>
                      {axis.label}: {formatSkill(overallSkill[axis.key])}
                    </div>
                  ))}
                  <div>総合: {formatSkill(overallSkill.overall)}</div>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <RadarSkillChart skill={overallSkill} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">「更新」を押して取得してください</p>
            )}
          </CardContent>
        </Card>
      ) : null}
      {showCourseSelection ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>授業一覧</CardTitle>
            <Button variant="outline" onClick={loadCourses} disabled={coursesLoading || !token}>
              更新
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {coursesError ? (
              <Alert variant="destructive">
                <AlertTitle>エラー</AlertTitle>
                <AlertDescription>
                  <ErrorMessages message={coursesError} />
                </AlertDescription>
              </Alert>
            ) : null}

            {!token ? (
              <p className="text-sm text-muted-foreground">ログインすると授業一覧が表示されます。</p>
            ) : null}
            {coursesLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
            {!coursesLoading && token && courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                まだ授業がありません（teacherが作成してください）
              </p>
            ) : null}

            <ul className="space-y-2">
              {courses.map((course) => {
                const isActive = course.id === activeCourseId;
                const canSelect = user?.role !== "student" || course.is_enrolled;
                return (
                  <li key={course.id}>
                    <div
                      className={[
                        "rounded-lg border border-border p-4 transition",
                        isActive ? "border-slate-900 bg-slate-50" : "hover:bg-accent",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{course.title}</div>
                          {course.description ? (
                            <div className="mt-1 text-sm text-muted-foreground">{course.description}</div>
                          ) : null}
                          <div className="mt-2 text-xs text-muted-foreground">
                            {course.teacher_name ? `teacher: ${course.teacher_name}` : null}
                            {user?.role === "teacher"
                              ? ` / 受講生: ${course.student_count ?? 0}人`
                              : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => router.push(`/assignments?course_id=${course.id}`)}
                            disabled={!canSelect}
                            title={!canSelect ? "受講してから選択できます" : undefined}
                          >
                            {isActive ? "選択中" : "選択"}
                          </Button>
                          {user?.role === "student" ? (
                            course.is_enrolled ? (
                              <span className="flex items-center justify-center rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                                受講中
                              </span>
                            ) : (
                              <Button
                                onClick={() => enrollCourse(course.id)}
                                disabled={enrollingCourseId === course.id}
                              >
                                {enrollingCourseId === course.id ? "登録中..." : "受講する"}
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {user?.role === "teacher" && showCourseSelection ? (
        <Card>
          <CardHeader>
            <CardTitle>（teacher）授業を作成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="授業名">
              <Select value={courseTitle || undefined} onValueChange={setCourseTitle}>
                <SelectTrigger>
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
              <Textarea value={courseDescription} onChange={(e) => setCourseDescription(e.target.value)} rows={3} />
            </Field>
            <div>
              <Button onClick={createCourse} disabled={courseCreating || !courseTitle.trim()}>
                作成
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!showCourseSelection ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>課題一覧{activeCourse ? ` / ${activeCourse.title}` : ""}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/assignments")}>
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
      ) : null}

      {user?.role === "teacher" && !showCourseSelection ? (
        <Card>
          <CardHeader>
            <CardTitle>（teacher）課題を作成</CardTitle>
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
            <CardTitle>受講生一覧{activeCourse ? ` / ${activeCourse.title}` : ""}</CardTitle>
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
