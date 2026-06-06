from pydantic import BaseModel, Field


class RagAskRequest(BaseModel):
    question: str = Field(..., min_length=3)
    top_k: int = Field(default=5, ge=1, le=10)
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0)
    keyword_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    use_query_rewrite: bool = True
    max_rewritten_queries: int = Field(default=4, ge=1, le=6)
    prompt_version_id: str | None = None


class RagCitation(BaseModel):
    chunk_id: str
    document_id: str
    file_name: str
    page_number: int | None
    chunk_index: int


class RagRetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    file_name: str
    page_number: int | None
    chunk_index: int
    content: str
    vector_score: float
    keyword_score: float
    hybrid_score: float


class RagMetrics(BaseModel):
    retrieval_score: float
    citation_coverage: float
    grounding_score: float
    unsupported_claims_count: int
    latency_ms: int


class AgentTraceStep(BaseModel):
    step_name: str
    status: str
    latency_ms: int

class ClaimVerification(BaseModel):
    claim: str
    status: str
    source_labels: list[str]
    explanation: str


class GroundingVerificationReport(BaseModel):
    strategy: str
    claims: list[ClaimVerification]
    grounding_score: float
    unsupported_claims_count: int
    summary: str
    fallback_reason: str | None


class RagAskResponse(BaseModel):
    rag_run_id: str
    question: str
    selected_prompt_version_id: str | None
    selected_prompt_version_name: str
    rewritten_queries: list[str]
    answer: str
    answer_generation_strategy: str
    citations: list[RagCitation]
    retrieved_chunks: list[RagRetrievedChunk]
    verification_report: GroundingVerificationReport
    metrics: RagMetrics
    agent_trace: list[AgentTraceStep]