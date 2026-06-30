from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class EvalDatasetCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class EvalDatasetResponse(BaseModel):
    id: str
    name: str
    description: str | None
    test_case_count: int
    created_at: datetime


class EvalDatasetListResponse(BaseModel):
    datasets: list[EvalDatasetResponse]
    count: int


class EvalTestCaseCreateRequest(BaseModel):
    question: str = Field(..., min_length=3)
    expected_answer: str | None = None
    required_document_name: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list)


class EvalTestCaseResponse(BaseModel):
    id: str
    dataset_id: str
    question: str
    expected_answer: str | None
    required_document_name: str | None
    tags: list[str]
    created_at: datetime


class EvalTestCaseListResponse(BaseModel):
    test_cases: list[EvalTestCaseResponse]
    count: int


class EvalDatasetDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None
    test_case_count: int
    created_at: datetime
    test_cases: list[EvalTestCaseResponse]


class DeleteEvalTestCaseResponse(BaseModel):
    message: str
    deleted_test_case_id: str

class QualityGateThresholds(BaseModel):
    min_pass_rate: float = Field(default=0.8, ge=0.0, le=1.0)
    min_retrieval_score: float = Field(default=0.2, ge=0.0, le=1.0)
    min_grounding_score: float = Field(default=0.75, ge=0.0, le=1.0)
    min_citation_coverage: float = Field(default=1.0, ge=0.0, le=1.0)
    min_answer_score: float = Field(default=0.6, ge=0.0, le=1.0)
    max_unsupported_claims: int = Field(default=0, ge=0)
    max_avg_latency_ms: float = Field(default=15000, ge=1)
    baseline_run_id: str | None = None
    max_pass_rate_drop: float = Field(default=0.1, ge=0.0, le=1.0)
    max_answer_score_drop: float = Field(default=0.15, ge=0.0, le=1.0)
    max_retrieval_score_drop: float = Field(default=0.15, ge=0.0, le=1.0)
    max_grounding_score_drop: float = Field(default=0.1, ge=0.0, le=1.0)
    max_citation_coverage_drop: float = Field(default=0.1, ge=0.0, le=1.0)


class EvalDatasetRunRequest(BaseModel):
    top_k: int = Field(default=5, ge=1, le=10)
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0)
    keyword_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    use_query_rewrite: bool = True
    max_rewritten_queries: int = Field(default=4, ge=1, le=6)
    prompt_version_id: str | None = None
    thresholds: QualityGateThresholds = Field(
        default_factory=QualityGateThresholds
    )
    source: str = Field(default="manual", max_length=50)
    branch_name: str | None = Field(default=None, max_length=255)
    commit_sha: str | None = Field(default=None, max_length=255)
    trigger_type: str | None = Field(default=None, max_length=100)
    external_run_url: str | None = Field(default=None, max_length=1000)


class EvalCaseRunResponse(BaseModel):
    test_case_id: str
    child_rag_run_id: str | None
    question: str
    expected_answer: str | None
    generated_answer: str | None
    passed: bool
    failure_reasons: list[str]
    required_document_hit: bool
    answer_score: float
    retrieval_score: float
    citation_coverage: float
    grounding_score: float
    unsupported_claims_count: int
    latency_ms: int
    answer_generation_strategy: str | None
    verification_strategy: str | None


class EvalDatasetRunSummary(BaseModel):
    rag_run_id: str
    dataset_id: str
    dataset_name: str
    prompt_version_id: str | None
    prompt_version_name: str
    status: str
    quality_gate_passed: bool
    total_cases: int
    passed_cases: int
    failed_cases: int
    pass_rate: float
    avg_answer_score: float
    avg_retrieval_score: float
    avg_citation_coverage: float
    avg_grounding_score: float
    total_unsupported_claims: int
    avg_latency_ms: float
    thresholds: QualityGateThresholds
    results: list[EvalCaseRunResponse]
    source: str | None = None
    branch_name: str | None = None
    commit_sha: str | None = None
    trigger_type: str | None = None
    external_run_url: str | None = None


class PromptComparisonRequest(BaseModel):
    prompt_version_a_id: str
    prompt_version_b_id: str
    top_k: int = Field(default=5, ge=1, le=10)
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0)
    keyword_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    use_query_rewrite: bool = True
    max_rewritten_queries: int = Field(default=4, ge=1, le=6)
    thresholds: QualityGateThresholds = Field(
        default_factory=QualityGateThresholds
    )


class PromptComparisonResponse(BaseModel):
    comparison_id: str
    dataset_id: str
    dataset_name: str
    prompt_version_a_id: str
    prompt_version_a_name: str
    prompt_version_b_id: str
    prompt_version_b_name: str
    winner: str
    score_a: float
    score_b: float
    comparison_valid: bool
    comparison_warning: str | None
    metric_deltas_b_minus_a: dict[str, float]
    run_a: EvalDatasetRunSummary
    run_b: EvalDatasetRunSummary


class EvalRunResultHistoryItem(BaseModel):
    id: str
    rag_run_id: str
    child_rag_run_id: str | None
    test_case_id: str | None
    question: str
    generated_answer: str | None
    expected_answer: str | None
    retrieval_score: float
    citation_coverage: float
    grounding_score: float
    answer_score: float
    unsupported_claims_count: int
    required_document_hit: bool
    answer_generation_strategy: str | None
    verification_strategy: str | None
    passed: bool
    failure_reasons: list[str]
    latency_ms: int
    created_at: datetime


class EvalRunHistoryItem(BaseModel):
    rag_run_id: str
    source: str | None = None
    branch_name: str | None = None
    commit_sha: str | None = None
    trigger_type: str | None = None
    external_run_url: str | None = None
    dataset_id: str | None
    dataset_name: str | None
    prompt_version_id: str | None
    prompt_version_name: str | None
    status: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    pass_rate: float
    avg_retrieval_score: float
    avg_grounding_score: float
    avg_citation_coverage: float
    avg_latency_ms: float
    total_unsupported_claims: int
    quality_gate_passed: bool
    created_at: datetime
    completed_at: datetime | None


class EvalRunListResponse(BaseModel):
    runs: list[EvalRunHistoryItem]
    count: int


class EvalRunDetailResponse(EvalRunHistoryItem):
    results: list[EvalRunResultHistoryItem]


class EvalRunResultsResponse(BaseModel):
    rag_run_id: str
    results: list[EvalRunResultHistoryItem]
    count: int


class PromptComparisonHistoryItem(BaseModel):
    comparison_id: str
    dataset_id: str
    dataset_name: str | None
    prompt_version_a_id: str | None
    prompt_version_a_name: str
    prompt_version_b_id: str | None
    prompt_version_b_name: str
    run_a_id: str | None
    run_b_id: str | None
    winner: str
    score_a: float
    score_b: float
    comparison_valid: bool
    comparison_warning: str | None
    metric_deltas_b_minus_a: dict[str, float]
    created_at: datetime


class PromptComparisonListResponse(BaseModel):
    comparisons: list[PromptComparisonHistoryItem]
    count: int


class PromptComparisonDetailResponse(PromptComparisonHistoryItem):
    report: dict[str, Any]