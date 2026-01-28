# AWS(App Runner + RDS + S3) / Vercel デプロイ手順（初学者向け）

この手順は「バックエンド + DB を AWS」「フロントを Vercel」に分けて、1回でデプロイ完了できることを目標にしています。

## 0. 事前準備（最初にやること）
- ドメインを用意（例: `example.com`）
- AWS と Vercel のアカウント作成
- ローカルに以下を用意
  - Git
  - Docker
  - Node.js 18+（frontend 用）
  - Python 3.12 + uv（backend 用）
  - AWS CLI（任意、あれば手順が短くなります）

## 1. 構成の確認（今回の完成図）
- フロント: Vercel（`https://app.example.com`）
- API: AWS App Runner（`https://api.example.com`）
- DB: Amazon RDS (PostgreSQL)
- ファイル保存: Amazon S3

## 2. S3 バケットを作成（提出ファイル保存用）
1) AWS コンソール → S3 → Create bucket
2) Bucket name: `peer-review-uploads` など
3) Region: `ap-northeast-1`（東京）
4) 「Block Public Access」は **ONのまま**
5) 作成

メモ: このバケットは **非公開** でOKです。APIがS3に保存/取得します。

## 3. App Runner 用の IAM ロール作成（S3アクセス用）
1) AWS コンソール → IAM → Roles → Create role
2) Use case: **App Runner** を選択
3) Permissions に以下のポリシーを追加（バケット名を書き換え）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

4) Role name を `apprunner-s3-access` などにして作成

## 4. RDS(PostgreSQL) を作成
1) AWS コンソール → RDS → Create database
2) Engine: PostgreSQL
3) Template: **Dev/Test**
4) DB instance class: `db.t4g.micro`（低コストでOK）
5) DB name: `pure_review`
6) Username / Password を設定（忘れない）
7) Connectivity
   - VPC: default（最初はそのままでOK）
   - Public access: **No**
   - Create new security group
8) 作成

作成後に **エンドポイント** をメモしておきます。

## 5. ECR を作成して API イメージを push
### 5-1) ECR リポジトリ作成
AWS コンソール → ECR → Create repository
名前: `peer-review-api` など

### 5-2) ローカルで build & push
```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=ap-northeast-1
REPO_NAME=peer-review-api

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker build -f backend/Dockerfile -t "$REPO_NAME" backend
docker tag "$REPO_NAME:latest" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest"
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest"
```

## 6. App Runner で API を起動
1) AWS コンソール → App Runner → Create service
2) Source: **Container registry**
3) ECR のイメージを選択
4) Port: `8000`
5) Instance role: 3章で作成した `apprunner-s3-access` を指定
6) Environment variables を設定（例）
   - `DATABASE_URL=postgresql+psycopg://USER:PASS@HOST:5432/DB?sslmode=require`
   - `SECRET_KEY=長いランダム文字列`
   - `APP_ENV=prod`
   - `STORAGE_BACKEND=s3`
   - `S3_BUCKET=YOUR_BUCKET_NAME`
   - `CORS_ALLOW_ORIGINS=https://app.example.com`

7) Auto scaling
   - Min: `1`, Max: `1`（最初はこれでOK）

### VPC Connector の作成
1) App Runner → VPC connectors → Create
2) VPC: RDS と同じもの
3) Subnets: private を選択
4) Security group: `apprunner-sg` を新規作成

作成後、App Runner service の設定で **VPC connector** を指定します。

## 7. RDS のセキュリティグループを修正
1) AWS コンソール → EC2 → Security Groups
2) RDS用のSGを開く
3) Inbound rules を追加
   - Type: PostgreSQL
   - Port: 5432
   - Source: **App Runner の SG (`apprunner-sg`)**

## 8. DBマイグレーション（自動実行）
このリポジトリの `backend/Dockerfile` は起動時に
`alembic upgrade head` を自動実行します。
App Runner のログで `alembic` 実行が成功しているか確認してください。

ログ確認: App Runner → Service → Logs

## 9. API のカスタムドメイン設定
1) App Runner → Service → Custom domains
2) `api.example.com` を追加
3) 表示される CNAME をメモ

ドメインのDNS（Route53 / Vercel DNS / その他のレジストラ）に CNAME を追加:
- Name: `api`
- Target: `xxxx.awsapprunner.com`
- Proxy設定がある場合は **DNS only**（まずはこれが安全）

SSL発行が完了したら `https://api.example.com/health` が開けます。

## 10. Vercel（フロント）
1) Vercel Dashboard → **Add New** → **Project** → GitHub 連携でリポジトリをインポート
2) Framework preset: **Next.js**（デフォルトで認識されます）
3) Environment Variables に追加:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`
4) Deploy を実行
5) Domain 設定（Project → Settings → Domains）
   - `app.example.com` を追加
   - 外部DNSを使う場合は、指示される CNAME（例: `cname.vercel-dns.com`）を追加
   - Vercel DNS を使う場合はそのまま適用

デプロイ完了後に `https://app.example.com` を確認。

## 11. 動作確認
- `https://api.example.com/health` が OK を返す
- フロントでログイン → 授業作成 → 課題作成 → 提出/ダウンロードが動作する

## 12. よくあるトラブル
**CORS エラーが出る**
- `CORS_ALLOW_ORIGINS` に `https://app.example.com` が入っているか確認
- Vercel の preview URL を使うなら `https://<project>.vercel.app` も追加

**API が 502 / 503**
- App Runner logs を確認
- RDS SG の inbound に `apprunner-sg:5432` があるか確認

**ファイルのアップロード/ダウンロードが失敗する**
- App Runner の IAM role が S3 権限を持っているか確認
- `S3_BUCKET` 名が正しいか確認

## 13. これで完了
この構成なら常時稼働できます。
コストを抑えるなら App Runner/RDS の小さいインスタンスから始め、必要に応じてスケールしてください。
