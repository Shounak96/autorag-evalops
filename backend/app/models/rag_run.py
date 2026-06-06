import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class RagRun(Base):
    __tablename__ = "rag_runs"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    dataset_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("eval_datasets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    prompt_version_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("prompt_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="running",
    )

    total_cases: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    passed_cases: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_cases: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    pass_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_retrieval_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_grounding_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_citation_coverage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    total_unsupported_claims: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    quality_gate_passed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    results = relationship(
        "RagRunResult",
        back_populates="rag_run",
        cascade="all, delete-orphan",
    )

    agent_steps = relationship(
        "AgentStep",
        back_populates="rag_run",
        cascade="all, delete-orphan",
    )