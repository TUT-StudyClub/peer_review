"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import {
  ApiError,
  apiAddRubric,
  apiDownloadSubmissionFile,
  apiGetMyGrade,
  apiGetMySubmission,
  apiGetReviewerSkill,
  apiListAssignments,
  apiListRubric,
  apiNextReviewTask,
  apiReceivedReviews,
  apiSubmitReport,
  apiSubmitReview,
  apiTeacherGradeSubmission,
  apiTeacherListSubmissions,
  apiCreateMetaReview,
} from "@/lib/api";
import type {
  AssignmentPublic,
  GradeMe,
  ReviewAssignmentTask,
  ReviewReceived,
  ReviewerSkill,
  RubricCriterionPublic,
  SubmissionPublic,
  SubmissionTeacherPublic,
} from "@/lib/types";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function shortId(id: string) {
  return id.slice(0, 8);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    const detail = err.detail ? `\n${JSON.stringify(err.detail, null, 2)}` : "";
    return `${err.message}${detail}`;
  }
  return err instanceof Error ? err.message : "エラーが発生しました";
}

function SectionCard({
  title,
  actions,
  children,
  contentClassName,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent className={["space-y-4", contentClassName ?? ""].join(" ").trim()}>
        {children}
      </CardContent>
    </Card>
  );
}

