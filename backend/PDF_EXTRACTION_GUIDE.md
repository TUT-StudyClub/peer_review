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

---

## PDFExtractionService の内部実装

### クラス概要
`PDFExtractionService` は `pdfplumber` をラッパーしたサービスクラスで、以下の特徴があります：
- すべてのメソッドが **静的メソッド**（`@staticmethod`）として実装
- **共通の検証処理** を分離（DRY原則）
- **スタックフローの一貫性** - 同じエラーハンドリングパターン

### 内部メソッド

#### `_validate_pdf_path(pdf_path: str | Path) -> Path`
**役割:** 全メソッドで共通する PDF パス検証

**処理フロー:**
1. `Path` 型に変換
2. ファイル存在確認（`exists()`）
3. 拡張子確認（`.pdf`）
4. **PDF シグネチャ確認**（マジックバイト `%PDF-`）

**例外処理:**
- `FileNotFoundError`: ファイルが存在しない
- `ValueError`: 拡張子が .pdf でない、またはシグネチャが不正

```python
# 内部実装
p = Path(pdf_path)
if not p.exists():
    raise FileNotFoundError(f"PDFファイルが見つかりません: {p}")
if p.suffix.lower() != ".pdf":
    raise ValueError(f"ファイルはPDF形式である必要があります: {p}")
if not PDFExtractionService._has_pdf_signature(p):
    raise ValueError(f"PDFシグネチャが不正です: {p}")
return p
```

#### `_has_pdf_signature(pdf_path: Path) -> bool`
**役割:** PDF ファイルの真正性を確認（偽装ファイル対策）

**処理フロー:**
1. ファイルを **バイナリ モード** で開く
2. ファイル先頭 **5 バイト** 読み込み
3. `b"%PDF-"` と比較
4. `OSError` 時は `False` を返す（ファイル破損対策）

**実装例:**
```python
# バイナリヘッダの確認
with pdf_path.open("rb") as f:
    header = f.read(5)  # %PDF- (5バイト)
return header.startswith(b"%PDF-")
```

---

### 公開メソッド - 詳細処理フロー

#### `extract_text()` の処理フロー

```
1. パス検証 (_validate_pdf_path)
2. StringIO バッファ初期化
3. pdfplumber でPDF開く
4. ページごとのループ処理:
   - テキスト抽出 (page.extract_text())
   - 空ページスキップ
   - ページヘッダ付加 ("--- ページ N ---")
   - max_pages チェック
   - max_chars チェック（超過時にトランケート）
   - バッファに追記
5. PDF 閉じる（自動）
6. 文字列化して返す（rstrip で末尾空白削除）
```

**重要な特徴:**

| 特徴 | 説明 |
|------|------|
| **メモリ安全性** | 大きなPDF時は `extract_text_iter()` 推奨 |
| **ページ跳ばし** | 空ページは出力対象から除外 |
| **トランケート** | `max_chars` 超過時に `…(truncated)` を付与 |
| **エラー連鎖** | `PDFSyntaxError`, `PermissionError`, `OSError` → `ValueError` |

**例:**
```python
# 最初の10ページ、最大5000文字で抽出
text = service.extract_text(
    "document.pdf",
    max_pages=10,
    max_chars=5000
)
```

---

#### `extract_text_iter()` の処理フロー

**目的:** メモリ効率を重視した **ジェネレータ版**

```
1. パス検証
2. pdfplumber でPDF開く
3. ページごとのループ:
   - テキスト抽出
   - 空ページスキップ
   - ページヘッダ付加
   - yield で1ページを出力
4. 呼び出し側でページを逐次処理可能
```

**メモリ使用量比較:**
```python
# extract_text: 全ページメモリ保持
text = service.extract_text("large.pdf")  # 数秒待機

# extract_text_iter: 1ページづつ処理
for page_text in service.extract_text_iter("large.pdf"):
    print(page_text)  # リアルタイム処理
```

---

#### `extract_text_by_page()` の処理フロー

**目的:** ページ単位での テキスト辞書化

```
1. パス検証
2. 空辞書を初期化
3. ページごとのループ:
   - page.extract_text() で抽出（None時は ""）
   - {page_num: text} で記録
4. 辞書を返す
```

