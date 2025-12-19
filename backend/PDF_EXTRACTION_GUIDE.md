# PDF抽出機能の実装ガイド

## 概要
`pdfplumber` を使用して PDF ファイルからテキストを抽出する機能を実装しました。この機能は LLM によるスコア化処理の前段階として、PDF から構造化されたテキストを取得します。

## インストール済みパッケージ
- `pdfplumber>=0.11.0` - PDF 処理
- `reportlab>=4.4.6` - テスト用 PDF 生成

## 実装モジュール

### `app/services/pdf.py`
PDF 処理を行うサービスクラス `PDFExtractionService` を含みます。

#### メソッド一覧

##### 1. `extract_text(pdf_path: str | Path) -> str`
PDF ファイル全体からテキストを抽出します。

**使用例:**
```python
from app.services.pdf import PDFExtractionService

service = PDFExtractionService()
text = service.extract_text("path/to/document.pdf")
print(text)
```

**戻り値:**
```
--- ページ 1 ---
ページ1のテキスト内容...

--- ページ 2 ---
ページ2のテキスト内容...
```

---

##### 2. `extract_text_by_page(pdf_path: str | Path) -> dict[int, str]`
PDF をページごとにテキストを抽出します。

**使用例:**
```python
pages = service.extract_text_by_page("path/to/document.pdf")

for page_num, text in pages.items():
    print(f"ページ {page_num}: {len(text)} 文字")
    print(text)
```

**戻り値:**
```python
{
    1: "ページ1のテキスト...",
    2: "ページ2のテキスト...",
    3: "ページ3のテキスト..."
}
```

---

##### 3. `get_pdf_info(pdf_path: str | Path) -> dict`
PDF ファイルの情報（ページ数、メタデータ）を取得します。

**使用例:**
```python
info = service.get_pdf_info("path/to/document.pdf")
print(f"ページ数: {info['page_count']}")
print(f"メタデータ: {info['metadata']}")
```

**戻り値:**
```python
{
    'page_count': 5,
    'metadata': {
        'Author': '著者名',
        'Title': 'タイトル',
        'CreationDate': '作成日',
        ...
    }
}
```

---

## エラーハンドリング

### FileNotFoundError
ファイルが存在しない場合に発生します。

```python
try:
    text = service.extract_text("nonexistent.pdf")
except FileNotFoundError as e:
    print(f"ファイルが見つかりません: {e}")
```

### ValueError
PDF 形式が無効な場合に発生します。

```python
try:
    text = service.extract_text("file.txt")  # PDF 以外のファイル
except ValueError as e:
    print(f"エラー: {e}")
```

---

## テスト実行

### 基本テスト
```bash
cd backend
uv run python test_pdf_extraction.py
```

出力例:
```
============================================================
PDF抽出機能テスト開始
============================================================

📊 テスト1: PDFファイル情報の取得
✓ ページ数: 2
✓ メタデータ: ...

📄 テスト2: PDF全体からテキスト抽出
✓ 抽出成功（文字数: 136）

📑 テスト3: ページごとにテキスト抽出
✓ ページごと抽出成功

✓ すべてのテストが完了しました！
```

### 詳細テスト
```bash
cd backend
uv run python test_pdf_detailed.py
```

より詳しい統計情報やメタデータ情報が表示されます。

---

## LLMスコア化への連携

抽出されたテキストをLLMでスコア化する場合の使用パターン:

```python
from app.services.pdf import PDFExtractionService
import openai  # または別のLLMライブラリ

service = PDFExtractionService()

# PDFをページごとに抽出
pages = service.extract_text_by_page("submission.pdf")

# 各ページをLLMで処理
scores = {}
for page_num, text in pages.items():
    # LLMプロンプト
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {
                "role": "user",
                "content": f"以下のテキストをスコア化してください:\n\n{text}"
            }
        ]
    )
    scores[page_num] = response.choices[0].message.content

print(scores)
```

---

## トラブルシューティング

### `ModuleNotFoundError: No module named 'pdfplumber'`
環境が正しく設定されていません。
```bash
cd backend
uv sync
```

### テキストが文字化けする場合
PDF の文字エンコーディング問題が考えられます。
- `pdfplumber` は通常 UTF-8 で処理されます
- 特殊な PDF 形式の場合は追加の処理が必要な場合があります

### PDF が読み込めない場合
- ファイルが壊れていないか確認
- 形式が正しい PDF か確認
- 暗号化されている PDF の場合はサポート外です

---

## テスト実行確認結果

✅ **テスト完了状況:**
- PDF読み込み: **OK**
- テキスト抽出: **OK** (複数ページ対応)
- ページ分割: **OK** (2ページ以上のPDFで検証)
- メタデータ取得: **OK**

**次のステップ:**
- LLM スコア化エンジンの実装
- API エンドポイントの作成（PDF アップロード・処理）
- スコア結果の永続化

