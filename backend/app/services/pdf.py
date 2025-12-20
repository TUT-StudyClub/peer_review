from io import StringIO
from pathlib import Path
from typing import Iterator

import pdfplumber
from pdfminer.pdfparser import PDFSyntaxError


class PDFExtractionService:
    """PDFからテキストを抽出するサービス"""
    @staticmethod
    def _has_pdf_signature(pdf_path: Path) -> bool:
        """ファイル先頭のマジックバイトでPDF実体を確認する。

        %PDF- で始まることを確認。IOエラー時は False を返す。
        """
        try:
            with pdf_path.open("rb") as f:
                header = f.read(5)
            return header.startswith(b"%PDF-")
        except (OSError, IOError) as e:
            return False
        except Exception as e:
            # 予期しないエラーもFalseとして扱う
            return False

    @staticmethod
    def _validate_pdf_path(pdf_path: str | Path) -> Path:
        """共通のPDFパス検証: 存在・拡張子・シグネチャを確認してPathを返す。
        
        例外処理:
            FileNotFoundError: ファイルが存在しない場合
            ValueError: 拡張子がPDFでない場合
            ValueError: PDFシグネチャが不正な場合
            OSError: ファイルアクセス権限エラー
        """
        try:
            p = Path(pdf_path)
        except (TypeError, ValueError) as e:
            raise ValueError(f"不正なパス形式です: {pdf_path}") from e
        
        # ファイル存在確認
        if not p.exists():
            raise FileNotFoundError(f"PDFファイルが見つかりません: {p}")
        
        # ファイルアクセス可能か確認
        try:
            if not p.is_file():
                raise ValueError(f"パスはファイルである必要があります: {p}")
        except OSError as e:
            raise OSError(f"ファイルアクセスエラー: {p}") from e
        
        # 拡張子確認
        if p.suffix.lower() != ".pdf":
            raise ValueError(f"ファイルはPDF形式である必要があります: {p}")
        
        # PDFシグネチャ確認
        if not PDFExtractionService._has_pdf_signature(p):
            raise ValueError(f"PDFシグネチャが不正です。有効なPDFファイルではない可能性があります: {p}")
        
        return p
    @staticmethod
    def extract_text(
        pdf_path: str | Path,
        *,
        max_pages: int | None = None,
        max_chars: int | None = None,
    ) -> str:
        """
        PDFファイルからテキストを抽出する（シンプルな一括文字列版）。

        注意: 大きなPDFではメモリ使用量が増えます。大量ページ/長文の場合は
        `extract_text_iter()` の使用や `max_pages`/`max_chars` の上限指定を検討してください。

        Args:
            pdf_path: PDFファイルのパス
            max_pages: 抽出する最大ページ数（Noneで無制限）
            max_chars: 抽出する最大文字数（Noneで無制限、超過時は末尾にトランケート注記を付与）

        Returns:
            抽出されたテキスト（ページごとにヘッダ付き、空ページはスキップ）

        Raises:
            FileNotFoundError: PDFファイルが見つからない場合
            ValueError: PDFファイルが無効/破損している場合や読み取り失敗時
        """
        pdf_path = PDFExtractionService._validate_pdf_path(pdf_path)

        out = StringIO()
        total_chars = 0

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    if max_pages is not None and page_num > max_pages:
                        break
                    text = page.extract_text()
                    if not text:
                        continue
                    chunk = f"--- ページ {page_num} ---\n{text}"
                    if max_chars is not None and total_chars + len(chunk) > max_chars:
                        remaining = max(0, max_chars - total_chars)
                        if remaining > 0:
                            out.write(chunk[:remaining])
                        out.write("\n\n…(truncated)\n")
                        break
                    out.write(chunk)
                    out.write("\n\n")
                    total_chars += len(chunk) + 2
        except PDFSyntaxError as e:
            raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
        except (PermissionError, OSError) as e:
            raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e

        return out.getvalue().rstrip()

    @staticmethod
    def extract_text_iter(pdf_path: str | Path) -> Iterator[str]:
        """
        PDFテキストをページ単位でストリーミング抽出するジェネレータ。

        メモリ使用量を抑えたい場合はこちらを利用してください。

        Yields:
            ページヘッダと本文を含む文字列（空ページはスキップ）
        """
        pdf_path = PDFExtractionService._validate_pdf_path(pdf_path)

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    if not text:
                        continue
                    yield f"--- ページ {page_num} ---\n{text}"
        except PDFSyntaxError as e:
            raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
        except (PermissionError, OSError) as e:
            raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e

    @staticmethod
    def extract_images_by_page(pdf_path: str | Path) -> dict[int, list[dict]]:
        """ページごとの画像情報を抽出する。

        Returns:
            {page_num: [{"bbox": (x0, top, x1, bottom), "name": str|None}, ...], ...}
        """
        pdf_path = PDFExtractionService._validate_pdf_path(pdf_path)

        results: dict[int, list[dict]] = {}
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    imgs = page.images or []
                    flat = []
                    for img in imgs:
                        bbox = (img.get("x0"), img.get("top"), img.get("x1"), img.get("bottom"))
                        flat.append({"bbox": bbox, "name": img.get("name")})
                    results[page_num] = flat
        except PDFSyntaxError as e:
            raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
        except (PermissionError, OSError) as e:
            raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e

        return results

    @staticmethod
    def extract_tables_by_page(pdf_path: str | Path) -> dict[int, list[list[list[str | None]]]]:
        """ページごとのテーブル（セル文字列）を抽出する。"""
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDFファイルが見つかりません: {pdf_path}")
        if not pdf_path.suffix.lower() == ".pdf":
            raise ValueError(f"ファイルはPDF形式である必要があります: {pdf_path}")
        if not PDFExtractionService._has_pdf_signature(pdf_path):
            raise ValueError(f"PDFシグネチャが不正です: {pdf_path}")

        results: dict[int, list[list[list[str | None]]]] = {}
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    tables = page.extract_tables() or []
                    results[page_num] = tables
        except PDFSyntaxError as e:
            raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
        except (PermissionError, OSError) as e:
            raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e

        return results

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
        pdf_path = PDFExtractionService._validate_pdf_path(pdf_path)

        pages_text = {}

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    pages_text[page_num] = text or ""
        except PDFSyntaxError as e:
            raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
        except (PermissionError, OSError) as e:
            raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e

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
        pdf_path = PDFExtractionService._validate_pdf_path(pdf_path)

        try:
            with pdfplumber.open(pdf_path) as pdf:
                return {
                    "page_count": len(pdf.pages),
                    "metadata": pdf.metadata,
                }
        except PDFSyntaxError as e:
            raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
        except (PermissionError, OSError) as e:
            raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e
