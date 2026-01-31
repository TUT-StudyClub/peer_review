"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Calendar, Crown, Mail, Sparkles } from "lucide-react";

import { useAuth } from "@/app/providers";
import {
  apiGetMyCreditHistory,
  apiGetReviewerSkill,
  apiListAssignments,
  apiListCourses,
  apiUploadAvatar,
  formatApiError,
} from "@/lib/api";
import type { AssignmentPublic, CoursePublic, CreditHistoryPublic, ReviewerSkill } from "@/lib/types";
import { REVIEWER_SKILL_AXES } from "@/lib/reviewerSkill";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeadlineTimeline } from "@/components/DeadlineTimeline";

type MyPageClientProps = {
  initialCourseId: string | null;
};

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const CREDIT_REASON_LABELS: Record<string, string> = {
  review_submitted: "レビュー提出",
  review_recalculated: "レビュー再計算",
};

export default function MyPageClient({ initialCourseId }: MyPageClientProps) {
  const { user, token, loading, refreshMe } = useAuth();
  const router = useRouter();

  const [skill, setSkill] = useState<ReviewerSkill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [creditHistory, setCreditHistory] = useState<CreditHistoryPublic[]>([]);
  const [creditHistoryLoading, setCreditHistoryLoading] = useState(false);
  const [creditHistoryError, setCreditHistoryError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CoursePublic[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const enrolledCourses = useMemo(() => courses.filter((course) => course.is_enrolled), [courses]);

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

  const loadCreditHistory = useCallback(async () => {
    if (!token) return;
    setCreditHistoryLoading(true);
    setCreditHistoryError(null);
    try {
      const list = await apiGetMyCreditHistory(token, 50);
      setCreditHistory(list);
    } catch (err) {
      setCreditHistoryError(formatApiError(err));
    } finally {
      setCreditHistoryLoading(false);
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
      const tasks = [refreshMe(), loadSkill(), loadCourses(), loadAssignments(), loadCreditHistory()];
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshMe, loadSkill, loadCourses, loadAssignments, loadCreditHistory]);

  useEffect(() => {
    if (!token || user?.role !== "student") return;
    void loadSkill();
    void loadCourses();
    void loadAssignments();
    void loadCreditHistory();
  }, [loadSkill, loadCourses, loadAssignments, loadCreditHistory, token, user?.role]);

  useEffect(() => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarPreviewError(false);
    setAvatarError(null);
    setAvatarNotice(null);
    setAvatarVersion(Date.now());
  }, [user?.avatar_url]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [avatarFile]);


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
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const avatarInitial = user?.name?.trim().charAt(0) || "?";
  const remoteAvatarUrl = user?.avatar_url ? new URL(user.avatar_url, apiBaseUrl).toString() : "";
  const remoteAvatarSrc = remoteAvatarUrl
    ? `${remoteAvatarUrl}${remoteAvatarUrl.includes("?") ? "&" : "?"}v=${avatarVersion}`
    : "";
  const avatarSrc = avatarPreviewUrl ?? remoteAvatarSrc;
  const showAvatarImage = Boolean(avatarSrc) && !avatarPreviewError;
  const latestCreditHistory = creditHistory[0] ?? null;
  const latestCreditSummary = latestCreditHistory
    ? `${latestCreditHistory.delta >= 0 ? "+" : ""}${latestCreditHistory.delta} / ${new Date(
      latestCreditHistory.created_at
    ).toLocaleDateString()}`
    : "履歴なし";

  const uploadAvatar = useCallback(async (file: File) => {
    if (!token) return;
    setAvatarSaving(true);
    setAvatarError(null);
    setAvatarNotice(null);
    setAvatarPreviewError(false);
    try {
      await apiUploadAvatar(token, file);
      setAvatarFile(null);
      await refreshMe();
      setAvatarVersion(Date.now());
      setAvatarNotice("保存しました。");
    } catch (err) {
      setAvatarError(formatApiError(err));
    } finally {
      setAvatarSaving(false);
    }
  }, [token, refreshMe]);

  const handleAvatarChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setAvatarNotice(null);
      setAvatarPreviewError(false);
      if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        setAvatarFile(null);
        setAvatarError("PNG/JPEG/WEBP/GIF 形式の画像を選択してください。");
        return;
      }
      if (file.size > MAX_AVATAR_BYTES) {
        setAvatarFile(null);
        setAvatarError("2MB以下の画像を選択してください。");
        return;
      }

      setAvatarError(null);
      setAvatarFile(file);
      void uploadAvatar(file);
    },
    [uploadAvatar]
  );

  const triggerAvatarSelect = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

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

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-500 sm:h-24" />
        <CardContent className="pt-4">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative -mt-10 sm:-mt-12">
                  <button
                    type="button"
                    onClick={triggerAvatarSelect}
                    disabled={avatarSaving}
                    className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 text-2xl font-semibold text-slate-500 shadow-lg transition hover:-translate-y-0.5 sm:h-24 sm:w-24"
                    aria-label="アイコンを変更"
                  >
                    {showAvatarImage ? (
                      <img
                        src={avatarSrc}
                        alt={`${user.name} avatar`}
                        className="h-full w-full object-cover"
                        onError={() => {
                          setAvatarPreviewError(true);
                          setAvatarNotice(null);
                        }}
                      />
                    ) : (
                      <span aria-label="avatar-initial">{avatarInitial}</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                      編集
                    </span>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    className="sr-only"
                    accept={ALLOWED_AVATAR_TYPES.join(",")}
                    onChange={handleAvatarChange}
                    disabled={avatarSaving}
                  />
                </div>
                <div className="space-y-2 pt-6 sm:pt-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xl font-semibold text-slate-900 sm:text-2xl">{user.name}</div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {user.is_ta ? "TA" : "学生"}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {user.title}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      joined: {new Date(user.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[150px] rounded-xl border border-sky-100 bg-sky-50 p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Sparkles className="h-4 w-4 text-sky-600" />
                    Credits
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{user.credits}</div>
                  <div className="text-xs text-slate-500">{user.is_ta ? "TA資格あり" : "TA資格なし"}</div>
                </div>
                <div className="min-w-[150px] rounded-xl border border-amber-100 bg-amber-50 p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Crown className="h-4 w-4 text-amber-600" />
                    Rank
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{user.title}</div>
                  <div className="text-xs text-slate-500">{user.rank}</div>
                </div>
              </div>
            </div>
            {avatarError ? (
              <Alert variant="destructive">
                <AlertTitle>アイコン設定エラー</AlertTitle>
                <AlertDescription>{avatarError}</AlertDescription>
              </Alert>
            ) : null}
            {avatarPreviewError ? (
              <div className="text-xs text-rose-600">画像の読み込みに失敗しました。</div>
            ) : null}
            {avatarNotice ? <div className="text-xs text-emerald-600">{avatarNotice}</div> : null}
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={(open) => {
        if (open) {
          void loadCreditHistory();
        }
      }}>
        <DialogTrigger asChild>
          <button type="button" className="w-full text-left">
            <Card className="transition hover:shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>クレジット履歴</CardTitle>
                <div className="text-xs text-muted-foreground">{creditHistory.length}件</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">最新: {latestCreditSummary}</div>
              </CardContent>
            </Card>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <div className="flex items-start justify-between gap-3">
            <DialogHeader className="text-left">
              <DialogTitle>クレジット履歴</DialogTitle>
              <DialogDescription>最近の付与・調整の履歴です。</DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={loadCreditHistory} disabled={!token || creditHistoryLoading}>
              {creditHistoryLoading ? "読み込み中..." : "更新"}
            </Button>
          </div>
          {creditHistoryError ? (
            <Alert variant="destructive">
              <AlertTitle>取得に失敗しました</AlertTitle>
              <AlertDescription>{creditHistoryError}</AlertDescription>
            </Alert>
          ) : null}
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
          ) : creditHistoryLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : creditHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴がありません</p>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {creditHistory.map((item) => {
                const deltaSign = item.delta >= 0 ? "+" : "";
                const deltaClass = item.delta >= 0 ? "text-emerald-600" : "text-rose-600";
                const reasonLabel = CREDIT_REASON_LABELS[item.reason] ?? item.reason;
                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</div>
                        <div className="text-sm font-semibold text-slate-800">{reasonLabel}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${deltaClass}`}>
                          {deltaSign}
                          {item.delta}
                        </div>
                        <div className="text-xs text-slate-500">合計: {item.total_credits}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Button onClick={() => selectCourse(course.id)}>課題一覧へ</Button>
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
          <DeadlineTimeline assignments={assignments} courses={courses} />
        </CardContent>
      </Card>
    </div>
  );
}
