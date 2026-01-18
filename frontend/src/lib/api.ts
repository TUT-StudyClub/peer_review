import type {
  AssignmentCreate,
  AssignmentPublic,
  GradeMe,
  MetaReviewCreate,
  MetaReviewPublic,
  RephraseResponse,
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
  TeacherReviewPublic,
  TAReviewRequestPublic,
  TAReviewRequestStatus,
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

type StringifyOptions = {
  maxDepth?: number;
  maxKeys?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  maxOutputLength?: number;
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…(truncated ${text.length - max} chars)`;
}

function normalizeForJson(
  value: unknown,
  params: {
    depth: number;
    options: Required<Omit<StringifyOptions, "maxOutputLength">>;
    seen: WeakSet<object>;
  }
): unknown {
  const { depth, options, seen } = params;
  if (depth >= options.maxDepth) return "[MaxDepth]";

  if (value === null) return null;

  if (typeof value === "string") return truncate(value, options.maxStringLength);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return "[undefined]";
  if (typeof value === "function") return "[function]";
  if (typeof value === "symbol") return value.toString();

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ? truncate(value.stack, options.maxStringLength) : undefined,
    };
  }

  if (!value || typeof value !== "object") return String(value);

  const obj = value as Record<string, unknown>;
  if (seen.has(obj)) return "[Circular]";
  seen.add(obj);

  if (Array.isArray(obj)) {
    const sliced = obj.slice(0, options.maxArrayLength);
    const mapped = sliced.map((item) =>
      normalizeForJson(item, { depth: depth + 1, options, seen })
    );
    if (obj.length > sliced.length) {
      mapped.push(`[+${obj.length - sliced.length} more items]`);
    }
    return mapped;
  }

  if (obj instanceof Map) {
    const entries = Array.from(obj.entries()).slice(0, options.maxArrayLength);
    return {
      "[Map]": entries.map(([k, v]) => [
        normalizeForJson(k, { depth: depth + 1, options, seen }),
        normalizeForJson(v, { depth: depth + 1, options, seen }),
      ]),
    };
  }

  if (obj instanceof Set) {
    const items = Array.from(obj.values()).slice(0, options.maxArrayLength);
    return {
      "[Set]": items.map((v) => normalizeForJson(v, { depth: depth + 1, options, seen })),
    };
  }

  const keys = Object.keys(obj);
  const slicedKeys = keys.slice(0, options.maxKeys);
  const out: Record<string, unknown> = {};
  for (const key of slicedKeys) {
    out[key] = normalizeForJson(obj[key], { depth: depth + 1, options, seen });
  }
  if (keys.length > slicedKeys.length) {
    out["…"] = `[+${keys.length - slicedKeys.length} more keys]`;
  }
  return out;
}

export function stringifyForDisplay(value: unknown, options: StringifyOptions = {}): string {
  if (typeof value === "string") return value;

  const normalized = normalizeForJson(value, {
    depth: 0,
    options: {
      maxDepth: options.maxDepth ?? 6,
      maxKeys: options.maxKeys ?? 50,
      maxArrayLength: options.maxArrayLength ?? 50,
      maxStringLength: options.maxStringLength ?? 2000,
    },
    seen: new WeakSet<object>(),
  });

  let text: string;
  try {
    text = JSON.stringify(normalized, null, 2);
  } catch (err) {
    text = normalized ? String(normalized) : "Unknown error";
    if (err instanceof Error) {
      text = `${text}\n(stringify failed: ${err.message})`;
    }
  }

  return truncate(text, options.maxOutputLength ?? 8000);
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string") return err.detail;
    if (err.detail == null) return err.message;

    if (typeof err.detail === "object" && !Array.isArray(err.detail)) {
      try {
        const json = JSON.stringify(err.detail, null, 2);
        if (json) return `${err.message}\n${json}`;
      } catch {
        // fall through to generic formatter
      }
    }

    const detailText = stringifyForDisplay(err.detail);
    if (!detailText || detailText === err.message) return err.message;

    return `${err.message}\n${detailText}`;
  }
  if (err instanceof Error) return err.message;
  return stringifyForDisplay(err);
}

type FastApiValidationErrorItem = {
  loc?: unknown;
  msg?: unknown;
};

function formatLoc(loc: unknown): string | null {
  if (Array.isArray(loc) && loc.length) return String(loc[loc.length - 1]);
  if (typeof loc === "string" && loc.trim()) return loc;
  return null;
}

function collectErrorMessages(detail: unknown, depth = 0): string[] {
  if (depth > 5 || detail == null) return [];

  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(detail)) {
    return detail.flatMap((item) => collectErrorMessages(item, depth + 1));
  }

  if (typeof detail !== "object") return [];

  const obj = detail as Record<string, unknown>;
  const messages: string[] = [];
  const field = formatLoc(obj.loc ?? obj.path ?? obj.field);

  for (const key of ["msg", "message", "reason"] as const) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      messages.push(field ? `${field}: ${value}` : value);
    }
  }

  if ("errors" in obj) {
    messages.push(...collectErrorMessages((obj as { errors: unknown }).errors, depth + 1));
  }

  for (const [key, value] of Object.entries(obj)) {
    if (["loc", "path", "field", "msg", "message", "reason", "errors"].includes(key)) continue;
    if (typeof value === "string" && value.trim()) {
      messages.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      const nested = collectErrorMessages(value, depth + 1);
      messages.push(...nested.map((msg) => (key ? `${key}: ${msg}` : msg)));
    }
  }

  return messages;
}

function formatFastApiValidationErrors(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;

  const lines = detail
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const { loc, msg } = item as FastApiValidationErrorItem;
      const field = formatLoc(loc) ?? "body";
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

       const messages = new Set<string>();
      const validationMessage = formatFastApiValidationErrors(detail);
      if (validationMessage) {
        for (const line of validationMessage.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) messages.add(trimmed);
        }
      }

      for (const msg of collectErrorMessages(detail)) {
        const trimmed = msg.trim();
        if (trimmed) messages.add(trimmed);
      }

      if (messages.size) {
        return { message: Array.from(messages).join("\n"), detail };
      }

      return { message: stringifyForDisplay(detail), detail };
    }
    return { message: stringifyForDisplay(data), detail: data };
  }
  const text = await res.text().catch(() => "");
  return { message: text || "Request failed", detail: text };
}

async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    const url = `${API_BASE_URL}/api${path}`;
    res = await fetch(url, { ...init, headers });
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
  const res = await fetch(`${API_BASE_URL}/api/submissions/${submissionId}/file`, {
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

export async function apiListMyTARequests(
  token: string,
  status?: TAReviewRequestStatus
): Promise<TAReviewRequestPublic[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<TAReviewRequestPublic[]>(`/ta-requests/me${query}`, {}, token);
}

export async function apiAcceptTARequest(token: string, requestId: string): Promise<TAReviewRequestPublic> {
  return apiFetch<TAReviewRequestPublic>(`/ta-requests/${requestId}/accept`, { method: "POST" }, token);
}

export async function apiDeclineTARequest(token: string, requestId: string): Promise<TAReviewRequestPublic> {
  return apiFetch<TAReviewRequestPublic>(`/ta-requests/${requestId}/decline`, { method: "POST" }, token);
}

export async function apiListEligibleTAs(token: string): Promise<UserPublic[]> {
  return apiFetch<UserPublic[]>(`/ta/eligible`, {}, token);
}

export async function apiCreateTARequest(
  token: string,
  submissionId: string,
  taUserId: string
): Promise<TAReviewRequestPublic> {
  return apiFetch<TAReviewRequestPublic>(
    `/submissions/${submissionId}/ta-requests`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ta_user_id: taUserId }),
    },
    token
  );
}

export async function apiListTARequestsForAssignment(
  token: string,
  assignmentId: string
): Promise<TAReviewRequestPublic[]> {
  return apiFetch<TAReviewRequestPublic[]>(`/assignments/${assignmentId}/ta-requests`, {}, token);
}

export async function apiParaphrase(token: string, text: string): Promise<RephraseResponse> {
  return apiFetch<RephraseResponse>(
    "/reviews/paraphrase",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) },
    token
  );
}

export async function apiListReviewsForSubmission(
  token: string,
  submissionId: string
): Promise<TeacherReviewPublic[]> {
  return apiFetch<TeacherReviewPublic[]>(`/submissions/${submissionId}/reviews`, {}, token);
}
