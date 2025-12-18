import type {
  AssignmentCreate,
  AssignmentPublic,
  GradeMe,
  MetaReviewCreate,
  MetaReviewPublic,
  ReviewerSkill,
  ReviewAssignmentTask,
  ReviewPublic,
  ReviewReceived,
  ReviewSubmit,
  RubricCriterionCreate,
  RubricCriterionPublic,
  SubmissionPublic,
  SubmissionTeacherPublic,
  TeacherGradeSubmit,
  UserCreate,
  UserPublic,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

type FastApiValidationErrorItem = {
  loc?: unknown;
  msg?: unknown;
};

function formatFastApiValidationErrors(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;

  const lines = detail
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const { loc, msg } = item as FastApiValidationErrorItem;
      const locParts = Array.isArray(loc) ? loc : [];
      const field = locParts.length ? String(locParts[locParts.length - 1]) : "body";
      const message = typeof msg === "string" ? msg : "Invalid value";
      return `${field}: ${message}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length ? lines.join("\n") : null;
}

async function parseErrorDetail(res: Response): Promise<{ message: string; detail: unknown }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object" && "detail" in (data as Record<string, unknown>)) {
      const detail = (data as Record<string, unknown>).detail;
      if (typeof detail === "string") {
        return { message: detail, detail };
      }

      const validationMessage = formatFastApiValidationErrors(detail);
      if (validationMessage) {
        return { message: validationMessage, detail };
      }

      if (detail && typeof detail === "object") {
        const maybeMessage = (detail as Record<string, unknown>).message;
        const maybeReason = (detail as Record<string, unknown>).reason;
        if (typeof maybeMessage === "string" && typeof maybeReason === "string") {
          return { message: `${maybeMessage}\n${maybeReason}`, detail };
        }
        if (typeof maybeMessage === "string") {
          return { message: maybeMessage, detail };
        }
      }

      return { message: "Request failed", detail };
    }
    return { message: "Request failed", detail: data };
  }
  const text = await res.text().catch(() => "");
  return { message: text || "Request failed", detail: text };
}

async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (err) {
    const hint = [
      "APIに接続できませんでした。",
      `NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}`,
      "",
      "確認ポイント:",
      "- backend が起動しているか（http://127.0.0.1:8000/docs が開ける）",
      "- フロントのURLが許可されたOriginか（CORS_ALLOW_ORIGINS / CORS_ALLOW_ORIGIN_REGEX）",
      "- 別端末からアクセスしている場合: 127.0.0.1 ではなくPCのIPを指定する",
    ].join("\n");
    throw new ApiError(hint, 0, err);
  }
  if (!res.ok) {
    const { message, detail } = await parseErrorDetail(res);
    throw new ApiError(message, res.status, detail);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export async function apiRegister(payload: UserCreate): Promise<UserPublic> {
  return apiFetch<UserPublic>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const data = await apiFetch<{ access_token: string }>("/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return data.access_token;
}

export async function apiGetMe(token: string): Promise<UserPublic> {
  return apiFetch<UserPublic>("/users/me", {}, token);
}

export async function apiListAssignments(): Promise<AssignmentPublic[]> {
  return apiFetch<AssignmentPublic[]>("/assignments");
}

export async function apiCreateAssignment(token: string, payload: AssignmentCreate): Promise<AssignmentPublic> {
  return apiFetch<AssignmentPublic>(
    "/assignments",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    token
  );
}

export async function apiListRubric(assignmentId: string): Promise<RubricCriterionPublic[]> {
  return apiFetch<RubricCriterionPublic[]>(`/assignments/${assignmentId}/rubric`);
}

export async function apiAddRubric(
  token: string,
  assignmentId: string,
  payload: RubricCriterionCreate
): Promise<RubricCriterionPublic> {
  return apiFetch<RubricCriterionPublic>(
    `/assignments/${assignmentId}/rubric`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    token
  );
}

export async function apiSubmitReport(
  token: string,
  assignmentId: string,
  file: File
): Promise<SubmissionPublic> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<SubmissionPublic>(`/submissions/assignment/${assignmentId}`, { method: "POST", body: form }, token);
}

export async function apiGetMySubmission(token: string, assignmentId: string): Promise<SubmissionPublic> {
  return apiFetch<SubmissionPublic>(`/submissions/assignment/${assignmentId}/me`, {}, token);
}

export async function apiDownloadSubmissionFile(token: string, submissionId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/submissions/${submissionId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const { message, detail } = await parseErrorDetail(res);
    throw new ApiError(message, res.status, detail);
  }
  return await res.blob();
}

export async function apiNextReviewTask(token: string, assignmentId: string): Promise<ReviewAssignmentTask> {
  return apiFetch<ReviewAssignmentTask>(`/assignments/${assignmentId}/reviews/next`, {}, token);
}

export async function apiSubmitReview(
  token: string,
  reviewAssignmentId: string,
  payload: ReviewSubmit
): Promise<ReviewPublic> {
  return apiFetch<ReviewPublic>(
    `/review-assignments/${reviewAssignmentId}/submit`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    token
  );
}

export async function apiReceivedReviews(token: string, assignmentId: string): Promise<ReviewReceived[]> {
  return apiFetch<ReviewReceived[]>(`/assignments/${assignmentId}/reviews/received`, {}, token);
}

export async function apiCreateMetaReview(
  token: string,
  reviewId: string,
  payload: MetaReviewCreate
): Promise<MetaReviewPublic> {
  return apiFetch<MetaReviewPublic>(
    `/reviews/${reviewId}/meta`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    token
  );
}

export async function apiGetMyGrade(token: string, assignmentId: string): Promise<GradeMe> {
  return apiFetch<GradeMe>(`/assignments/${assignmentId}/grades/me`, {}, token);
}

export async function apiGetReviewerSkill(token: string): Promise<ReviewerSkill> {
  return apiFetch<ReviewerSkill>(`/users/me/reviewer-skill`, {}, token);
}

export async function apiTeacherListSubmissions(
  token: string,
  assignmentId: string
): Promise<SubmissionTeacherPublic[]> {
  return apiFetch<SubmissionTeacherPublic[]>(`/assignments/${assignmentId}/submissions`, {}, token);
}

export async function apiTeacherGradeSubmission(
  token: string,
  submissionId: string,
  payload: TeacherGradeSubmit
): Promise<SubmissionPublic> {
  return apiFetch<SubmissionPublic>(
    `/submissions/${submissionId}/teacher-grade`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    token
  );
}

export async function apiDebugValidateTitleDeadline(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    "/debug/validate",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
}
