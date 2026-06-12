import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    rag_run_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("rag_runs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    input_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="success")
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    rag_run = relationship("RagRun", back_populates="agent_steps")
