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
import { Card } from "@/components/ui/Card";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui/Form";

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
    return <div className="text-sm text-zinc-600">読み込み中...</div>;
  }
  if (errorBase) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorBase}</div>
        <Link href="/assignments" className="text-sm underline">
          課題一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card title={assignment ? assignment.title : `課題 ${assignmentId}`}>
        {assignment?.description ? <div className="text-sm text-zinc-700">{assignment.description}</div> : null}
        <div className="mt-3 text-xs text-zinc-500">
          reviews/submission: {assignment?.target_reviews_per_submission ?? "-"} / created:{" "}
          {assignment?.created_at ? new Date(assignment.created_at).toLocaleString() : "-"}
        </div>
      </Card>

      {notice ? <div className="rounded-md border bg-white p-3 text-sm text-zinc-700 whitespace-pre-wrap">{notice}</div> : null}

      <Card title="ルーブリック（評価基準）">
        {rubric.length === 0 ? (
          <div className="text-sm text-zinc-600">まだルーブリックがありません（teacherが追加してください）</div>
        ) : (
          <ul className="space-y-2">
            {rubric.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {c.order_index}. {c.name}
                    </div>
                    {c.description ? <div className="mt-1 text-sm text-zinc-600">{c.description}</div> : null}
                  </div>
                  <div className="text-xs text-zinc-500">max: {c.max_score}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {user?.role === "teacher" ? (
          <div className="mt-5 rounded-lg border bg-zinc-50 p-4">
            <div className="text-sm font-semibold">（teacher）ルーブリックを追加</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="項目名">
                <TextInput value={rubricName} onChange={(e) => setRubricName(e.target.value)} />
              </Field>
              <Field label="max score">
                <TextInput
                  type="number"
                  min={1}
                  max={100}
                  value={rubricMax}
                  onChange={(e) => setRubricMax(Number(e.target.value))}
                />
              </Field>
              <Field label="表示順（order_index）">
                <TextInput
                  type="number"
                  min={0}
                  value={rubricOrder}
                  onChange={(e) => setRubricOrder(Number(e.target.value))}
                />
              </Field>
              <Field label="説明（任意）">
                <TextInput value={rubricDesc} onChange={(e) => setRubricDesc(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <PrimaryButton onClick={addRubric} disabled={rubricAdding || !rubricName.trim()}>
                追加
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Card>

      {user?.role === "teacher" ? (
        <Card
          title="（teacher）提出一覧 & 採点"
          actions={
            <SecondaryButton onClick={loadTeacherSubmissions} disabled={teacherSubmissionsLoading}>
              更新
            </SecondaryButton>
          }
        >
          {teacherSubmissionsLoading ? <div className="text-sm text-zinc-600">読み込み中...</div> : null}
          {teacherSubmissions.length === 0 ? (
            <div className="text-sm text-zinc-600">提出がまだありません</div>
          ) : (
            <div className="space-y-2">
              {teacherSubmissions.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">submission: {shortId(s.id)}</div>
                      <div className="text-xs text-zinc-500">
                        author: {shortId(s.author_id)} / {s.file_type} / {new Date(s.created_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-zinc-500">
                        teacher_total_score: {s.teacher_total_score ?? "-"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <SecondaryButton onClick={() => downloadSubmission(s.id, s.file_type)}>DL</SecondaryButton>
                      <PrimaryButton onClick={() => openTeacherGrade(s.id)}>採点</PrimaryButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {gradeTargetId ? (
            <div className="mt-4 rounded-lg border bg-zinc-50 p-4">
              <div className="text-sm font-semibold">採点: {shortId(gradeTargetId)}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="teacher_total_score（0-100推奨）">
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    value={teacherTotalScore}
                    onChange={(e) => setTeacherTotalScore(Number(e.target.value))}
                  />
                </Field>
                <Field label="自動計算（ルーブリック合計を0-100へ換算）">
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      const total = rubric.reduce((sum, c) => sum + Number(teacherRubricScores[c.id] ?? 0), 0);
                      const score = totalRubricMax > 0 ? Math.round((total / totalRubricMax) * 100) : 0;
                      setTeacherTotalScore(score);
                    }}
                  >
                    ルーブリックから計算
                  </SecondaryButton>
                </Field>
              </div>
              <div className="mt-3">
                <Field label="teacher_feedback（任意）">
                  <TextArea value={teacherFeedback} onChange={(e) => setTeacherFeedback(e.target.value)} rows={3} />
                </Field>
              </div>
              <div className="mt-3 space-y-2">
                {rubric.map((c) => (
                  <div key={c.id} className="grid gap-2 sm:grid-cols-2">
                    <div className="text-sm">
                      {c.name}（max {c.max_score}）
                    </div>
                    <TextInput
                      type="number"
                      min={0}
                      max={c.max_score}
                      value={teacherRubricScores[c.id] ?? 0}
                      onChange={(e) =>
                        setTeacherRubricScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <PrimaryButton onClick={submitTeacherGrade}>保存</PrimaryButton>
                <SecondaryButton onClick={() => setGradeTargetId(null)}>キャンセル</SecondaryButton>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {user?.role === "student" ? (
        <Card title="（student）提出（My Submission）" actions={<SecondaryButton onClick={loadMySubmission}>更新</SecondaryButton>}>
          {!token ? (
            <div className="text-sm text-zinc-600">ログインすると提出できます</div>
          ) : mySubmissionStatus === "loading" ? (
            <div className="text-sm text-zinc-600">読み込み中...</div>
          ) : mySubmissionStatus === "missing" ? (
            <div className="space-y-3">
              <div className="text-sm text-zinc-700">
                まだ提出していません。Markdown（.md）推奨（AIの「本文＋レビュー」判定が効きやすいです）。
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".md,.pdf,text/markdown,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <PrimaryButton onClick={upload} disabled={uploading || !file}>
                  提出
                </PrimaryButton>
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
                <SecondaryButton onClick={() => downloadSubmission(mySubmission.id, mySubmission.file_type)}>
                  ファイルDL
                </SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-600">「更新」を押して状態を取得してください</div>
          )}
        </Card>
      ) : null}

      {user?.role === "student" ? (
        <Card
          title="（student）レビュー（Next Task → Submit）"
          actions={
            <div className="flex gap-2">
              <SecondaryButton onClick={getNextTask}>次のレビューを取得</SecondaryButton>
            </div>
          }
        >
          {!token ? (
            <div className="text-sm text-zinc-600">ログインするとレビューできます</div>
          ) : !reviewTask ? (
            <div className="text-sm text-zinc-600">
              「次のレビューを取得」を押してください（未提出タスクがある場合は同じタスクが出続けます）
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-zinc-50 p-3 text-sm">
                <div>author_alias: {reviewTask.author_alias}</div>
                <div>submission_id: {shortId(reviewTask.submission_id)}</div>
                <div>file_type: {reviewTask.file_type}</div>
                <div className="mt-2">
                  <SecondaryButton onClick={() => downloadSubmission(reviewTask.submission_id, reviewTask.file_type)}>
                    提出物をDL
                  </SecondaryButton>
                </div>
              </div>

              <div className="space-y-2">
                {reviewTask.rubric.map((c) => (
                  <div key={c.id} className="grid gap-2 sm:grid-cols-2">
                    <div className="text-sm">
                      {c.name}（max {c.max_score}）
                    </div>
                    <TextInput
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
                <TextArea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={5} />
              </Field>

              <div className="flex gap-2">
                <PrimaryButton onClick={submitReview} disabled={reviewSubmitting || !reviewComment.trim()}>
                  レビュー提出
                </PrimaryButton>
                <SecondaryButton onClick={() => setReviewTask(null)}>キャンセル</SecondaryButton>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {user?.role === "student" ? (
        <Card
          title="（student）受け取ったレビュー（Received Reviews）"
          actions={
            <SecondaryButton onClick={loadReceived} disabled={receivedLoading}>
              更新
            </SecondaryButton>
          }
        >
          {!token ? (
            <div className="text-sm text-zinc-600">ログインすると確認できます</div>
          ) : receivedLoading ? (
            <div className="text-sm text-zinc-600">読み込み中...</div>
          ) : received.length === 0 ? (
            <div className="text-sm text-zinc-600">まだレビューが届いていません</div>
          ) : (
            <div className="space-y-3">
              {received.map((r) => (
                <div key={r.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{r.reviewer_alias}</div>
                      <div className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      AI品質: {r.ai_quality_score ?? "-"}
                    </div>
                  </div>
                  {r.ai_quality_reason ? (
                    <div className="mt-2 rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
                      {r.ai_quality_reason}
                    </div>
                  ) : null}
                  <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{r.comment}</div>

                  {r.rubric_scores?.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {r.rubric_scores.map((s) => (
                        <div key={s.criterion_id} className="text-xs text-zinc-600">
                          {shortId(s.criterion_id)}: {s.score}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {r.meta_review ? (
                    <div className="mt-3 rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">
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
        </Card>
      ) : null}

      {user?.role === "student" ? (
        <Card
          title="（student）成績（Grade）"
          actions={
            <SecondaryButton onClick={loadGrade} disabled={gradeLoading}>
              更新
            </SecondaryButton>
          }
        >
          {!token ? (
            <div className="text-sm text-zinc-600">ログインすると確認できます</div>
          ) : gradeLoading ? (
            <div className="text-sm text-zinc-600">読み込み中...</div>
          ) : grade ? (
            <div className="space-y-2 text-sm">
              <div>assignment_score: {grade.assignment_score ?? "-"}</div>
              <div>review_contribution: {grade.review_contribution.toFixed(2)}</div>
              <div className="font-semibold">final_score: {grade.final_score ?? "-"}</div>
              <details className="rounded-md border bg-zinc-50 p-3 text-xs">
                <summary className="cursor-pointer">breakdown</summary>
                <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(grade.breakdown, null, 2)}</pre>
              </details>
            </div>
          ) : (
            <div className="text-sm text-zinc-600">「更新」を押して取得してください</div>
          )}
        </Card>
      ) : null}

      {user?.role === "student" ? (
        <Card
          title="（student）レビュアースキル（Radar）"
          actions={
            <SecondaryButton onClick={loadSkill} disabled={skillLoading}>
              更新
            </SecondaryButton>
          }
        >
          {!token ? (
            <div className="text-sm text-zinc-600">ログインすると確認できます</div>
          ) : skillLoading ? (
            <div className="text-sm text-zinc-600">読み込み中...</div>
          ) : skill ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm text-zinc-700">
                <div>Logic: {skill.logic.toFixed(2)}</div>
                <div>Specificity: {skill.specificity.toFixed(2)}</div>
                <div>Empathy: {skill.empathy.toFixed(2)}</div>
                <div>Insight: {skill.insight.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <RadarSkillChart skill={skill} />
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-600">「更新」を押して取得してください</div>
          )}
        </Card>
      ) : null}

      {user ? null : (
        <Card title="ログインが必要な操作">
          <div className="text-sm text-zinc-700">
            提出・レビュー・メタ評価・採点などはログイン後に利用できます。
          </div>
          <div className="mt-3 flex gap-2">
            <Link className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800" href="/auth/login">
              ログイン
            </Link>
            <Link className="rounded-md border px-4 py-2 text-sm hover:bg-zinc-50" href="/auth/register">
              新規登録
            </Link>
          </div>
        </Card>
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
    <div className="mt-3 rounded-md border bg-zinc-50 p-3">
      <div className="text-sm font-medium">メタ評価（このレビューは役に立ちましたか？）</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="helpfulness (1-5)">
          <Select value={helpfulness} onChange={(e) => setHelpfulness(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="コメント（任意）">
          <TextInput value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
      <div className="mt-2">
        <PrimaryButton onClick={submit} disabled={submitting}>
          送信
        </PrimaryButton>
      </div>
    </div>
  );
}
