import logging
from typing import Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from .database import engine as default_engine, Base
from . import models  # Ensures all models are registered on Base.metadata

logger = logging.getLogger("brandforge.migrations")


def get_default_sql_clause(col) -> str:
    """Returns a SQL DEFAULT clause if appropriate for the column type/model default."""
    # Check column name specific defaults
    col_name = col.name.lower()
    
    if col_name == "approval_status":
        return "DEFAULT 'pending_review'"
    if col_name == "revision_number":
        return "DEFAULT 1"
    if col_name == "status":
        if str(col.table) == "content_schedules":
            return "DEFAULT 'scheduled'"
        if str(col.table) == "campaigns":
            return "DEFAULT 'draft'"
    if col_name == "confidence":
        return "DEFAULT 'medium'"
    if col_name in ("impressions", "reach", "likes", "comments", "shares", "saves", "clicks", "conversions", "publish_attempts"):
        return "DEFAULT 0"
    if col_name in ("engagement_rate", "conversion_rate"):
        return "DEFAULT 0.0"
    if col_name in ("is_current", "is_active"):
        return "DEFAULT 1"
    if col_name in ("is_selected", "recommended"):
        return "DEFAULT 0"
    if col_name in ("total_pieces",):
        return "DEFAULT 32"
    if col_name in ("completeness",):
        return "DEFAULT 80"
    if col_name == "timezone":
        return "DEFAULT 'Asia/Kolkata'"
    if col_name == "color":
        return "DEFAULT '#C4813A'"
    if col_name == "product_type":
        return "DEFAULT 'Core Product'"
    if col_name == "price":
        return "DEFAULT '$0'"
    
    return ""


def run_migrations(target_engine: Optional[Engine] = None):
    """
    Safely and idempotently migrates the database schema:
    1. Creates any missing tables defined in Base.metadata.
    2. Inspects existing tables for missing columns and adds them via ALTER TABLE.
    3. Backfills default values for newly added columns on existing rows.
    Preserves all existing data.
    """
    if target_engine is None:
        target_engine = default_engine

    logger.info("Checking database schema migrations...")

    # Step 1: Ensure all registered tables exist
    Base.metadata.create_all(bind=target_engine)

    # Step 2: Inspect existing tables and columns
    inspector = inspect(target_engine)
    existing_tables = set(inspector.get_table_names())

    with target_engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
            
            for col in table.columns:
                if col.name not in existing_cols:
                    # Compile dialect-specific SQL column type
                    try:
                        col_type_sql = col.type.compile(dialect=target_engine.dialect)
                    except Exception:
                        col_type_sql = str(col.type)

                    default_clause = get_default_sql_clause(col)
                    
                    if default_clause:
                        alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type_sql} {default_clause}"
                    else:
                        alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type_sql}"

                    logger.info(f"Adding missing column to '{table_name}': {alter_stmt}")
                    try:
                        conn.execute(text(alter_stmt))
                    except Exception as e:
                        # Log and continue if already added or dialect error
                        logger.warning(f"Error executing '{alter_stmt}': {e}")

        # Step 3: Run safe backfill updates to guarantee data integrity for newly added columns
        backfill_statements = [
            # CampaignContent Milestone 3C columns
            "UPDATE campaign_contents SET approval_status = 'pending_review' WHERE approval_status IS NULL;",
            "UPDATE campaign_contents SET revision_number = 1 WHERE revision_number IS NULL;",
            "UPDATE campaign_contents SET updated_at = created_at WHERE updated_at IS NULL;",
            # Timestamps
            "UPDATE campaigns SET updated_at = created_at WHERE updated_at IS NULL;",
            "UPDATE brands SET updated_at = created_at WHERE updated_at IS NULL;",
            "UPDATE campaign_insights SET updated_at = created_at WHERE updated_at IS NULL;",
            "UPDATE content_schedules SET updated_at = created_at WHERE updated_at IS NULL;",
            # Flags & Defaults
            "UPDATE content_audits SET is_current = 1 WHERE is_current IS NULL;",
            "UPDATE campaign_insights SET is_active = 1 WHERE is_active IS NULL;",
            "UPDATE campaign_strategies SET is_selected = 0 WHERE is_selected IS NULL;",
            "UPDATE campaign_strategies SET recommended = 0 WHERE recommended IS NULL;",
            "UPDATE content_schedules SET status = 'scheduled' WHERE status IS NULL;",
            "UPDATE content_schedules SET timezone = 'Asia/Kolkata' WHERE timezone IS NULL;",
        ]

        for stmt in backfill_statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                # Table or column may not exist in earlier DB version, safely ignore
                logger.debug(f"Backfill note: {e}")

    logger.info("Database schema migrations verified and up-to-date.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()
    print("Migration completed successfully.")
