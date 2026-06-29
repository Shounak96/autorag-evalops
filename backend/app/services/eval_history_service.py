import json

from sqlalchemy.orm import Session

from app.models.eval_dataset import EvalDataset
from app.models.prompt_comparison import PromptComparison
from app.models.prompt_version import PromptVersion
from app.models.rag_run import RagRun
from app.models.rag_run_result import RagRunResult


def parse_json_list(text_value: str | None) -> list:
    if not text_value:
        return []

    try:
        parsed = json.loads(text_value)

        return parsed if isinstance(parsed, list) else []

    except json.JSONDecodeError:
        return []


def parse_json_dict(text_value: str | None) -> dict:
    if not text_value:
        return {}

    try:
        parsed = json.loads(text_value)

        return parsed if isinstance(parsed, dict) else {}

    except json.JSONDecodeError:
        return {}


def serialize_run_result(result: RagRunResult) -> dict:
    return {
        "id": result.id,
        "rag_run_id": result.rag_run_id,
        "child_rag_run_id": result.child_rag_run_id,
        "test_case_id": result.test_case_id,
        "question": result.question,
        "generated_answer": result.generated_answer,
        "expected_answer": result.expected_answer,
        "retrieval_score": result.retrieval_score,
        "citation_coverage": result.citation_coverage,
        "grounding_score": result.grounding_score,
        "answer_score": result.answer_score,
        "unsupported_claims_count": result.unsupported_claims_count,
        "required_document_hit": result.required_document_hit,
        "answer_generation_strategy": result.answer_generation_strategy,
        "verification_strategy": result.verification_strategy,
        "passed": result.passed,
        "failure_reasons": parse_json_list(result.failure_reason),
        "latency_ms": result.latency_ms,
        "created_at": result.created_at,
    }


def serialize_run(
    db: Session,
    rag_run: RagRun,
    include_results: bool = False,
) -> dict:
    dataset_name: str | None = None
    prompt_version_name: str | None = None

    if rag_run.dataset_id:
        dataset = (
            db.query(EvalDataset)
            .filter(EvalDataset.id == rag_run.dataset_id)
            .first()
        )

        if dataset:
            dataset_name = dataset.name

    if rag_run.prompt_version_id:
        prompt = (
            db.query(PromptVersion)
            .filter(PromptVersion.id == rag_run.prompt_version_id)
            .first()
        )

        if prompt:
            prompt_version_name = prompt.name

    response = {
        "rag_run_id": rag_run.id,
        "source": rag_run.source,
        "branch_name": rag_run.branch_name,
        "commit_sha": rag_run.commit_sha,
        "trigger_type": rag_run.trigger_type,
        "external_run_url": rag_run.external_run_url,
        "dataset_id": rag_run.dataset_id,
        "dataset_name": dataset_name,
        "prompt_version_id": rag_run.prompt_version_id,
        "prompt_version_name": prompt_version_name,
        "status": rag_run.status,
        "total_cases": rag_run.total_cases,
        "passed_cases": rag_run.passed_cases,
        "failed_cases": rag_run.failed_cases,
        "pass_rate": rag_run.pass_rate,
        "avg_retrieval_score": rag_run.avg_retrieval_score,
        "avg_grounding_score": rag_run.avg_grounding_score,
        "avg_citation_coverage": rag_run.avg_citation_coverage,
        "avg_latency_ms": rag_run.avg_latency_ms,
        "total_unsupported_claims": rag_run.total_unsupported_claims,
        "quality_gate_passed": rag_run.quality_gate_passed,
        "created_at": rag_run.created_at,
        "completed_at": rag_run.completed_at,
    }

    if include_results:
        results = (
            db.query(RagRunResult)
            .filter(RagRunResult.rag_run_id == rag_run.id)
            .order_by(RagRunResult.created_at.asc())
            .all()
        )

        response["results"] = [
            serialize_run_result(result)
            for result in results
        ]

    return response


def get_eval_runs(
    db: Session,
    dataset_id: str | None = None,
    limit: int = 50,
) -> list[RagRun]:
    query = (
        db.query(RagRun)
        .filter(RagRun.dataset_id.is_not(None))
    )

    if dataset_id:
        query = query.filter(RagRun.dataset_id == dataset_id)

    return (
        query
        .order_by(RagRun.created_at.desc())
        .limit(limit)
        .all()
    )


def get_eval_run_by_id(
    db: Session,
    rag_run_id: str,
) -> RagRun | None:
    return (
        db.query(RagRun)
        .filter(RagRun.id == rag_run_id)
        .first()
    )


def get_run_results(
    db: Session,
    rag_run_id: str,
) -> list[RagRunResult]:
    return (
        db.query(RagRunResult)
        .filter(RagRunResult.rag_run_id == rag_run_id)
        .order_by(RagRunResult.created_at.asc())
        .all()
    )


def serialize_prompt_comparison(
    db: Session,
    comparison: PromptComparison,
    include_report: bool = False,
) -> dict:
    dataset_name: str | None = None

    dataset = (
        db.query(EvalDataset)
        .filter(EvalDataset.id == comparison.dataset_id)
        .first()
    )

    if dataset:
        dataset_name = dataset.name

    response = {
        "comparison_id": comparison.id,
        "dataset_id": comparison.dataset_id,
        "dataset_name": dataset_name,
        "prompt_version_a_id": comparison.prompt_version_a_id,
        "prompt_version_a_name": comparison.prompt_version_a_name,
        "prompt_version_b_id": comparison.prompt_version_b_id,
        "prompt_version_b_name": comparison.prompt_version_b_name,
        "run_a_id": comparison.run_a_id,
        "run_b_id": comparison.run_b_id,
        "winner": comparison.winner,
        "score_a": comparison.score_a,
        "score_b": comparison.score_b,
        "comparison_valid": comparison.comparison_valid,
        "comparison_warning": comparison.comparison_warning,
        "metric_deltas_b_minus_a": parse_json_dict(
            comparison.metric_deltas_json
        ),
        "created_at": comparison.created_at,
    }

    if include_report:
        response["report"] = parse_json_dict(comparison.report_json)

    return response


def get_prompt_comparisons(
    db: Session,
    limit: int = 50,
) -> list[PromptComparison]:
    return (
        db.query(PromptComparison)
        .order_by(PromptComparison.created_at.desc())
        .limit(limit)
        .all()
    )


def get_prompt_comparison_by_id(
    db: Session,
    comparison_id: str,
) -> PromptComparison | None:
    return (
        db.query(PromptComparison)
        .filter(PromptComparison.id == comparison_id)
        .first()
    )