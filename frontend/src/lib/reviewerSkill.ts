export const REVIEWER_SKILL_AXES = [
  { key: "logic", label: "論理性" },
  { key: "specificity", label: "具体性" },
  { key: "structure", label: "構成" },
  { key: "evidence", label: "根拠" },
] as const;

export type ReviewerSkillKey = (typeof REVIEWER_SKILL_AXES)[number]["key"];

export const FIXED_RUBRIC_TEMPLATE = [
  {
    key: "logic",
    name: "論理性",
    description: "主張と根拠のつながりが明確か",
    max_score: 5,
    order_index: 0,
  },
  {
    key: "specificity",
    name: "具体性",
    description: "具体例や数値が示されているか",
    max_score: 5,
    order_index: 1,
  },
  {
    key: "structure",
    name: "構成",
    description: "構成や流れが分かりやすいか",
    max_score: 5,
    order_index: 2,
  },
  {
    key: "evidence",
    name: "根拠",
    description: "根拠や引用が妥当か",
    max_score: 5,
    order_index: 3,
  },
] as const;