export default function AssignmentDetailPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const { user, token, refreshMe } = useAuth();

  const [assignment, setAssignment] = useState<AssignmentPublic | null>(null);
  const [rubric, setRubric] = useState<RubricCriterionPublic[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [errorBase, setErrorBase] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [mySubmission, setMySubmission] = useState<SubmissionPublic | null>(null);
  const [mySubmissionStatus, setMySubmissionStatus] = useState<"idle" | "loading" | "missing" | "ready">(
    "idle"
  );
  const [uploading, setUploading] = useState(false);

  const [reviewTask, setReviewTask] = useState<ReviewAssignmentTask | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewScores, setReviewScores] = useState<Record<string, number>>({});
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [received, setReceived] = useState<ReviewReceived[]>([]);
  const [receivedLoading, setReceivedLoading] = useState(false);

  const [grade, setGrade] = useState<GradeMe | null>(null);
  const [gradeLoading, setGradeLoading] = useState(false);

  const [skill, setSkill] = useState<ReviewerSkill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);

  const [teacherSubmissions, setTeacherSubmissions] = useState<SubmissionTeacherPublic[]>([]);
  const [teacherSubmissionsLoading, setTeacherSubmissionsLoading] = useState(false);
  const [gradeTargetId, setGradeTargetId] = useState<string | null>(null);
  const [teacherTotalScore, setTeacherTotalScore] = useState<number>(80);
  const [teacherFeedback, setTeacherFeedback] = useState<string>("");
  const [teacherRubricScores, setTeacherRubricScores] = useState<Record<string, number>>({});

  const [rubricName, setRubricName] = useState("");
  const [rubricDesc, setRubricDesc] = useState("");
  const [rubricMax, setRubricMax] = useState(5);
  const [rubricOrder, setRubricOrder] = useState(0);
  const [rubricAdding, setRubricAdding] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const totalRubricMax = useMemo(() => rubric.reduce((sum, c) => sum + c.max_score, 0), [rubric]);

  const loadBase = useCallback(async () => {
    setLoadingBase(true);
    setErrorBase(null);
    try {
      const [assignments, rubricList] = await Promise.all([
        apiListAssignments(),
        apiListRubric(assignmentId),
      ]);
      const found = assignments.find((a) => a.id === assignmentId) ?? null;
      setAssignment(found);
      setRubric(rubricList);
    } catch (err) {
      setErrorBase(formatApiError(err));
    } finally {
      setLoadingBase(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!rubric.length) return;
    setReviewScores((prev) => {
      if (Object.keys(prev).length) return prev;
      const init: Record<string, number> = {};
      for (const c of rubric) init[c.id] = 0;
      return init;
    });
    setTeacherRubricScores((prev) => {
      if (Object.keys(prev).length) return prev;
      const init: Record<string, number> = {};
      for (const c of rubric) init[c.id] = 0;
      return init;
    });
  }, [rubric]);

  const loadMySubmission = async () => {
    if (!token) return;
    setMySubmissionStatus("loading");
    try {
      const s = await apiGetMySubmission(token, assignmentId);
      setMySubmission(s);
      setMySubmissionStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setMySubmission(null);
        setMySubmissionStatus("missing");
        return;
      }
      setNotice(formatApiError(err));
      setMySubmissionStatus("idle");
    }
  };

  const upload = async () => {
    if (!token) {
      setNotice("提出にはログインが必要です");
      return;
    }
    if (!file) {
      setNotice("ファイルを選択してください");
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const s = await apiSubmitReport(token, assignmentId, file);
      setMySubmission(s);
      setMySubmissionStatus("ready");
      setFile(null);
      setNotice("提出しました");
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const downloadSubmission = async (submissionId: string, fileTypeHint?: "pdf" | "markdown") => {
    if (!token) {
      setNotice("ダウンロードにはログインが必要です");
      return;
    }
    setNotice(null);
    try {
      const blob = await apiDownloadSubmissionFile(token, submissionId);
      const ext = fileTypeHint === "pdf" ? "pdf" : fileTypeHint === "markdown" ? "md" : "bin";
      downloadBlob(blob, `submission-${shortId(submissionId)}.${ext}`);
    } catch (err) {
      setNotice(formatApiError(err));
    }
  };

  const getNextTask = async () => {
    if (!token) {
      setNotice("レビューにはログインが必要です");
      return;
    }
    setNotice(null);
    try {
      const task = await apiNextReviewTask(token, assignmentId);
      setReviewTask(task);
      setReviewComment("");
      const init: Record<string, number> = {};
      for (const c of task.rubric) init[c.id] = 0;
      setReviewScores(init);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setReviewTask(null);
        setNotice("今はレビュー対象がありません（全てレビュー済み等）");
        return;
      }
      setNotice(formatApiError(err));
    }
  };

  const submitReview = async () => {
    if (!token || !reviewTask) return;
    setReviewSubmitting(true);
    setNotice(null);
    try {
      const payload = {
        comment: reviewComment,
        rubric_scores: reviewTask.rubric.map((c) => ({
          criterion_id: c.id,
          score: Number(reviewScores[c.id] ?? 0),
        })),
      };
      await apiSubmitReview(token, reviewTask.review_assignment_id, payload);
      setReviewTask(null);
      setReviewComment("");
      setNotice("レビューを提出しました（credits +1）");
      await refreshMe();
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const loadReceived = async () => {
    if (!token) return;
    setReceivedLoading(true);
    setNotice(null);
    try {
      const list = await apiReceivedReviews(token, assignmentId);
      setReceived(list);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setReceivedLoading(false);
    }
  };

  const metaReview = async (reviewId: string, helpfulness: number, comment: string) => {
    if (!token) return;
    setNotice(null);
    try {
      await apiCreateMetaReview(token, reviewId, { helpfulness, comment: comment || null });
      await loadReceived();
      setNotice("メタ評価を送信しました");
    } catch (err) {
      setNotice(formatApiError(err));
    }
  };

  const loadGrade = async () => {
    if (!token) return;
    setGradeLoading(true);
    setNotice(null);
    try {
      const g = await apiGetMyGrade(token, assignmentId);
      setGrade(g);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setGradeLoading(false);
    }
  };

  const loadSkill = async () => {
    if (!token) return;
    setSkillLoading(true);
    setNotice(null);
    try {
      const s = await apiGetReviewerSkill(token);
      setSkill(s);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setSkillLoading(false);
    }
  };

  const loadTeacherSubmissions = async () => {
    if (!token) return;
    setTeacherSubmissionsLoading(true);
    setNotice(null);
    try {
      const list = await apiTeacherListSubmissions(token, assignmentId);
      setTeacherSubmissions(list);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTeacherSubmissionsLoading(false);
    }
  };

  const openTeacherGrade = (submissionId: string) => {
    setGradeTargetId(submissionId);
    setTeacherFeedback("");
    setTeacherTotalScore(80);
    const init: Record<string, number> = {};
    for (const c of rubric) init[c.id] = 0;
    setTeacherRubricScores(init);
  };

  const submitTeacherGrade = async () => {
    if (!token || !gradeTargetId) return;
    setNotice(null);
    try {
      await apiTeacherGradeSubmission(token, gradeTargetId, {
        teacher_total_score: teacherTotalScore,
        teacher_feedback: teacherFeedback || null,
        rubric_scores: rubric.map((c) => ({ criterion_id: c.id, score: Number(teacherRubricScores[c.id] ?? 0) })),
      });
      setNotice("teacher採点を保存しました");
      setGradeTargetId(null);
      await loadTeacherSubmissions();
    } catch (err) {
      setNotice(formatApiError(err));
    }
  };

  const addRubric = async () => {
    if (!token) {
      setNotice("ルーブリック追加にはログインが必要です");
      return;
    }
    setRubricAdding(true);
    setNotice(null);
    try {
      await apiAddRubric(token, assignmentId, {
        name: rubricName,
        description: rubricDesc || null,
        max_score: rubricMax,
        order_index: rubricOrder,
      });
      setRubricName("");
      setRubricDesc("");
      setRubricMax(5);
      setRubricOrder(rubricOrder + 1);
      await loadBase();
      setNotice("ルーブリックを追加しました");
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setRubricAdding(false);
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    if (user.role === "teacher") {
      void loadTeacherSubmissions();
      return;
    }
    void loadMySubmission();
    void loadReceived();
    void loadGrade();
    void loadSkill();
    // NOTE: 初期表示時にだけロードしたいので、意図的に dependency を最小限にしています。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, assignmentId]);

  if (loadingBase) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }
  if (errorBase) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{errorBase}</AlertDescription>
        </Alert>
        <Button variant="link" asChild className="px-0">
          <Link href="/assignments">課題一覧へ戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title={assignment ? assignment.title : `課題 ${assignmentId}`} contentClassName="space-y-2">
        {assignment?.description ? <p className="text-sm text-muted-foreground">{assignment.description}</p> : null}
        <div className="text-xs text-muted-foreground">
          reviews/submission: {assignment?.target_reviews_per_submission ?? "-"} / created:{" "}
          {assignment?.created_at ? new Date(assignment.created_at).toLocaleString() : "-"}
        </div>
      </SectionCard>

      {notice ? (
        <Alert>
          <AlertTitle>通知</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{notice}</AlertDescription>
        </Alert>
      ) : null}

      <SectionCard title="ルーブリック（評価基準）">
        {rubric.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだルーブリックがありません（teacherが追加してください）</p>
        ) : (
          <ul className="space-y-2">
            {rubric.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {c.order_index}. {c.name}
                    </div>
                    {c.description ? (
                      <div className="mt-1 text-sm text-muted-foreground">{c.description}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">max: {c.max_score}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {user?.role === "teacher" ? (
          <div className="rounded-lg border bg-muted p-4">
            <div className="text-sm font-semibold">（teacher）ルーブリックを追加</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="項目名">
                <Input value={rubricName} onChange={(e) => setRubricName(e.target.value)} />
              </Field>
              <Field label="max score">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={rubricMax}
                  onChange={(e) => setRubricMax(Number(e.target.value))}
                />
              </Field>
              <Field label="表示順（order_index）">
                <Input
                  type="number"
                  min={0}
                  value={rubricOrder}
                  onChange={(e) => setRubricOrder(Number(e.target.value))}
                />
              </Field>
              <Field label="説明（任意）">
                <Input value={rubricDesc} onChange={(e) => setRubricDesc(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <Button onClick={addRubric} disabled={rubricAdding || !rubricName.trim()}>
                追加
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      {user?.role === "teacher" ? (
        <SectionCard
          title="（teacher）提出一覧 & 採点"
          actions={
            <Button variant="outline" onClick={loadTeacherSubmissions} disabled={teacherSubmissionsLoading}>
              更新
            </Button>
          }
        >
          {teacherSubmissionsLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {teacherSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">提出がまだありません</p>
          ) : (
            <div className="space-y-2">
              {teacherSubmissions.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">submission: {shortId(s.id)}</div>
                      <div className="text-xs text-muted-foreground">
                        author: {shortId(s.author_id)} / {s.file_type} / {new Date(s.created_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        teacher_total_score: {s.teacher_total_score ?? "-"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => downloadSubmission(s.id, s.file_type)}>
                        DL
                      </Button>
                      <Button onClick={() => openTeacherGrade(s.id)}>採点</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog
            open={Boolean(gradeTargetId)}
            onOpenChange={(open) => {
              if (!open) setGradeTargetId(null);
            }}
          >
            {gradeTargetId ? (
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>採点: {shortId(gradeTargetId)}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="teacher_total_score（0-100推奨）">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={teacherTotalScore}
                      onChange={(e) => setTeacherTotalScore(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="自動計算（ルーブリック合計を0-100へ換算）">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const total = rubric.reduce((sum, c) => sum + Number(teacherRubricScores[c.id] ?? 0), 0);
                        const score = totalRubricMax > 0 ? Math.round((total / totalRubricMax) * 100) : 0;
                        setTeacherTotalScore(score);
                      }}
                    >
                      ルーブリックから計算
                    </Button>
                  </Field>
                </div>

                <Field label="teacher_feedback（任意）">
                  <Textarea value={teacherFeedback} onChange={(e) => setTeacherFeedback(e.target.value)} rows={3} />
                </Field>

                <div className="space-y-3">
                  {rubric.map((c) => (
                    <Field key={c.id} label={`${c.name}（max ${c.max_score}）`}>
                      <Input
                        type="number"
                        min={0}
                        max={c.max_score}
                        value={teacherRubricScores[c.id] ?? 0}
                        onChange={(e) =>
                          setTeacherRubricScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))
                        }
                      />
                    </Field>
                  ))}
                </div>

                <DialogFooter>
                  <Button onClick={submitTeacherGrade}>保存</Button>
                  <Button variant="outline" onClick={() => setGradeTargetId(null)}>
                    キャンセル
                  </Button>
                </DialogFooter>
              </DialogContent>
            ) : null}
          </Dialog>
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="（student）提出（My Submission）"
          actions={
            <Button variant="outline" onClick={loadMySubmission}>
              更新
            </Button>
          }
        >
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると提出できます</p>
          ) : mySubmissionStatus === "loading" ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : mySubmissionStatus === "missing" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                まだ提出していません。Markdown（.md）推奨（AIの「本文＋レビュー」判定が効きやすいです）。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".md,.pdf,text/markdown,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button onClick={upload} disabled={uploading || !file}>
                  提出
                </Button>
              </div>
            </div>
          ) : mySubmission ? (
            <div className="space-y-2 text-sm">
              <div>
                submission_id: <span className="font-mono">{mySubmission.id}</span>
              </div>
              <div>file_type: {mySubmission.file_type}</div>
              <div>created_at: {new Date(mySubmission.created_at).toLocaleString()}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => downloadSubmission(mySubmission.id, mySubmission.file_type)}>
                  ファイルDL
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して状態を取得してください</p>
          )}
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="（student）レビュー（Next Task → Submit）"
          actions={
            <Button variant="outline" onClick={getNextTask} disabled={!token}>
              次のレビューを取得
            </Button>
          }
        >
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインするとレビューできます</p>
          ) : !reviewTask ? (
            <p className="text-sm text-muted-foreground">
              「次のレビューを取得」を押してください（未提出タスクがある場合は同じタスクが出続けます）
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted p-3 text-sm">
                <div>author_alias: {reviewTask.author_alias}</div>
                <div>submission_id: {shortId(reviewTask.submission_id)}</div>
                <div>file_type: {reviewTask.file_type}</div>
                <div className="mt-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadSubmission(reviewTask.submission_id, reviewTask.file_type)}
                  >
                    提出物をDL
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {reviewTask.rubric.map((c) => (
                  <div key={c.id} className="grid gap-2 sm:grid-cols-2">
                    <div className="text-sm">
                      {c.name}（max {c.max_score}）
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={c.max_score}
                      value={reviewScores[c.id] ?? 0}
                      onChange={(e) => setReviewScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>

              <Field label="レビューコメント（具体的に）" hint="短すぎるとAI/簡易判定で低評価になります">
                <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={5} />
              </Field>

              <div className="flex gap-2">
                <Button onClick={submitReview} disabled={reviewSubmitting || !reviewComment.trim()}>
                  レビュー提出
                </Button>
                <Button variant="outline" onClick={() => setReviewTask(null)}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="（student）受け取ったレビュー（Received Reviews）"
          actions={
            <Button variant="outline" onClick={loadReceived} disabled={!token || receivedLoading}>
              更新
            </Button>
          }
        >
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
          ) : receivedLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : received.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだレビューが届いていません</p>
          ) : (
            <div className="space-y-3">
              {received.map((r) => (
                <div key={r.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{r.reviewer_alias}</div>
                      <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      AI品質: {r.ai_quality_score ?? "-"}
                    </div>
                  </div>
                  {r.ai_quality_reason ? (
                    <div className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      {r.ai_quality_reason}
                    </div>
                  ) : null}
                  <div className="mt-2 whitespace-pre-wrap text-sm">{r.comment}</div>

                  {r.rubric_scores?.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {r.rubric_scores.map((s) => (
                        <div key={s.criterion_id} className="text-xs text-muted-foreground">
                          {shortId(s.criterion_id)}: {s.score}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {r.meta_review ? (
                    <div className="mt-3 rounded-md border bg-muted p-3 text-sm">
                      <div>メタ評価: {r.meta_review.helpfulness}/5</div>
                      {r.meta_review.comment ? <div className="mt-1">{r.meta_review.comment}</div> : null}
                    </div>
                  ) : (
                    <MetaReviewForm reviewId={r.id} onSubmit={metaReview} />
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="（student）成績（Grade）"
          actions={
            <Button variant="outline" onClick={loadGrade} disabled={!token || gradeLoading}>
              更新
            </Button>
          }
        >
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
          ) : gradeLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : grade ? (
            <div className="space-y-2 text-sm">
              <div>assignment_score: {grade.assignment_score ?? "-"}</div>
              <div>review_contribution: {grade.review_contribution.toFixed(2)}</div>
              <div className="font-semibold">final_score: {grade.final_score ?? "-"}</div>
              <details className="rounded-md border bg-muted p-3 text-xs">
                <summary className="cursor-pointer">breakdown</summary>
                <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(grade.breakdown, null, 2)}</pre>
              </details>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して取得してください</p>
          )}
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="（student）レビュアースキル（Radar）"
          actions={
            <Button variant="outline" onClick={loadSkill} disabled={!token || skillLoading}>
              更新
            </Button>
          }
        >
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
          ) : skillLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : skill ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Logic: {skill.logic.toFixed(2)}</div>
                <div>Specificity: {skill.specificity.toFixed(2)}</div>
                <div>Empathy: {skill.empathy.toFixed(2)}</div>
                <div>Insight: {skill.insight.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <RadarSkillChart skill={skill} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して取得してください</p>
          )}
        </SectionCard>
      ) : null}

      {user ? null : (
        <SectionCard title="ログインが必要な操作">
          <p className="text-sm text-muted-foreground">
            提出・レビュー・メタ評価・採点などはログイン後に利用できます。
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild>
              <Link href="/auth/login">ログイン</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/auth/register">新規登録</Link>
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function MetaReviewForm({
  reviewId,
  onSubmit,
}: {
  reviewId: string;
  onSubmit: (reviewId: string, helpfulness: number, comment: string) => Promise<void>;
}) {
  const [helpfulness, setHelpfulness] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(reviewId, helpfulness, comment);
      setComment("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border bg-muted p-3">
      <div className="text-sm font-medium">メタ評価（このレビューは役に立ちましたか？）</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="helpfulness (1-5)">
          <Select value={String(helpfulness)} onValueChange={(v) => setHelpfulness(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="コメント（任意）">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
      <div className="mt-2">
        <Button onClick={submit} disabled={submitting}>
          送信
        </Button>
      </div>
    </div>
  );
}
