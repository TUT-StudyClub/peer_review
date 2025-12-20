"""PDF→Markdown詳細テスト（AI連携ダイジェスト付き）

使い方:
  cd backend
  uv run python test_pdf_detailed.py
"""
from pathlib import Path

from app.services.ai import analyze_review
from app.services.pdf import PDFExtractionService


def test_pdf_detailed() -> None:
    print("=" * 70)
    print("PDF→Markdown 詳細テスト")
    print("=" * 70)

    # サンプルPDFの場所（既存の extraction テストと同じパスを利用）
    test_pdf = Path(__file__).parent / "tests" / "samples" / "test_pdf_broken_style.pdf"

    print(f"探しているファイル: {test_pdf}")
    print(f"ファイル存在確認: {test_pdf.exists()}")
    if not test_pdf.exists():
        print(f"\n✗ テストPDFが見つかりません: {test_pdf}")
        print("  backend/tests/samples/ にPDFを配置してから再実行してください。")
        return

    # Markdown抽出
    md = PDFExtractionService.extract_markdown(test_pdf)
    length = len(md)
    lines = md.count("\n") + 1
    print("\n--- Markdown 抽出結果 ---")
    print(f"文字数: {length:,}")
    print(f"行数: {lines:,}")
    print("先頭プレビュー(最大500文字):")
    print("-" * 70)
    print(md[:500])
    print("-" * 70)

    # AI連携（openai未設定でもヒューリスティックで動作）
    print("\n--- AI ダイジェスト（レビュー例に対する評価）---")
    dummy_review = "提出物の序盤に目的が不明瞭な箇所があります。例えば導入で評価軸を提示すると、読む側が迷いません。"
    ai = analyze_review(submission_text=md, review_text=dummy_review)
    print(
        f"quality={ai.quality_score}, toxic={ai.toxic}, "
        f"logic={ai.logic}, specificity={ai.specificity}, empathy={ai.empathy}, insight={ai.insight}"
    )
    print(f"reason={ai.quality_reason}")
    if ai.toxic:
        print(f"toxic_reason={ai.toxic_reason}")

    print("\n✅ 詳細テスト完了")


if __name__ == "__main__":
    test_pdf_detailed()
