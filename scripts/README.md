# デプロイメントスクリプト

このディレクトリには、Peer Review アプリケーションを AWS にデプロイするための自動化スクリプトが含まれています。

## 前提条件
1.  **AWS CLI**: インストールおよび設定済みであること (`aws configure`)。
2.  **Docker**: インストールされ、起動していること。
3.  **jq**: インストール済みであること (macOS の場合は `brew install jq`)。

## 使い方

1.  プロジェクトのルートディレクトリでターミナルを開きます。
2.  デプロイメントスクリプトを実行します:
    ```bash
    ./scripts/deploy_aws.sh
    ```

## スクリプトの処理内容
1.  **S3**: ファイルアップロード用のバケットを作成します。
2.  **IAM**: `apprunner-s3-access` ロールを作成します。
3.  **RDS**: PostgreSQL データベースを作成し（存在しない場合）、利用可能になるまで待機します。
4.  **ECR**: バックエンドの Docker イメージをビルドし、Amazon ECR にプッシュします。
5.  **App Runner**: API サービスを作成し、RDS および S3 と接続します。

## スクリプト実行後の手順
1.  **フロントエンド (Cloudflare Pages)**:
    -   Cloudflare ダッシュボードに移動します。
    -   新しい Pages プロジェクトを作成 > Git に接続します。
    -   設定 > 環境変数 (Environment Variables):
        -   `NEXT_PUBLIC_API_BASE_URL`: App Runner の URL (例: `https://xxxx.awsapprunner.com`) を設定します。
