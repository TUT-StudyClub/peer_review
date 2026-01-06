"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/app/providers";
import {
  ApiError,
  apiDownloadSubmissionFile,
  apiGetMyGrade,
  apiGetMySubmission,
  apiListCourseStudents,
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
import { REVIEWER_SKILL_AXES } from "@/lib/reviewerSkill";
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

type ScoreInput = number | "";

const parseScoreInput = (value: string): ScoreInput => {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? "" : parsed;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatSkill(value: number) {
  return value > 0 ? value.toFixed(1) : "-";
}

function formatScore(value: number | null, digits = 1, fallback = "-") {
  if (value === null) return fallback;
  return value.toFixed(digits);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
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
  const [resubmitMode, setResubmitMode] = useState(false);

  const [reviewTask, setReviewTask] = useState<ReviewAssignmentTask | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewScores, setReviewScores] = useState<Record<string, ScoreInput>>({});
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
  const [courseStudents, setCourseStudents] = useState<UserPublic[]>([]);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [reviewCountsLoading, setReviewCountsLoading] = useState(false);
  const [reviewCountsLoaded, setReviewCountsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "reviewing" | "graded">("all");
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [gradeTargetId, setGradeTargetId] = useState<string | null>(null);
  const [teacherTotalScore, setTeacherTotalScore] = useState<number>(80);
  const [teacherFeedback, setTeacherFeedback] = useState<string>("");
  const [teacherRubricScores, setTeacherRubricScores] = useState<Record<string, ScoreInput>>({});
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

  const [notice, setNotice] = useState<string | null>(null);

  const totalRubricMax = useMemo(() => rubric.reduce((sum, c) => sum + c.max_score, 0), [rubric]);
  const rubricNameById = useMemo(() => new Map(rubric.map((c) => [c.id, c.name])), [rubric]);
  const backHref =
    user?.role === "student"
      ? "/mypage"
      : assignment?.course_id
        ? `/assignments?course_id=${assignment.course_id}`
        : "/assignments";
  const taRequestsBySubmission = useMemo(() => {
    const map: Record<string, TAReviewRequestPublic[]> = {};
    for (const r of taRequests) {
      if (!map[r.submission_id]) map[r.submission_id] = [];
      map[r.submission_id].push(r);
    }
    return map;
  }, [taRequests]);
  const studentById = useMemo(() => {
    return new Map(courseStudents.map((student) => [student.id, student]));
  }, [courseStudents]);
  const reviewTarget = assignment?.target_reviews_per_submission ?? 0;
  const reviewProgress = reviewTarget ? Math.min(received.length / reviewTarget, 1) : 0;
  const reviewTimeRange = useMemo(() => {
    if (!received.length) return { start: null, end: null };
    const times = received
      .map((r) => new Date(r.created_at).getTime())
      .filter((t) => !Number.isNaN(t));
    if (!times.length) return { start: null, end: null };
    return { start: Math.min(...times), end: Math.max(...times) };
  }, [received]);
  const reviewStartAt =
    reviewTimeRange.start === null ? null : new Date(reviewTimeRange.start).toLocaleString();
  const reviewCompleteAt =
    reviewTarget > 0 && received.length >= reviewTarget && reviewTimeRange.end !== null
      ? new Date(reviewTimeRange.end).toLocaleString()
      : null;
  const submissionCards = useMemo(() => {
    return teacherSubmissions.map((submission) => {
      const reviewCount = reviewCounts[submission.id] ?? 0;
      const student = studentById.get(submission.author_id);
      const status =
        submission.teacher_total_score !== null
          ? "graded"
          : reviewCount > 0
            ? "reviewing"
            : "waiting";
      return {
        submission,
        reviewCount,
        studentName: student?.name ?? `受講生 ${shortId(submission.author_id)}`,
        status,
      };
    });
  }, [teacherSubmissions, reviewCounts, studentById]);
  const filteredSubmissionCards = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return submissionCards.filter((card) => {
      if (statusFilter !== "all" && card.status !== statusFilter) {
        return false;
      }
      if (!keyword) return true;
      const candidates = [
        card.studentName,
        card.submission.author_id,
        card.submission.original_filename,
        card.submission.id,
        shortId(card.submission.id),
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return candidates.some((value) => value.includes(keyword));
    });
  }, [searchTerm, statusFilter, submissionCards]);
  const teacherSummary = useMemo(() => {
    let graded = 0;
    let reviewing = 0;
    let waiting = 0;
    for (const card of submissionCards) {
      if (card.status === "graded") graded += 1;
      else if (card.status === "reviewing") reviewing += 1;
      else waiting += 1;
    }
    return {
      total: submissionCards.length,
      graded,
      reviewing,
      waiting,
    };
  }, [submissionCards]);

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
      const init: Record<string, ScoreInput> = {};
      for (const c of rubric) init[c.id] = "";
      return init;
    });
    setTeacherRubricScores((prev) => {
      if (Object.keys(prev).length) return prev;
      const init: Record<string, ScoreInput> = {};
      for (const c of rubric) init[c.id] = "";
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
      setResubmitMode(false);
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

  const downloadAllSubmissions = async () => {
    if (!token) {
      setNotice("ダウンロードにはログインが必要です");
      return;
    }
    if (teacherSubmissions.length === 0) return;
    setBulkDownloading(true);
    for (const submission of teacherSubmissions) {
      await downloadSubmission(submission.id, submission.file_type);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setBulkDownloading(false);
  };

  const previewSubmission = async (submissionId: string) => {
    if (!token) {
      setNotice("プレビューにはログインが必要です");
      return;
    }
    setNotice(null);
    try {
      const blob = await apiDownloadSubmissionFile(token, submissionId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
      const init: Record<string, ScoreInput> = {};
      for (const c of task.rubric) init[c.id] = "";
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
      const s = await apiGetReviewerSkill(token, assignmentId);
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
      await loadReviewCounts(list);
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTeacherSubmissionsLoading(false);
    }
  };

  const loadCourseStudents = async () => {
    if (!token || !assignment?.course_id) return;
    try {
      const list = await apiListCourseStudents(token, assignment.course_id);
      setCourseStudents(list);
    } catch (err) {
      setNotice(formatApiError(err));
    }
  };

  const loadReviewCounts = async (submissions: SubmissionTeacherPublic[]) => {
    if (!token) return;
    if (submissions.length === 0) {
      setReviewCounts({});
      setReviewCountsLoaded(true);
      return;
    }
    setReviewCountsLoading(true);
    setReviewCountsLoaded(false);
    let succeeded = false;
    try {
      const entries = await Promise.all(
        submissions.map(async (submission) => {
          const list = await apiListReviewsForSubmission(token, submission.id);
          return [submission.id, list.length] as const;
        })
      );
      setReviewCounts(Object.fromEntries(entries));
      succeeded = true;
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setReviewCountsLoading(false);
      setReviewCountsLoaded(succeeded);
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
    const init: Record<string, ScoreInput> = {};
    for (const c of rubric) init[c.id] = "";
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
      void loadCourseStudents();
      return;
    }
    void loadMySubmission();
    void loadReceived();
    void loadGrade();
    void loadSkill();
    // NOTE: 初期表示時にだけロードしたいので、意図的に dependency を最小限にしています。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, assignmentId]);

  useEffect(() => {
    if (!token || user?.role !== "teacher" || !assignment?.course_id) return;
    void loadCourseStudents();
  }, [token, user?.role, assignment?.course_id]);

  const renderUploadArea = (options: { submitLabel: string; onCancel?: () => void }) => (
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
          if (
            droppedFile &&
            (droppedFile.type === "text/markdown" ||
              droppedFile.type === "application/pdf" ||
              droppedFile.name.endsWith(".md") ||
              droppedFile.name.endsWith(".pdf"))
          ) {
            setFile(droppedFile);
          }
        }}
      >
        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
          <div className="text-sm font-medium">ファイルを選択またはドラッグ＆ドロップ</div>
          <div className="text-xs text-muted-foreground">{file ? file.name : "Markdown (.md) または PDF (.pdf)"}</div>
          <input
            type="file"
            accept=".md,.pdf,text/markdown,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={upload} disabled={uploading || !file} className="w-full sm:flex-1">
          {uploading ? "提出中..." : options.submitLabel}
        </Button>
        {options.onCancel ? (
          <Button variant="outline" onClick={options.onCancel} className="w-full sm:flex-1">
            キャンセル
          </Button>
        ) : null}
      </div>
    </div>
  );

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
          <Link href={backHref}>{user?.role === "student" ? "マイページへ戻る" : "課題一覧へ戻る"}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title={assignment ? assignment.title : `課題 ${assignmentId}`} contentClassName="space-y-2">
        {assignment?.description ? <p className="text-sm text-muted-foreground">{assignment.description}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            必要レビュー数: {assignment?.target_reviews_per_submission ?? "-"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            作成日: {assignment?.created_at ? new Date(assignment.created_at).toLocaleString() : "-"}
          </span>
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

      </SectionCard>

      {user?.role === "teacher" ? (
        <SectionCard
          title="提出一覧"
          actions={
            <Button
              variant="outline"
              onClick={downloadAllSubmissions}
              disabled={bulkDownloading || teacherSubmissions.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {bulkDownloading ? "ダウンロード中..." : "一括ダウンロード"}
            </Button>
          }
          contentClassName="space-y-6"
        >
          <div className="text-sm text-muted-foreground">
            課題: {assignment?.title ?? "-"}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">総提出数</div>
                <div className="text-lg font-semibold">{teacherSummary.total}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">採点済み</div>
                <div className="text-lg font-semibold">{teacherSummary.graded}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">レビュー中</div>
                <div className="text-lg font-semibold">
                  {reviewCountsLoaded ? teacherSummary.reviewing : "-"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">レビュー待ち</div>
                <div className="text-lg font-semibold">
                  {reviewCountsLoaded ? teacherSummary.waiting : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="学生名、学籍番号、提出IDで検索..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue placeholder="すべて" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="waiting">レビュー待ち</SelectItem>
                  <SelectItem value="reviewing">レビュー中</SelectItem>
                  <SelectItem value="graded">採点済み</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                フィルター
              </Button>
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
            </div>
          </div>

          {taRequestsLoading ? <p className="text-xs text-muted-foreground">TA依頼を読み込み中...</p> : null}
          {teacherSubmissionsLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {reviewCountsLoading ? <p className="text-sm text-muted-foreground">レビュー数を取得中...</p> : null}

          {!teacherSubmissionsLoading && teacherSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">提出がまだありません</p>
          ) : !teacherSubmissionsLoading && filteredSubmissionCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当する提出がありません</p>
          ) : (
            <div className="space-y-4">
              {filteredSubmissionCards.map((card) => {
                const reviewLabel =
                  reviewTarget && reviewCountsLoaded ? `${card.reviewCount}/${reviewTarget}` : "-";
                const progressValue = reviewTarget ? Math.min(card.reviewCount / reviewTarget, 1) : 0;
                const statusLabel =
                  card.status === "graded" ? "採点済み" : card.status === "reviewing" ? "レビュー中" : "レビュー待ち";
                const statusClass =
                  card.status === "graded"
                    ? "bg-emerald-50 text-emerald-700"
                    : card.status === "reviewing"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-600";
                const taRequestCount = taRequestsBySubmission[card.submission.id]?.length ?? 0;
                return (
                  <div key={card.submission.id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                          <GraduationCap className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <div className="text-base font-semibold">{card.studentName}</div>
                            <div className="text-xs text-muted-foreground">
                              ({shortId(card.submission.author_id)})
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="max-w-[280px] truncate">
                              {card.submission.original_filename ||
                                `submission-${shortId(card.submission.id)}.${
                                  card.submission.file_type === "pdf" ? "pdf" : "md"
                                }`}
                            </span>
                            <span>・</span>
                            <span>{card.submission.file_type === "pdf" ? "PDF" : "Markdown"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            提出: {formatDateTime(card.submission.created_at)} ・ ID:{" "}
                            {shortId(card.submission.id)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                          {statusLabel}
                        </span>
                        {card.submission.teacher_total_score !== null ? (
                          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            教員採点 {card.submission.teacher_total_score}点
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>ピアレビュー進捗</span>
                        <span>{reviewLabel}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${progressValue * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSubmission(card.submission.id, card.submission.file_type)}
                        className="w-full"
                      >
                        ダウンロード
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTeacherGrade(card.submission.id)}
                        className="w-full"
                      >
                        採点
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTeacherReviews(card.submission.id)}
                        className="w-full"
                      >
                        レビュー一覧
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTARequest(card.submission.id)}
                        className="w-full"
                      >
                        TA依頼{taRequestCount ? ` (${taRequestCount})` : ""}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
                        value={teacherRubricScores[c.id] ?? ""}
                        onChange={(e) =>
                          setTeacherRubricScores((prev) => ({
                            ...prev,
                            [c.id]: parseScoreInput(e.target.value),
                          }))
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
                                        {rubricNameById.get(s.criterion_id) ?? shortId(s.criterion_id)}: {s.score}
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
          title="提出"
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
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                まだ提出していません。Markdown（.md）推奨（AIの「本文＋レビュー」判定が効きやすいです）。
              </p>
              {renderUploadArea({ submitLabel: "提出" })}
            </div>
          ) : mySubmission ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold">提出完了</div>
                  <div className="text-sm text-muted-foreground">
                    課題が正常に提出されました。レビューをお待ちください。
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">提出ファイル</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                          <FileText className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {mySubmission.original_filename ||
                              `submission-${shortId(mySubmission.id)}.${
                                mySubmission.file_type === "pdf" ? "pdf" : "md"
                              }`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mySubmission.file_type === "pdf" ? "PDF" : "Markdown"} ・{" "}
                            {formatDateTime(mySubmission.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => downloadSubmission(mySubmission.id, mySubmission.file_type)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        ダウンロード
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => previewSubmission(mySubmission.id)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        プレビュー
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setResubmitMode(true);
                          setFile(null);
                        }}
                        className="gap-2"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        再提出
                      </Button>
                    </div>
                    {resubmitMode ? (
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                        <div className="text-sm font-medium">再提出</div>
                        <div className="text-xs text-muted-foreground">再提出すると前の提出は上書きされます。</div>
                        {renderUploadArea({
                          submitLabel: "再提出",
                          onCancel: () => {
                            setResubmitMode(false);
                            setFile(null);
                          },
                        })}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">ステータス</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg border bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                      <CheckCircle2 className="h-4 w-4" />
                      提出済み
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">レビュー進捗</span>
                        <span className="font-medium">
                          {receivedLoading
                            ? "読み込み中..."
                            : reviewTarget
                              ? `${received.length}/${reviewTarget}`
                              : "-"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${reviewProgress * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {reviewTarget
                          ? `${reviewTarget}人のレビュアーが割り当てられています。`
                          : "レビュアーがまだ割り当てられていません。"}
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-sm font-semibold">タイムライン</div>
                      <div className="mt-3 space-y-4">
                        {[
                          {
                            label: "提出完了",
                            time: formatDateTime(mySubmission.created_at),
                            active: true,
                          },
                          {
                            label: "レビュー開始",
                            time: reviewStartAt ?? "待機中",
                            active: Boolean(reviewStartAt),
                          },
                          {
                            label: "レビュー完了",
                            time: reviewCompleteAt ?? "待機中",
                            active: Boolean(reviewCompleteAt),
                          },
                        ].map((item, index, items) => (
                          <div key={item.label} className="relative pl-6">
                            <div
                              className={[
                                "absolute left-0 top-1 h-3 w-3 rounded-full",
                                item.active ? "bg-emerald-500" : "bg-muted-foreground/30",
                              ].join(" ")}
                            />
                            {index < items.length - 1 ? (
                              <div className="absolute left-[5px] top-3 h-full w-px bg-muted" />
                            ) : null}
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.time}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して状態を取得してください</p>
          )}
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="レビュー"
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
                      value={reviewScores[c.id] ?? ""}
                      onChange={(e) =>
                        setReviewScores((prev) => ({ ...prev, [c.id]: parseScoreInput(e.target.value) }))
                      }
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
          title="受け取ったレビュー"
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
                          {rubricNameById.get(s.criterion_id) ?? shortId(s.criterion_id)}: {s.score}
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
          title="成績"
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
            <div className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">課題スコア</div>
                  <div className="text-lg font-semibold">
                    {formatScore(grade.assignment_score, 1, "採点待ち")}
                  </div>
                  <div className="text-xs text-muted-foreground">/100</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">レビュー貢献</div>
                  <div className="text-lg font-semibold">
                    +{formatScore(grade.review_contribution, 2)}
                  </div>
                  <div className="text-xs text-muted-foreground">加点</div>
                </div>
                <div className="rounded-lg border bg-primary/10 p-3">
                  <div className="text-xs text-muted-foreground">最終スコア</div>
                  <div className="text-2xl font-semibold text-primary">
                    {formatScore(grade.final_score, 1, "未確定")}
                  </div>
                  <div className="text-xs text-muted-foreground">max 100</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ※ レビュー貢献はメタ評価/teacher採点との一致/AI品質の重み付けで算出し、未入力の項目は除外して残りの重みを再配分します。
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して取得してください</p>
          )}
        </SectionCard>
      ) : null}

      {user?.role === "student" ? (
        <SectionCard
          title="レビュアースキル"
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
