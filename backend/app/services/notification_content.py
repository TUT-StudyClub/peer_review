"""通知コンテンツ生成サービス"""

from typing import Any

from app.schemas.notification import NotificationType


def generate_notification_content(
    notification_type: NotificationType,
    context: dict[str, Any],
) -> tuple[str, str, str]:
    """
    通知タイプとコンテキストデータから (Title, Body, URL) を生成する

    Args:
        notification_type: 通知タイプ
        context: 通知に必要なコンテキストデータ

    Returns:
        (title, body, url) のタプル
    """
    match notification_type:
        case NotificationType.REVIEW_RECEIVED:
            assignment_title = context.get("assignment_title", "課題")
            assignment_id = context.get("assignment_id")
            return (
                "レビューが届きました！",
                f"{assignment_title}に対してフィードバックがあります。",
                f"/assignments/{assignment_id}" if assignment_id else "/assignments",
            )

        case NotificationType.SUBMISSION_DUE:
            days = context.get("days_left", 1)
            assignment_id = context.get("assignment_id")
            return (
                "課題の締め切りが近づいています",
                f"あと{days}日で提出締め切りです。準備はできていますか？",
                f"/assignments/{assignment_id}" if assignment_id else "/assignments",
            )

        case NotificationType.SYSTEM_INFO:
            return (
                context.get("title", "お知らせ"),
                context.get("body", "重要なお知らせがあります。"),
                context.get("url", "/"),
            )

        case _:
            return ("通知", "新しい通知があります", "/")
