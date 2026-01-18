export type UserRole = "student" | "teacher";

export type UserCreate = {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
};

export type UserPublic = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  credits: number;
  rank: string;
  title: string;
  is_ta: boolean;
  created_at: string;
};

export type RankingPeriod = "total" | "monthly" | "weekly";

export type UserRankingEntry = {
  id: string;
  name: string;
  credits: number;
  rank: string;
  title: string;
  is_ta: boolean;
  period_credits?: number;
};

export type TAReviewRequestStatus = "offered" | "accepted" | "declined";

export type TAReviewRequestPublic = {
  id: string;
  assignment_id: string;
  submission_id: string;
  teacher_id: string;
  ta_id: string;
  status: TAReviewRequestStatus;
  review_assignment_id: string | null;
  created_at: string;
  responded_at: string | null;
};

export type AssignmentPublic = {
  id: string;
  course_id: string | null;
  title: string;
  description?: string | null;
  target_reviews_per_submission: number;
  created_at: string;
};

export type AssignmentCreate = {
  course_id: string;
  title: string;
  description?: string | null;
  target_reviews_per_submission: number;
};

export type CoursePublic = {
  id: string;
  title: string;
  description?: string | null;
  teacher_id: string;
  created_at: string;
  teacher_name?: string | null;
  is_enrolled?: boolean | null;
  student_count?: number | null;
};

export type CourseCreate = {
  title: string;
  description?: string | null;
};

export type CourseEnrollmentPublic = {
  id: string;
  course_id: string;
  user_id: string;
  created_at: string;
};

export type RubricCriterionPublic = {
  id: string;
  assignment_id?: string;
  name: string;
  description?: string | null;
  max_score: number;
  order_index: number;
};

export type RubricCriterionCreate = {
  name: string;
  description?: string | null;
  max_score: number;
  order_index: number;
};

export type SubmissionFileType = "pdf" | "markdown";

export type SubmissionPublic = {
  id: string;
  assignment_id: string;
  file_type: SubmissionFileType;
  original_filename: string;
  teacher_total_score: number | null;
  teacher_feedback: string | null;
  created_at: string;
};

export type SubmissionTeacherPublic = {
  id: string;
  assignment_id: string;
  author_id: string;
  file_type: SubmissionFileType;
  original_filename: string;
  teacher_total_score: number | null;
  created_at: string;
};

export type ReviewAssignmentTask = {
  review_assignment_id: string;
  submission_id: string;
  author_alias: string;
  file_type: SubmissionFileType;
  rubric: RubricCriterionPublic[];
};

export type RubricScore = {
  criterion_id: string;
  score: number;
};

export type ReviewSubmit = {
  comment: string;
  rubric_scores: RubricScore[];
};

export type ReviewPublic = {
  id: string;
  review_assignment_id: string;
  comment: string;
  created_at: string;
  ai_quality_score: number | null;
  ai_quality_reason: string | null;
  ai_toxic: boolean | null;
  ai_toxic_reason: string | null;
  ai_logic: number | null;
  ai_specificity: number | null;
  ai_empathy: number | null;
  ai_insight: number | null;
  ai_comment_alignment_score: number | null;
  ai_comment_alignment_reason: string | null;
  rubric_alignment_score: number | null;
  total_alignment_score: number | null;
  credit_awarded: number | null;
};

export type MetaReviewPublic = {
  id: string;
  review_id: string;
  rater_id: string;
  helpfulness: number;
  comment: string | null;
  created_at: string;
};

export type ReviewRubricScorePublic = {
  criterion_id: string;
  score: number;
};

export type ReviewReceived = {
  id: string;
  reviewer_alias: string;
  comment: string;
  created_at: string;
  rubric_scores: ReviewRubricScorePublic[];
  meta_review: MetaReviewPublic | null;
  ai_quality_score: number | null;
  ai_quality_reason: string | null;
  ai_comment_alignment_score: number | null;
  ai_comment_alignment_reason: string | null;
  rubric_alignment_score: number | null;
  total_alignment_score: number | null;
  credit_awarded: number | null;
};

export type TeacherReviewPublic = {
  id: string;
  reviewer_alias: string;
  is_ta: boolean;
  comment: string;
  created_at: string;
  rubric_scores: ReviewRubricScorePublic[];
  meta_review: MetaReviewPublic | null;
  ai_quality_score: number | null;
  ai_quality_reason: string | null;
  ai_comment_alignment_score: number | null;
  ai_comment_alignment_reason: string | null;
  rubric_alignment_score: number | null;
  total_alignment_score: number | null;
  credit_awarded: number | null;
};

export type RephraseResponse = {
  original: string;
  rephrased: string;
  notice?: string | null;
};

export type MetaReviewCreate = {
  helpfulness: number;
  comment?: string | null;
};

export type GradeMe = {
  assignment_score: number | null;
  review_contribution: number;
  final_score: number | null;
  breakdown: Record<string, unknown>;
};

export type ReviewerSkill = {
  logic: number;
  specificity: number;
  structure: number;
  evidence: number;
  overall: number;
};

export type TeacherGradeSubmit = {
  teacher_total_score: number;
  teacher_feedback?: string | null;
  rubric_scores: RubricScore[];
};
