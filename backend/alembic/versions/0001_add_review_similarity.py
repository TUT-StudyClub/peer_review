"""add similarity fields to reviews

Revision ID: 0001_add_review_similarity
Revises: 
Create Date: 2025-12-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001_add_review_similarity'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    # similarity_score
    op.add_column('reviews', sa.Column('similarity_score', sa.Float(), nullable=True))

    # similar_review_id: choose UUID type for postgres, string otherwise
    if dialect == 'postgresql':
        op.add_column('reviews', sa.Column('similar_review_id', postgresql.UUID(as_uuid=True), nullable=True))
    else:
        op.add_column('reviews', sa.Column('similar_review_id', sa.String(length=36), nullable=True))

    # similarity_warning
    op.add_column('reviews', sa.Column('similarity_warning', sa.Text(), nullable=True))

    # similarity_penalty_rate
    op.add_column('reviews', sa.Column('similarity_penalty_rate', sa.Float(), nullable=True))

    # add foreign key (self reference) and index
    op.create_foreign_key('fk_reviews_similar_review_id', 'reviews', 'reviews', ['similar_review_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_reviews_similar_review_id', 'reviews', ['similar_review_id'])


def downgrade():
    # drop index and foreign key first
    op.drop_index('ix_reviews_similar_review_id', table_name='reviews')
    op.drop_constraint('fk_reviews_similar_review_id', 'reviews', type_='foreignkey')

    op.drop_column('reviews', 'similarity_penalty_rate')
    op.drop_column('reviews', 'similarity_warning')
    op.drop_column('reviews', 'similar_review_id')
    op.drop_column('reviews', 'similarity_score')
