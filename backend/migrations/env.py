import asyncio

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import Settings
from app.db import Base, default_database_url


def database_url():
    settings = Settings.from_env()
    if not settings.database_url:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings.database_url or default_database_url(settings.data_dir)


def include_name(name, type_, _parent_names):
    # The semantic cache owns this disposable table and its pgvector extension.
    return type_ != "table" or name != "story_vectors"


def migrate(connection):
    context.configure(
        connection=connection, target_metadata=Base.metadata, include_name=include_name
    )
    with context.begin_transaction():
        context.run_migrations()


async def migrate_async():
    engine = create_async_engine(database_url())
    try:
        async with engine.begin() as connection:
            await connection.run_sync(migrate)
    finally:
        await engine.dispose()


connection = context.config.attributes.get("connection")
if context.is_offline_mode():
    raise RuntimeError("Account migrations require an online database connection")
if connection is not None:
    migrate(connection)
else:
    asyncio.run(migrate_async())
