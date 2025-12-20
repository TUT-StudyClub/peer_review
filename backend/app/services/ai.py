from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass(frozen=True)
class ReviewAIResult:
    quality_score: int
    quality_reason: str
    toxic: bool
    toxic_reason: str
    logic: int
    specificity: int
    empathy: int
    insight: int


_BANNED_PATTERNS = [
    r"死ね",
    r"バカ",
    r"馬鹿",
    r"無能",
    r"消えろ",
    r"意味不明",
]


class FeatureDisabledError(Exception):
    """OpenAIが設定されていないか無効になっているときに発生"""


class ModerationError(Exception):
    """モデレーション比較に失敗した場合に発生（例：出力がより有害な場合）"""


class OpenAIRequestError(Exception):
    """OpenAIへのHTTPリクエストで失敗した場合に発生"""

    def __init__(self, reason: str, status_code: int | None = None):
        self.reason = reason
        self.status_code = status_code
        super().__init__(reason)


class OpenAIResponseParseError(Exception):
    """OpenAIのレスポンスJSONが想定通りでない場合に発生"""


class OpenAIEmptyChoiceError(Exception):
    """OpenAIレスポンスにchoicesが存在しない場合に発生"""


class OpenAIUnavailableError(Exception):
    """OpenAI側のレートリミット/停止などで一時的に使えない場合に発生"""

    def __init__(self, status_code: int, detail: str | None = None):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail or "OpenAI unavailable")


def detect_toxic_hits(text: str) -> list[str]:
    hits = [p for p in _BANNED_PATTERNS if re.search(p, text)]
    return hits


def _openai_polish(text: str) -> dict:
    if not settings.openai_api_key or not settings.enable_openai:
        raise FeatureDisabledError("OpenAI not configured")

    system = "You are an assistant that rewrites reviews to be polite, constructive, and helpful. Return JSON only."
    user = {
        "text": text,
        "instructions": [
            "Rewrite to be polite and constructive.",
            "Keep original meaning; do not add new facts.",
            "Return strict JSON: {\"polished_text\": \"...\", \"notes\": \"...\"}.",
        ],
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                    ],
                    "temperature": 0.0,
                    "max_tokens": 1024,
                },
            )
            try:
                res.raise_for_status()
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                if status in (429, 503):
                    raise OpenAIUnavailableError(status_code=status, detail=e.response.text) from e
                raise OpenAIRequestError("http_status_error", status_code=status) from e
            data = res.json()
    except httpx.TimeoutException as e:
        raise OpenAIRequestError("timeout") from e
    except httpx.HTTPError as e:
        raise OpenAIRequestError("http_error") from e

    try:
        choices = data["choices"]
        if not choices:
            raise OpenAIEmptyChoiceError("No choices returned")
        content = choices[0]["message"]["content"]
    except (KeyError, TypeError, IndexError) as e:
        raise OpenAIResponseParseError("invalid_structure") from e

    try:
        return json.loads(content)  # expect dict with polished_text/notes
    except Exception as e:
        raise OpenAIResponseParseError("json_decode_failed") from e


def polish_review(text: str) -> tuple[str, str | None]:
    if not settings.openai_api_key:
        raise FeatureDisabledError("OpenAI API key not set")
    elif not settings.enable_openai:
        raise FeatureDisabledError("OpenAI feature is disabled")

    result = _openai_polish(text)
    if result is None:
        raise FeatureDisabledError("OpenAI API request failed")

    polished = str(result.get("polished_text", "")).strip()
    notes = result.get("notes")

    input_hits = detect_toxic_hits(text)
    output_hits = detect_toxic_hits(polished)

    if len(output_hits) > len(input_hits):
        # Reject if output is *more* toxic than input
        raise ModerationError({"input_hits": input_hits, "output_hits": output_hits})

    return polished, notes


def _clamp_1_5(value: int) -> int:
    return max(1, min(5, int(value)))


