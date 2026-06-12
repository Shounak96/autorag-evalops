import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PromptComparison(Base):
    __tablename__ = "prompt_comparisons"

    id: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    dataset_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("eval_datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    prompt_version_a_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("prompt_versions.id", ondelete="SET NULL"),
        nullable=True,
    )

    prompt_version_a_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    prompt_version_b_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("prompt_versions.id", ondelete="SET NULL"),
        nullable=True,
    )

    prompt_version_b_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    run_a_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("rag_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    run_b_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("rag_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    winner: Mapped[str] = mapped_column(String(100), nullable=False)

    score_a: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    score_b: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    comparison_valid: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    comparison_warning: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    metric_deltas_json: Mapped[str] = mapped_column(Text, nullable=False)
    report_json: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
