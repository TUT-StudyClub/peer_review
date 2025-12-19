"""PDF処理サービス"""

from pathlib import Path

import pdfplumber


class PDFExtractionService:
    """PDFからテキストを抽出するサービス"""

    @staticmethod
    def extract_text(pdf_path: str | Path) -> str:
        """
        PDFファイルからテキストを抽出する

        Args:
            pdf_path: PDFファイルのパス

        Returns:
            抽出されたテキスト

        Raises:
            FileNotFoundError: PDFファイルが見つからない場合
            ValueError: PDFファイルが無効な場合
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDFファイルが見つかりません: {pdf_path}")

        if not pdf_path.suffix.lower() == ".pdf":
            raise ValueError(f"ファイルはPDF形式である必要があります: {pdf_path}")

        extracted_text = []

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    if text:
                        extracted_text.append(f"--- ページ {page_num} ---\n{text}")
        except Exception as e:
            raise ValueError(f"PDFの処理に失敗しました: {str(e)}")

        return "\n\n".join(extracted_text)

    @staticmethod
    def extract_text_by_page(pdf_path: str | Path) -> dict[int, str]:
        """
        PDFからページごとにテキストを抽出する

        Args:
            pdf_path: PDFファイルのパス

        Returns:
            ページ番号をキー、テキストを値とした辞書

        Raises:
            FileNotFoundError: PDFファイルが見つからない場合
            ValueError: PDFファイルが無効な場合
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDFファイルが見つかりません: {pdf_path}")

        if not pdf_path.suffix.lower() == ".pdf":
            raise ValueError(f"ファイルはPDF形式である必要があります: {pdf_path}")

        pages_text = {}

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    pages_text[page_num] = text or ""
        except Exception as e:
            raise ValueError(f"PDFの処理に失敗しました: {str(e)}")

        return pages_text

    @staticmethod
    def get_pdf_info(pdf_path: str | Path) -> dict:
        """
        PDFファイルの情報を取得する

        Args:
            pdf_path: PDFファイルのパス

        Returns:
            ページ数、作成者などのメタデータ

        Raises:
            FileNotFoundError: PDFファイルが見つからない場合
            ValueError: PDFファイルが無効な場合
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDFファイルが見つかりません: {pdf_path}")

        if not pdf_path.suffix.lower() == ".pdf":
            raise ValueError(f"ファイルはPDF形式である必要があります: {pdf_path}")

        try:
            with pdfplumber.open(pdf_path) as pdf:
                return {
                    "page_count": len(pdf.pages),
                    "metadata": pdf.metadata,
                }
        except Exception as e:
            raise ValueError(f"PDFの処理に失敗しました: {str(e)}")