**戻り値の特徴:**
- ページ番号がキー（1ベース）
- テキストなしページも `""` で記録
- ページヘッダなし（純粋なテキストのみ）

**使用例:**
```python
pages = service.extract_text_by_page("document.pdf")
for page_num in sorted(pages.keys()):
    print(f"ページ {page_num}: {len(pages[page_num])} 文字")
```

---

#### `get_pdf_info()` の処理フロー

```
1. パス検証
2. pdfplumber でPDF開く
3. メタデータ取得:
   - len(pdf.pages): ページ数
   - pdf.metadata: メタデータ辞書
4. 辞書で返す
```

**戻り値フォーマット:**
```python
{
    'page_count': <int>,
    'metadata': {
        'Title': <str|None>,
        'Author': <str|None>,
        'Subject': <str|None>,
        'Creator': <str|None>,
        'Producer': <str|None>,
        'CreationDate': <str|None>,
        'ModDate': <str|None>,
        ...
    }
}
```

---

#### `extract_images_by_page()` の処理フロー

```
1. パス検証
2. ページごとのループ:
   - page.images リスト取得（None時は []）
   - 各画像の bbox（座標）と name を抽出
   - フラット化して辞書に記録
3. 結果辞書を返す
```

**戻り値フォーマット:**
```python
{
    1: [
        {"bbox": (100, 200, 300, 400), "name": "image1"},
        {"bbox": (50, 150, 250, 350), "name": None}
    ],
    2: []  # 画像なし
}
```

---

#### `extract_tables_by_page()` の処理フロー

```
1. パス検証
2. ページごとのループ:
   - page.extract_tables() で テーブル抽出
   - テーブルはセル行列 [[[row1_col1, row1_col2, ...], ...], ...]
   - None時は []
   - ページごとに記録
3. 結果辞書を返す
```

**戻り値フォーマット:**
```python
{
    1: [  # ページ1の全テーブル
        [  # テーブル1
            ["ヘッダ1", "ヘッダ2"],
            ["データ1", "データ2"]
        ],
        [  # テーブル2
            ["A", "B"],
            ["C", "D"]
        ]
    ]
}
```

---

### エラーハンドリング戦略

すべてのメソッドは同じエラーハンドリングパターンを採用：

```python
try:
    # PDF 処理
    with pdfplumber.open(pdf_path) as pdf:
        # ...
except PDFSyntaxError as e:
    # PDF 破損
    raise ValueError(f"PDFが壊れている可能性があります: {e}") from e
except (PermissionError, OSError) as e:
    # ファイルアクセス失敗
    raise ValueError(f"PDFの読み取りに失敗しました: {e}") from e
```

**例外マップ:**

| 例外 | 原因 | 対応 |
|------|------|------|
| `FileNotFoundError` | ファイル不存在 | ファイルパス確認 |
| `ValueError` (シグネチャ) | PDF でないファイル | ファイル形式確認 |
| `ValueError` (壊れている) | `PDFSyntaxError` ラップ | PDF 再ダウンロード |
| `ValueError` (読み取り失敗) | `PermissionError`/`OSError` ラップ | ファイル権限確認 |

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
uv run python tests/integration/test_pdf_extraction.py
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

※ 詳細テスト用スクリプトは用意していません。上記の基本テストのみで確認可能です。

---

## LLMスコア化への連携

抽出されたテキストをLLMでスコア化する場合の使用パターン:

```python
from app.services.pdf import PDFExtractionService
from openai import OpenAI  # 現行のクライアントベースAPI

service = PDFExtractionService()
client = OpenAI()  # 環境変数 OPENAI_API_KEY を利用

# PDFをページごとに抽出
pages = service.extract_text_by_page("submission.pdf")

# 各ページをLLMで処理（現行API: client.chat.completions.create）
scores = {}
for page_num, text in pages.items():
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # 利用可能なモデルに置き換えてください
        messages=[
            {
                "role": "user",
                "content": f"以下のテキストをスコア化してください:\n\n{text}",
            }
        ],
        temperature=0.2,
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

