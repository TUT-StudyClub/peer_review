"""PDF抽出機能の統合テストスクリプト（基本+詳細）"""

from pathlib import Path

from app.services.pdf import PDFExtractionService


def test_pdf_extraction():
    """PDF抽出の統合テスト実行"""
    print("=" * 70)
    print("PDF抽出機能 - 統合テスト（基本+詳細）")
    print("=" * 70)

    service = PDFExtractionService()

    # テストPDFのパス（tests/samples 配下）
    test_pdf = Path(__file__).resolve().parent / "samples" / "test_pdf_broken_style.pdf"

    if not test_pdf.exists():
        print(f"\n✗ テストPDFが見つかりません: {test_pdf}")
        print("  指定のPDFを配置してから再実行してください。")
        return

    print(f"\n📁 テストファイル: {test_pdf.name}")
    print(f"📍 パス: {test_pdf}\n")

    try:
        # テスト1: PDFメタデータ情報
        print("=" * 70)
        print("1️⃣ PDFメタデータ情報")
        print("=" * 70)
        info = service.get_pdf_info(test_pdf)

        print(f"✓ ページ数: {info['page_count']}")
        print()

        # テスト2: 画像情報の確認（サービス経由）
        print("=" * 70)
        print("2️⃣ 画像情報 (ページごとの画像数と座標)")
        print("=" * 70)
        images_by_page = service.extract_images_by_page(test_pdf)
        total_images = sum(len(v) for v in images_by_page.values())
        for page_num in sorted(images_by_page.keys()):
            imgs = images_by_page[page_num]
            print(f"ページ {page_num}: 画像 {len(imgs)} 個")
        print(f"✓ 合計画像数: {total_images} 個\n")

        # テスト3: テーブル情報の確認（サービス経由）
        print("=" * 70)
        print("3️⃣ テーブル情報 (ページごとの検出数と全データ)")
        print("=" * 70)
        tables_by_page = service.extract_tables_by_page(test_pdf)
        total_tables = sum(len(v) for v in tables_by_page.values())
        for page_num in sorted(tables_by_page.keys()):
            tables = tables_by_page[page_num]
            print(f"ページ {page_num}: テーブル {len(tables)} 個")
            for idx, table in enumerate(tables, 1):
                print(f"  [{idx}] 全行データ ({len(table)} 行):")
                for row_idx, row in enumerate(table, 1):
                    row_text = " | ".join(cell or "" for cell in row)
                    print(f"     行{row_idx}: {row_text}")
        print(f"✓ 合計テーブル数: {total_tables} 個\n")

        # テスト4: 全ページテキスト抽出
        print("=" * 70)
        print("4️⃣ 全ページテキスト抽出")
        print("=" * 70)
        full_text = service.extract_text(test_pdf)
        text_length = len(full_text)
        line_count = full_text.count('\n')

        print("抽出テキスト統計:")
        print(f"  総文字数: {text_length:,}")
        print(f"  改行数: {line_count}")
        print(f"  平均1行の長さ: {text_length / (line_count + 1):.1f} 文字\n")

        print("抽出内容 (全文):")
        print("-" * 70)
        print(full_text)
        print("-" * 70)
        print(f"✓ 抽出成功（文字数: {text_length:,})\n")

        # テスト5: ページごとのテキスト抽出詳細
        print("=" * 70)
        print("5️⃣ ページごとのテキスト抽出詳細")
        print("=" * 70)
        pages = service.extract_text_by_page(test_pdf)

        for page_num in sorted(pages.keys()):
            text = pages[page_num]
            print(f"\n📄 ページ {page_num}:")
            print(f"   文字数: {len(text):,}")
            print(f"   改行数: {text.count('\\n')}")

            # ページ全文を表示
            if text.strip():
                lines = text.split('\n')
                non_empty_lines = [line for line in lines if line.strip()]
                print(f"   非空行数: {len(non_empty_lines)}")
                print("   テキスト全文:")
                print("-" * 70)
                print(text)
                print("-" * 70)
            else:
                print("   内容: (テキストなし)")
        print("\n✓ ページごと抽出成功\n")

        # 完了サマリー
        print("=" * 70)
        print("✅ すべてのテストが完了しました！")
        print("=" * 70)

        # LLM処理への準備状況
        print("\n🤖 LLM処理への準備:")
        print("  ✓ PDF読み込み: OK")
        print(f"  ✓ テキスト抽出: OK (合計 {text_length:,} 文字)")
        print(f"  ✓ ページ分割: OK ({info['page_count']} ページ)")
        print("  ✓ メタデータ取得: OK")
        print(f"  ✓ 画像検出: OK ({total_images} 個)")
        print(f"  ✓ テーブル検出: OK ({total_tables} 個)")
        print("\nLLMによるスコア化処理に進む準備ができました！")

    except Exception as e:  # 手動統合テストのため例外は標準出力へ
        print(f"\n✗ エラーが発生しました: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_pdf_extraction()
