"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/app/providers";
import {
  ApiError,
  apiAddRubric,
  apiDownloadSubmissionFile,
  apiGetMyGrade,
  apiGetMySubmission,
  apiListEligibleTAs,
  apiGetReviewerSkill,
  apiListAssignments,
  apiListRubric,
  apiNextReviewTask,
  apiCreateTARequest,
  apiListReviewsForSubmission,
  apiListTARequestsForAssignment,
  apiReceivedReviews,
  apiSubmitReport,
  apiSubmitReview,
  apiTeacherGradeSubmission,
  apiTeacherListSubmissions,
  apiCreateMetaReview,
  apiParaphrase,
  formatApiError,
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
  TeacherReviewPublic,
  TAReviewRequestPublic,
  UserPublic,
  RephraseResponse,
} from "@/lib/types";
import { ErrorMessages } from "@/components/ErrorMessages";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const REVIEW_TEMPLATES: { key: string; label: string; text: string }[] = [
  { key: "good", label: "良い点", text: "【良い点】主張が明確で、根拠となるデータ/引用が添えられています。" },
  { key: "improve", label: "改善点", text: "【改善点】この部分の論拠が弱いので、出典や具体例を1〜2個追加してください。" },
  { key: "evidence", label: "根拠不足", text: "【根拠不足】結論と根拠の間に飛躍があります。データ/引用/図表などのエビデンスを補ってください。" },
  { key: "typo", label: "誤字", text: "【誤字】タイポや表記ゆれがあります。最終提出前に再確認してください。" },
  { key: "structure", label: "構成", text: "【構成】段落ごとに主張→根拠→結論の流れを意識すると読みやすくなります。" },
  { key: "example", label: "具体例", text: "【具体例】読者がイメージできる具体例を1つ追加すると説得力が増します。" },
];

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
  const templateClicks = useRef<Record<string, number>>({});

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
  const [teacherReviewList, setTeacherReviewList] = useState<TeacherReviewPublic[]>([]);
  const [teacherReviewListLoading, setTeacherReviewListLoading] = useState(false);
  const [teacherReviewListTargetId, setTeacherReviewListTargetId] = useState<string | null>(null);
  const [teacherReviewListError, setTeacherReviewListError] = useState<string | null>(null);
  const [taCandidates, setTaCandidates] = useState<UserPublic[]>([]);
  const [taCandidatesLoading, setTaCandidatesLoading] = useState(false);
  const [taDialogSubmissionId, setTaDialogSubmissionId] = useState<string | null>(null);
  const [taSelectedUserId, setTaSelectedUserId] = useState<string | null>(null);
  const [taRequesting, setTaRequesting] = useState(false);
  const [taRequests, setTaRequests] = useState<TAReviewRequestPublic[]>([]);
  const [taRequestsLoading, setTaRequestsLoading] = useState(false);
  const [paraphrasePreview, setParaphrasePreview] = useState<RephraseResponse | null>(null);
  const [paraphraseLoading, setParaphraseLoading] = useState(false);
  const [paraphraseError, setParaphraseError] = useState<string | null>(null);

  const [rubricName, setRubricName] = useState("");
  const [rubricDesc, setRubricDesc] = useState("");
  const [rubricMax, setRubricMax] = useState(5);
  const [rubricOrder, setRubricOrder] = useState(0);
  const [rubricAdding, setRubricAdding] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const totalRubricMax = useMemo(() => rubric.reduce((sum, c) => sum + c.max_score, 0), [rubric]);
  const taRequestsBySubmission = useMemo(() => {
    const map: Record<string, TAReviewRequestPublic[]> = {};
    for (const r of taRequests) {
      if (!map[r.submission_id]) map[r.submission_id] = [];
      map[r.submission_id].push(r);
    }
    return map;
  }, [taRequests]);

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

  const appendReviewComment = (text: string) => {
    setReviewComment((prev) => {
      if (!prev.trim()) return text;
      return `${prev}\n\n${text}`;
    });
  };

  const insertTemplate = (tpl: { key: string; label: string; text: string }) => {
    appendReviewComment(tpl.text);
    const nextCount = (templateClicks.current[tpl.key] ?? 0) + 1;
    templateClicks.current = { ...templateClicks.current, [tpl.key]: nextCount };
    console.info("review template used", { key: tpl.key, label: tpl.label, count: nextCount });
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
      const res = await apiSubmitReview(token, reviewTask.review_assignment_id, payload);
      setReviewTask(null);
      setReviewComment("");
      const creditLabel = res.credit_awarded ? `credits +${res.credit_awarded}` : "credits 加算";
      setNotice(`レビューを提出しました（${creditLabel}）`);
      await refreshMe();
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const runParaphrase = async () => {
    if (!token) {
      setParaphraseError("ログインが必要です");
      return;
    }
    if (!reviewComment.trim()) {
      setParaphraseError("言い換えるテキストを入力してください");
      return;
    }
    setParaphraseLoading(true);
    setParaphraseError(null);
    setParaphrasePreview(null);
    try {
      const res = await apiParaphrase(token, reviewComment);
      setParaphrasePreview(res);
    } catch (err) {
      setParaphraseError(formatApiError(err));
    } finally {
      setParaphraseLoading(false);
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

  const loadTARequests = async () => {
    if (!token) return;
    setTaRequestsLoading(true);
    try {
      const list = await apiListTARequestsForAssignment(token, assignmentId);
      setTaRequests(list);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTaRequestsLoading(false);
    }
  };

  const loadEligibleTAs = async () => {
    if (!token) return;
    setTaCandidatesLoading(true);
    try {
      const list = await apiListEligibleTAs(token);
      setTaCandidates(list);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTaCandidatesLoading(false);
    }
  };

  const openTARequest = (submissionId: string) => {
    setTaDialogSubmissionId(submissionId);
    setTaSelectedUserId(null);
    if (!taCandidates.length) {
      void loadEligibleTAs();
    }
  };

  const submitTARequest = async () => {
    if (!token || !taDialogSubmissionId || !taSelectedUserId) return;
    setTaRequesting(true);
    setNotice(null);
    try {
      await apiCreateTARequest(token, taDialogSubmissionId, taSelectedUserId);
      setNotice("TA依頼を送信しました");
      setTaDialogSubmissionId(null);
      setTaSelectedUserId(null);
      await loadTARequests();
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTaRequesting(false);
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

  const openTeacherReviews = async (submissionId: string) => {
    if (!token) return;
    setTeacherReviewListTargetId(submissionId);
    setTeacherReviewList([]);
    setTeacherReviewListLoading(true);
    setTeacherReviewListError(null);
    setNotice(null);
    try {
      const list = await apiListReviewsForSubmission(token, submissionId);
      setTeacherReviewList(list);
    } catch (err) {
      const msg = formatApiError(err);
      setTeacherReviewListError(msg);
      setNotice(msg);
    } finally {
      setTeacherReviewListLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    if (user.role === "teacher") {
      void loadTeacherSubmissions();
      void loadTARequests();
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
          <AlertDescription>
            <ErrorMessages message={errorBase} />
          </AlertDescription>
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
          <AlertDescription>
            <ErrorMessages message={notice} />
          </AlertDescription>
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
            <Button
              variant="outline"
              onClick={() => {
                void loadTeacherSubmissions();
                void loadTARequests();
              }}
              disabled={teacherSubmissionsLoading}
            >
              更新
            </Button>
          }
        >
          {taRequestsLoading ? <p className="text-xs text-muted-foreground">TA依頼を読み込み中...</p> : null}
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
                      <div className="text-xs text-muted-foreground">
                        TA依頼:{" "}
                        {taRequestsBySubmission[s.id]?.length ? (
                          <span className="inline-flex flex-wrap gap-1">
                            {taRequestsBySubmission[s.id].map((r) => (
                              <span
                                key={r.id}
                                className={[
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                                  r.status === "offered"
                                    ? "bg-amber-100 text-amber-900"
                                    : r.status === "accepted"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-slate-100 text-slate-900",
                                ].join(" ")}
                                title={`ta: ${shortId(r.ta_id)} / ${new Date(r.created_at).toLocaleString()}`}
                              >
                                {r.status} ({shortId(r.ta_id)})
                              </span>
                            ))}
                          </span>
                        ) : (
                          "なし"
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => downloadSubmission(s.id, s.file_type)}>
                        DL
                      </Button>
                      <Button onClick={() => openTeacherGrade(s.id)}>採点</Button>
                      <Button variant="outline" onClick={() => openTeacherReviews(s.id)}>
                        レビュー一覧
                      </Button>
                      <Button variant="outline" onClick={() => openTARequest(s.id)}>
                        TA依頼
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog
            open={Boolean(gradeTargetId)}
            onOpenChange={(open: boolean) => {
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

          <Dialog
            open={Boolean(taDialogSubmissionId)}
            onOpenChange={(open: boolean) => {
              if (!open) {
                setTaDialogSubmissionId(null);
                setTaSelectedUserId(null);
              }
            }}
          >
            {taDialogSubmissionId ? (
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>TA依頼: {shortId(taDialogSubmissionId)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    TA資格のある学生に依頼します。受諾されると、その学生がこの提出物をレビューできます。
                  </p>
                  <Field label="TAを選択">
                    <Select
                      value={taSelectedUserId ?? undefined}
                      onValueChange={(v) => setTaSelectedUserId(v)}
                      onOpenChange={(o) => {
                        if (o && !taCandidates.length && !taCandidatesLoading) void loadEligibleTAs();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={taCandidatesLoading ? "読み込み中..." : "選択してください"} />
                      </SelectTrigger>
                      <SelectContent>
                        {taCandidates.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            {taCandidatesLoading ? "読み込み中..." : "TA資格の学生がいません"}
                          </div>
                        ) : (
                          taCandidates.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} / {u.title} / ランク: {u.rank} / credits: {u.credits}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTaDialogSubmissionId(null)}>
                    キャンセル
                  </Button>
                  <Button onClick={submitTARequest} disabled={!taSelectedUserId || taRequesting}>
                    {taRequesting ? "送信中..." : "依頼を送信"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            ) : null}
          </Dialog>

          <Dialog
            open={Boolean(teacherReviewListTargetId)}
            onOpenChange={(open: boolean) => {
              if (!open) {
                setTeacherReviewListTargetId(null);
                setTeacherReviewList([]);
              }
            }}
          >
            {teacherReviewListTargetId ? (
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>レビュー一覧: {shortId(teacherReviewListTargetId)}</DialogTitle>
                </DialogHeader>
                {teacherReviewListLoading ? (
                  <p className="text-sm text-muted-foreground">読み込み中...</p>
                ) : teacherReviewList.length === 0 ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {teacherReviewListError ? (
                      <Alert variant="destructive">
                        <AlertTitle>取得に失敗しました</AlertTitle>
                        <AlertDescription className="whitespace-pre-wrap">
                          {teacherReviewListError}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <p>まだレビューがありません</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (teacherReviewListTargetId) void openTeacherReviews(teacherReviewListTargetId);
                      }}
                    >
                      再読み込み
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {["TA", "student"].map((group) => {
                      const list = teacherReviewList.filter((r) => (group === "TA" ? r.is_ta : !r.is_ta));
                      return (
                        <div key={group} className="space-y-2">
                          <div className="text-sm font-semibold">
                            {group === "TA" ? "TAレビュー" : "一般レビュー"}（{list.length}件）
                          </div>
                          {list.length === 0 ? (
                            <p className="text-xs text-muted-foreground">なし</p>
                          ) : (
                            <div className="space-y-3">
                              {list.map((r) => (
                                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="font-medium">Reviewer: {r.reviewer_alias}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(r.created_at).toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      AI品質: {r.ai_quality_score ?? "-"}
                                    </div>
                                  </div>
                                  <div className="whitespace-pre-wrap text-sm">{r.comment}</div>
                                  <div className="space-y-1 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                                    <div className="font-semibold">Rubric</div>
                                    {r.rubric_scores.map((s) => (
                                      <div key={s.criterion_id}>
                                        {s.criterion_id}: {s.score}
                                      </div>
                                    ))}
                                  </div>
                                  {r.meta_review ? (
                                    <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                                      メタ評価: {r.meta_review.helpfulness}/5
                                      {r.meta_review.comment ? ` / ${r.meta_review.comment}` : ""}
                                    </div>
                                  ) : null}
                                  {r.ai_quality_reason ? (
                                    <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                      {r.ai_quality_reason}
                                    </div>
                                  ) : null}
                                  {r.rubric_alignment_score !== null ||
                                  r.ai_comment_alignment_score !== null ||
                                  r.total_alignment_score !== null ||
                                  r.credit_awarded !== null ||
                                  r.ai_comment_alignment_reason ? (
                                    <div className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground space-y-1">
                                      <div>ルーブリック一致: {r.rubric_alignment_score ?? "-"}/5</div>
                                      <div>レビュー文一致: {r.ai_comment_alignment_score ?? "-"}/5</div>
                                      <div>総合評価: {r.total_alignment_score ?? "-"}/5</div>
                                      <div>付与credits: {r.credit_awarded ?? "-"}</div>
                                      {r.ai_comment_alignment_reason ? (
                                        <div className="whitespace-pre-wrap">{r.ai_comment_alignment_reason}</div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTeacherReviewListTargetId(null)}>
                    閉じる
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
              <div className="space-y-3">
                <div
                  className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("border-muted-foreground/60", "bg-muted/60");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-muted-foreground/60", "bg-muted/60");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-muted-foreground/60", "bg-muted/60");
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile && (droppedFile.type === "text/markdown" || droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".md") || droppedFile.name.endsWith(".pdf"))) {
                      setFile(droppedFile);
                    }
                  }}
                >
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
                    <div className="text-sm font-medium">ファイルを選択またはドラッグ＆ドロップ</div>
                    <div className="text-xs text-muted-foreground">
                      {file ? file.name : "Markdown (.md) または PDF (.pdf)"}
                    </div>
                    <input
                      type="file"
                      accept=".md,.pdf,text/markdown,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
                <Button onClick={upload} disabled={uploading || !file} className="w-full">
                  {uploading ? "提出中..." : "提出"}
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
                <div className="space-y-2">
                  <div className="space-y-2 rounded-md border bg-muted/70 p-3">
                    <div className="text-xs font-medium text-muted-foreground">定型文を挿入</div>
                    <div className="flex flex-wrap gap-2">
                      {REVIEW_TEMPLATES.map((tpl) => (
                        <Button key={tpl.key} size="sm" variant="outline" onClick={() => insertTemplate(tpl)}>
                          {tpl.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={5} />
                  <div className="space-y-2">
                    <div className="">
                      <Button size="sm" variant="outline" onClick={runParaphrase} disabled={paraphraseLoading}>
                        言い換え
                      </Button>
                      {paraphraseLoading ? <span className="ml-2 text-sm text-muted-foreground">変換中...</span> : null}
                    </div>
                    {paraphraseError ? (
                      <Alert variant="destructive">
                        <AlertTitle>エラー</AlertTitle>
                        <AlertDescription className="text-sm">{paraphraseError}</AlertDescription>
                      </Alert>
                    ) : null}
                    {paraphrasePreview ? (
                      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">変換結果</div>
                          <div className="mt-1 whitespace-pre-wrap text-sm">{paraphrasePreview.rephrased}</div>
                        </div>
                        {paraphrasePreview.notice ? (
                          <div className="text-xs text-muted-foreground">{paraphrasePreview.notice}</div>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (paraphrasePreview) setReviewComment(paraphrasePreview.rephrased);
                            }}
                          >
                            反映する
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={runParaphrase}
                            disabled={paraphraseLoading || !reviewComment.trim()}
                          >
                            再変換
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
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
                  {r.rubric_alignment_score !== null ||
                  r.ai_comment_alignment_score !== null ||
                  r.total_alignment_score !== null ||
                  r.credit_awarded !== null ||
                  r.ai_comment_alignment_reason ? (
                    <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                      <div>ルーブリック一致: {r.rubric_alignment_score ?? "-"}/5</div>
                      <div>レビュー文一致: {r.ai_comment_alignment_score ?? "-"}/5</div>
                      <div>総合評価: {r.total_alignment_score ?? "-"}/5</div>
                      <div>付与credits: {r.credit_awarded ?? "-"}</div>
                      {r.ai_comment_alignment_reason ? (
                        <div className="whitespace-pre-wrap">{r.ai_comment_alignment_reason}</div>
                      ) : null}
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
              <p className="text-xs text-muted-foreground">
                ※ review_contribution はメタ評価/teacher採点との一致/AI品質の重み付けで算出し、未入力の項目は除外して残りの重みを再配分します。
              </p>
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
          <Select value={String(helpfulness)} onValueChange={(v: string) => setHelpfulness(Number(v))}>
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
