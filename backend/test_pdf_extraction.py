"""移行済み: tests/integration/test_pdf_extraction.py を使用してください。

このファイルは互換用の薄いラッパーです。将来的に削除予定です。
"""

from tests.integration.test_pdf_extraction import test_pdf_extraction


if __name__ == "__main__":
    print("[DEPRECATION] backend/test_pdf_extraction.py は tests/integration/test_pdf_extraction.py に移動しました。")
    test_pdf_extraction()
