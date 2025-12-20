"use client";

import Link from "next/link";
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

export default function MyPage() {
  const { user, token, loading, refreshMe } = useAuth();

  const [skill, setSkill] = useState<ReviewerSkill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CoursePublic[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const enrolledCourses = useMemo(() => courses.filter((course) => course.is_enrolled), [courses]);
  const selectedCourse = useMemo(
    () => enrolledCourses.find((course) => course.id === selectedCourseId) ?? null,
    [enrolledCourses, selectedCourseId]
  );

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

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const tasks = [refreshMe(), loadSkill(), loadCourses()];
      if (selectedCourseId) tasks.push(loadAssignments(selectedCourseId));
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshMe, loadSkill, loadCourses, loadAssignments, selectedCourseId]);

  useEffect(() => {
    if (!token || user?.role !== "student") return;
    void loadSkill();
    void loadCourses();
  }, [loadSkill, loadCourses, token, user?.role]);

  useEffect(() => {
    if (!enrolledCourses.length) {
      setSelectedCourseId(null);
      setAssignments([]);
      return;
    }
    if (selectedCourseId && enrolledCourses.some((course) => course.id === selectedCourseId)) {
      return;
    }
    setSelectedCourseId(enrolledCourses[0].id);
  }, [enrolledCourses, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setAssignments([]);
      return;
    }
    void loadAssignments(selectedCourseId);
  }, [loadAssignments, selectedCourseId]);

  const formatSkill = (value: number) => (value > 0 ? value.toFixed(2) : "-");

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
          <p className="text-sm text-muted-foreground">学習状況とレビュアースキルの確認</p>
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
          <CardTitle>レビュアースキル（総合 / teacher比較）</CardTitle>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                {REVIEWER_SKILL_AXES.map((axis) => (
                  <div key={axis.key}>
                    {axis.label}: {formatSkill(skill[axis.key])}
                  </div>
                ))}
                <div>総合: {formatSkill(skill.overall)}</div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <RadarSkillChart skill={skill} />
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
            <p className="text-sm text-muted-foreground">受講中の授業がありません。</p>
          ) : null}
          <ul className="space-y-2">
            {enrolledCourses.map((course) => {
              const isSelected = course.id === selectedCourseId;
              return (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCourseId(course.id)}
                    className={[
                      "w-full rounded-lg border border-border p-4 text-left transition",
                      isSelected ? "border-slate-900 bg-slate-50" : "hover:bg-accent",
                    ].join(" ")}
                  >
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
                    <div className="mt-2 text-xs text-muted-foreground">
                      {isSelected ? "選択中" : "クリックで課題一覧を表示"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>課題一覧{selectedCourse ? ` / ${selectedCourse.title}` : ""}</CardTitle>
          <Button
            variant="outline"
            onClick={() => selectedCourseId && loadAssignments(selectedCourseId)}
            disabled={assignmentsLoading || !selectedCourseId}
          >
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
          {!selectedCourseId ? (
            <p className="text-sm text-muted-foreground">授業を選択してください。</p>
          ) : null}
          {assignmentsLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!assignmentsLoading && selectedCourseId && assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">この授業にはまだ課題がありません。</p>
          ) : null}
          <ul className="space-y-2">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                <Link href={`/assignments/${assignment.id}`} className="block">
                  <div className="rounded-lg border border-border p-4 transition hover:bg-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{assignment.title}</div>
                        {assignment.description ? (
                          <div className="mt-1 text-sm text-muted-foreground">{assignment.description}</div>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>reviews/submission: {assignment.target_reviews_per_submission}</div>
                        <div>{new Date(assignment.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
