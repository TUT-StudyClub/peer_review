"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGetReviewerSkill, apiListCourses, formatApiError } from "@/lib/api";
import type { CoursePublic, ReviewerSkill } from "@/lib/types";
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
      const tasks = [refreshMe(), loadSkill(), loadCourses()];
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshMe, loadSkill, loadCourses]);

  useEffect(() => {
    if (!token || user?.role !== "student") return;
    void loadSkill();
    void loadCourses();
  }, [loadSkill, loadCourses, token, user?.role]);

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

    </div>
  );
}
