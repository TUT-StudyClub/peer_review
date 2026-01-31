"""通知コンテンツ生成サービス"""

from app.schemas.notification import NotificationType

type NotificationContext = dict[str, str | int | None]


def generate_notification_content(
    notification_type: NotificationType,
    context: NotificationContext,
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
                f"あと{days}日で提出締め切りです。",
                f"/assignments/{assignment_id}" if assignment_id else "/assignments",
            )

        case NotificationType.SYSTEM_INFO:
            title = context.get("title")
            body = context.get("body")
            url = context.get("url")
            return (
                str(title) if title else "お知らせ",
                str(body) if body else "重要なお知らせがあります。",
                str(url) if url else "/",
            )

        case _:
            return ("通知", "新しい通知があります", "/")