def _heuristic_analyze(review_text: str) -> ReviewAIResult:
    text = review_text.strip()
    toxic_hits = [p for p in _BANNED_PATTERNS if re.search(p, text)]
    toxic = len(toxic_hits) > 0

    length = len(text)
    has_examples = any(k in text for k in ["例えば", "例:", "例：", "たとえば"])
    has_action = any(k in text for k in ["改善", "提案", "直す", "修正", "追加", "削る", "整理"])
    has_reason = any(k in text for k in ["なぜなら", "理由", "根拠", "because", "なので"])
    polite = any(k in text for k in ["と思います", "〜すると良い", "良いと思います", "おすすめ", "いかがでしょう"])

    base = 1
    if length >= 50:
        base = 2
    if length >= 200:
        base = 3
    if length >= 500:
        base = 4
    if length >= 900:
        base = 5

    bonus = int(has_examples) + int(has_action) + int(has_reason)
    quality = _clamp_1_5(base + (1 if bonus >= 2 else 0))

    logic = _clamp_1_5(2 + int(has_reason) + int("論理" in text))
    specificity = _clamp_1_5(2 + int(has_examples) + int(length >= 300))
    empathy = _clamp_1_5(2 + int(polite) - int(toxic))
    insight = _clamp_1_5(2 + int("別の視点" in text) + int("代わりに" in text))

    if toxic:
        return ReviewAIResult(
            quality_score=quality,
            quality_reason="（簡易判定）内容はありますが、攻撃的表現が含まれる可能性があります。",
            toxic=True,
            toxic_reason=f"（簡易判定）禁止語/表現の可能性: {', '.join(toxic_hits)}",
            logic=logic,
            specificity=specificity,
            empathy=empathy,
            insight=insight,
        )

    reason = "（簡易判定）"
    if quality >= 4:
        reason += "具体的な改善点が含まれており良いです。"
    elif quality == 3:
        reason += "概ね良いですが、もう少し具体例があるとさらに良くなります。"
    else:
        reason += "短すぎる/抽象的なので、どこをどう直すかを具体的に書くと良いです。"

    return ReviewAIResult(
        quality_score=quality,
        quality_reason=reason,
        toxic=False,
        toxic_reason="（簡易判定）問題となる強い攻撃表現は見つかりませんでした。",
        logic=logic,
        specificity=specificity,
        empathy=empathy,
        insight=insight,
    )


def _openai_analyze(submission_text: str, review_text: str) -> ReviewAIResult | None:
    if not settings.openai_api_key:
        return None

    system = (
        "You are an assistant that evaluates peer-review quality and toxicity. "
        "Return JSON only."
    )
    user = {
        "submission": submission_text,
        "review": review_text,
        "instructions": [
            "Rate review quality from 1 to 5 and explain why.",
            "Detect if the review contains toxic/abusive/discriminatory language (true/false) and explain.",
            "Also rate 4 axes from 1 to 5: logic, specificity, empathy, insight.",
            "Return strict JSON with keys: quality_score, quality_reason, toxic, toxic_reason, logic, specificity, empathy, insight.",
        ],
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                    ],
                    "temperature": 0.0,
                },
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            return ReviewAIResult(
                quality_score=_clamp_1_5(int(data["quality_score"])),
                quality_reason=str(data["quality_reason"]),
                toxic=bool(data["toxic"]),
                toxic_reason=str(data["toxic_reason"]),
                logic=_clamp_1_5(int(data["logic"])),
                specificity=_clamp_1_5(int(data["specificity"])),
                empathy=_clamp_1_5(int(data["empathy"])),
                insight=_clamp_1_5(int(data["insight"])),
            )
    except Exception:
        return None


def analyze_review(*, submission_text: str, review_text: str) -> ReviewAIResult:
    openai_result = _openai_analyze(submission_text=submission_text, review_text=review_text)
    if openai_result is not None:
        return openai_result
    return _heuristic_analyze(review_text=review_text)

