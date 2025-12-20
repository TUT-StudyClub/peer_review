# Migration: Add similarity columns to reviews

この変更は `reviews` テーブルに以下のカラムを追加します:

- `similarity_score` FLOAT NULL
- `similar_review_id` UUID NULL (自己参照、ON DELETE SET NULL)
- `similarity_warning` TEXT NULL
- `similarity_penalty_rate` FLOAT NULL

推奨手順:

1. **Alembic を使用している場合**:

   ```bash
   cd backend
   alembic revision --autogenerate -m "add similarity fields to reviews"
   alembic upgrade head
   ```

   - autogenerate が正しく作成しない場合は手動で `op.add_column` と `op.create_foreign_key` を追加してください。

2. **直接 SQL を実行する場合** (Postgres の例):

   ```sql
   ALTER TABLE reviews ADD COLUMN similarity_score DOUBLE PRECISION;
   ALTER TABLE reviews ADD COLUMN similar_review_id UUID;
   ALTER TABLE reviews ADD COLUMN similarity_warning TEXT;
   ALTER TABLE reviews ADD COLUMN similarity_penalty_rate DOUBLE PRECISION;
   ALTER TABLE reviews ADD CONSTRAINT fk_reviews_similar_review_id FOREIGN KEY (similar_review_id) REFERENCES reviews (id) ON DELETE SET NULL;
   CREATE INDEX ix_reviews_similar_review_id ON reviews (similar_review_id);
   ```

   SQLite を使っている場合は、ALTER TABLE の制約追加に制限があるため、テーブルを再作成する必要があるかもしれません。

3. マイグレーション後、アプリケーションを再起動して動作を確認してください。

---

本番DBでの実行前にバックアップを必ず取得してください。