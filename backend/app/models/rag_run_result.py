import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class RagRunResult(Base):
    __tablename__ = "rag_run_results"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    rag_run_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("rag_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    child_rag_run_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    test_case_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("eval_test_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    question: Mapped[str] = mapped_column(Text, nullable=False)
    generated_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    retrieved_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    citations: Mapped[str | None] = mapped_column(Text, nullable=True)

    retrieval_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    citation_coverage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    grounding_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    answer_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    unsupported_claims_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    required_document_hit: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    answer_generation_strategy: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    verification_strategy: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    rag_run = relationship("RagRun", back_populates="results")
