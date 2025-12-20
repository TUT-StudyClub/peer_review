"""PDF抽出機能の統合テストスクリプト（基本+詳細）"""

import logging
from pathlib import Path

from app.services.pdf import PDFExtractionService

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def test_pdf_extraction():
    """PDF抽出の統合テスト実行"""
    logging.info("PDF抽出機能 - 統合テスト開始")

    service = PDFExtractionService()

    # テストPDFのパス（tests/samples 配下）
    test_pdf = Path(__file__).resolve().parent / "samples" / "test_pdf_broken_style.pdf"

    if not test_pdf.exists():
        logging.error("テストPDFが見つかりません: %s", test_pdf)
        logging.error("指定のPDFを配置してから再実行してください。")
        return

    logging.info("テストファイル: %s", test_pdf.name)
    logging.info("パス: %s", test_pdf)

    try:
        # テスト1: PDFメタデータ情報
        logging.info("[1] PDFメタデータ情報")
        info = service.get_pdf_info(test_pdf)

        logging.info("✓ ページ数: %s", info["page_count"])

        # テスト2: 画像情報の確認（サービス経由）
        logging.info("[2] 画像情報")
        images_by_page = service.extract_images_by_page(test_pdf)
        total_images = sum(len(v) for v in images_by_page.values())
        logging.info("✓ 合計画像数: %s 個", total_images)

        # テスト3: テーブル情報の確認（サービス経由）
        logging.info("[3] テーブル情報")
        tables_by_page = service.extract_tables_by_page(test_pdf)
        total_tables = sum(len(v) for v in tables_by_page.values())
        logging.info("✓ 合計テーブル数: %s 個", total_tables)

        # テスト4: 全ページテキスト抽出
        logging.info("[4] 全ページテキスト抽出")
        full_text = service.extract_text(test_pdf)
        text_length = len(full_text)
        logging.info("✓ 抽出成功（文字数: %,d）", text_length)

        # テスト5: ページごとのテキスト抽出詳細
        logging.info("[5] ページごとのテキスト抽出概要")
        pages = service.extract_text_by_page(test_pdf)
 
        page_lengths = {page_num: len(text) for page_num, text in pages.items()}
        logging.info("✓ ページごと抽出成功: %s", page_lengths)

        logging.info(
            "LLM準備完了: pages=%s, text=%s chars, images=%s, tables=%s",
            info["page_count"],
            text_length,
            total_images,
            total_tables,
        )

    except Exception as e:  # 手動統合テストのため例外は標準出力へ
        logging.exception("エラーが発生しました: %s", e)


if __name__ == "__main__":
    test_pdf_extraction()
