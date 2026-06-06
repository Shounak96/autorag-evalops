import json
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.eval_dataset import EvalDataset
from app.models.eval_test_case import EvalTestCase
from app.models.rag_run import RagRun
from app.models.rag_run_result import RagRunResult
from app.services.prompt_service import resolve_prompt_version
from app.services.rag_service import run_advanced_rag
from app.models.prompt_comparison import PromptComparison


STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "what",
    "how",
    "why",
    "when",
    "where",
    "does",
    "do",
    "did",
    "it",
    "this",
    "that",
    "as",
    "by",
    "from",
    "be",
    "can",
    "will",
    "should",
}


def tokenize(text_value: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9_]+", text_value.lower())

    return {
        token
        for token in tokens
        if len(token) > 2 and token not in STOPWORDS
    }


def calculate_expected_answer_score(
    expected_answer: str | None,
    generated_answer: str | None,
) -> float:
    if not expected_answer:
        return 1.0

    if not generated_answer:
        return 0.0

    expected_tokens = tokenize(expected_answer)
    generated_tokens = tokenize(generated_answer)

    if not expected_tokens:
        return 1.0

    overlap = expected_tokens.intersection(generated_tokens)

    return round(len(overlap) / len(expected_tokens), 4)


def check_required_document_hit(
    required_document_name: str | None,
    citations: list[dict],
    retrieved_chunks: list[dict],
) -> bool:
    if not required_document_name:
        return True

    normalized_required_name = required_document_name.strip().lower()

    cited_document_names = {
        str(citation.get("file_name", "")).strip().lower()
        for citation in citations
    }

    retrieved_document_names = {
        str(chunk.get("file_name", "")).strip().lower()
        for chunk in retrieved_chunks
    }

    return (
        normalized_required_name in cited_document_names
        or normalized_required_name in retrieved_document_names
    )


def build_failure_reasons(
    required_document_hit: bool,
    answer_score: float,
    retrieval_score: float,
    citation_coverage: float,
    grounding_score: float,
    unsupported_claims_count: int,
    thresholds: dict,
) -> list[str]:
    failure_reasons: list[str] = []

    if not required_document_hit:
        failure_reasons.append("Required document was not retrieved or cited.")

    if answer_score < thresholds["min_answer_score"]:
        failure_reasons.append(
            "Answer score is below the configured threshold."
        )

    if retrieval_score < thresholds["min_retrieval_score"]:
        failure_reasons.append(
            "Retrieval score is below the configured threshold."
        )

    if citation_coverage < thresholds["min_citation_coverage"]:
        failure_reasons.append(
            "Citation coverage is below the configured threshold."
        )

    if grounding_score < thresholds["min_grounding_score"]:
        failure_reasons.append(
            "Grounding score is below the configured threshold."
        )

    if unsupported_claims_count > thresholds["max_unsupported_claims"]:
        failure_reasons.append(
            "Unsupported claim count exceeds the configured threshold."
        )

    return failure_reasons


def create_dataset_rag_run(
    db: Session,
    dataset: EvalDataset,
    prompt_version_id: str | None,
) -> RagRun:
    rag_run = RagRun(
        dataset_id=dataset.id,
        prompt_version_id=prompt_version_id,
        status="running",
        total_cases=len(dataset.test_cases),
        passed_cases=0,
        failed_cases=0,
        notes=f"Dataset evaluation run: {dataset.name}",
    )

    db.add(rag_run)
    db.commit()
    db.refresh(rag_run)

    return rag_run


def store_case_result(
    db: Session,
    aggregate_rag_run: RagRun,
    test_case: EvalTestCase,
    pipeline_result: dict,
    passed: bool,
    failure_reasons: list[str],
    required_document_hit: bool,
    answer_score: float,
) -> RagRunResult:
    metrics = pipeline_result["metrics"]
    verification_report = pipeline_result["verification_report"]

    result = RagRunResult(
        rag_run_id=aggregate_rag_run.id,
        child_rag_run_id=pipeline_result.get("rag_run_id"),
        test_case_id=test_case.id,
        question=test_case.question,
        generated_answer=pipeline_result.get("answer"),
        expected_answer=test_case.expected_answer,
        retrieved_context=json.dumps(
            pipeline_result.get("retrieved_chunks", []),
            default=str,
        ),
        citations=json.dumps(
            pipeline_result.get("citations", []),
            default=str,
        ),
        retrieval_score=float(metrics.get("retrieval_score", 0.0)),
        citation_coverage=float(metrics.get("citation_coverage", 0.0)),
        grounding_score=float(metrics.get("grounding_score", 0.0)),
        answer_score=answer_score,
        unsupported_claims_count=int(
            metrics.get("unsupported_claims_count", 0)
        ),
        required_document_hit=required_document_hit,
        answer_generation_strategy=pipeline_result.get(
            "answer_generation_strategy"
        ),
        verification_strategy=verification_report.get("strategy"),
        passed=passed,
        failure_reason=(
            json.dumps(failure_reasons)
            if failure_reasons
            else None
        ),
        latency_ms=int(metrics.get("latency_ms", 0)),
    )

    db.add(result)
    db.commit()
    db.refresh(result)

    return result


def run_single_test_case(
    db: Session,
    aggregate_rag_run: RagRun,
    test_case: EvalTestCase,
    top_k: int,
    vector_weight: float,
    keyword_weight: float,
    use_query_rewrite: bool,
    max_rewritten_queries: int,
    prompt_version_id: str | None,
    thresholds: dict,
) -> dict:
    pipeline_result = run_advanced_rag(
        db=db,
        question=test_case.question,
        top_k=top_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        use_query_rewrite=use_query_rewrite,
        max_rewritten_queries=max_rewritten_queries,
        prompt_version_id=prompt_version_id,
    )

    metrics = pipeline_result["metrics"]

    answer_score = calculate_expected_answer_score(
        expected_answer=test_case.expected_answer,
        generated_answer=pipeline_result.get("answer"),
    )

    required_document_hit = check_required_document_hit(
        required_document_name=test_case.required_document_name,
        citations=pipeline_result.get("citations", []),
        retrieved_chunks=pipeline_result.get("retrieved_chunks", []),
    )

    failure_reasons = build_failure_reasons(
        required_document_hit=required_document_hit,
        answer_score=answer_score,
        retrieval_score=float(metrics.get("retrieval_score", 0.0)),
        citation_coverage=float(metrics.get("citation_coverage", 0.0)),
        grounding_score=float(metrics.get("grounding_score", 0.0)),
        unsupported_claims_count=int(
            metrics.get("unsupported_claims_count", 0)
        ),
        thresholds=thresholds,
    )

    passed = len(failure_reasons) == 0

    store_case_result(
        db=db,
        aggregate_rag_run=aggregate_rag_run,
        test_case=test_case,
        pipeline_result=pipeline_result,
        passed=passed,
        failure_reasons=failure_reasons,
        required_document_hit=required_document_hit,
        answer_score=answer_score,
    )

    verification_report = pipeline_result["verification_report"]

    return {
        "test_case_id": test_case.id,
        "child_rag_run_id": pipeline_result.get("rag_run_id"),
        "question": test_case.question,
        "expected_answer": test_case.expected_answer,
        "generated_answer": pipeline_result.get("answer"),
        "passed": passed,
        "failure_reasons": failure_reasons,
        "required_document_hit": required_document_hit,
        "answer_score": answer_score,
        "retrieval_score": float(metrics.get("retrieval_score", 0.0)),
        "citation_coverage": float(metrics.get("citation_coverage", 0.0)),
        "grounding_score": float(metrics.get("grounding_score", 0.0)),
        "unsupported_claims_count": int(
            metrics.get("unsupported_claims_count", 0)
        ),
        "latency_ms": int(metrics.get("latency_ms", 0)),
        "answer_generation_strategy": pipeline_result.get(
            "answer_generation_strategy"
        ),
        "verification_strategy": verification_report.get("strategy"),
    }


def run_dataset_evaluation(
    db: Session,
    dataset: EvalDataset,
    top_k: int,
    vector_weight: float,
    keyword_weight: float,
    use_query_rewrite: bool,
    max_rewritten_queries: int,
    prompt_version_id: str | None,
    thresholds: dict,
) -> dict:
    test_cases = list(dataset.test_cases)

    if not test_cases:
        raise ValueError("Evaluation dataset has no test cases")

    selected_prompt = resolve_prompt_version(
        db=db,
        prompt_version_id=prompt_version_id,
    )

    aggregate_rag_run = create_dataset_rag_run(
        db=db,
        dataset=dataset,
        prompt_version_id=selected_prompt["id"],
    )

    case_results: list[dict] = []

    for test_case in test_cases:
        try:
            case_result = run_single_test_case(
                db=db,
                aggregate_rag_run=aggregate_rag_run,
                test_case=test_case,
                top_k=top_k,
                vector_weight=vector_weight,
                keyword_weight=keyword_weight,
                use_query_rewrite=use_query_rewrite,
                max_rewritten_queries=max_rewritten_queries,
                prompt_version_id=selected_prompt["id"],
                thresholds=thresholds,
            )

        except Exception as error:
            case_result = {
                "test_case_id": test_case.id,
                "child_rag_run_id": None,
                "question": test_case.question,
                "expected_answer": test_case.expected_answer,
                "generated_answer": None,
                "passed": False,
                "failure_reasons": [
                    f"Pipeline execution failed: {str(error)}"
                ],
                "required_document_hit": False,
                "answer_score": 0.0,
                "retrieval_score": 0.0,
                "citation_coverage": 0.0,
                "grounding_score": 0.0,
                "unsupported_claims_count": 1,
                "latency_ms": 0,
                "answer_generation_strategy": None,
                "verification_strategy": None,
            }

        case_results.append(case_result)

    total_cases = len(case_results)

    passed_cases = sum(
        1
        for result in case_results
        if result["passed"]
    )

    failed_cases = total_cases - passed_cases
    pass_rate = passed_cases / total_cases

    avg_answer_score = sum(
        result["answer_score"]
        for result in case_results
    ) / total_cases

    avg_retrieval_score = sum(
        result["retrieval_score"]
        for result in case_results
    ) / total_cases

    avg_citation_coverage = sum(
        result["citation_coverage"]
        for result in case_results
    ) / total_cases

    avg_grounding_score = sum(
        result["grounding_score"]
        for result in case_results
    ) / total_cases

    total_unsupported_claims = sum(
        result["unsupported_claims_count"]
        for result in case_results
    )

    avg_latency_ms = sum(
        result["latency_ms"]
        for result in case_results
    ) / total_cases

    quality_gate_passed = (
        pass_rate >= thresholds["min_pass_rate"]
        and avg_retrieval_score >= thresholds["min_retrieval_score"]
        and avg_grounding_score >= thresholds["min_grounding_score"]
        and avg_citation_coverage >= thresholds["min_citation_coverage"]
        and total_unsupported_claims <= thresholds["max_unsupported_claims"]
    )

    aggregate_rag_run.status = "completed"
    aggregate_rag_run.total_cases = total_cases
    aggregate_rag_run.passed_cases = passed_cases
    aggregate_rag_run.failed_cases = failed_cases
    aggregate_rag_run.pass_rate = round(pass_rate, 4)
    aggregate_rag_run.avg_retrieval_score = round(avg_retrieval_score, 4)
    aggregate_rag_run.avg_grounding_score = round(avg_grounding_score, 4)
    aggregate_rag_run.avg_citation_coverage = round(
        avg_citation_coverage,
        4,
    )
    aggregate_rag_run.avg_latency_ms = round(avg_latency_ms, 2)
    aggregate_rag_run.total_unsupported_claims = total_unsupported_claims
    aggregate_rag_run.quality_gate_passed = quality_gate_passed
    aggregate_rag_run.completed_at = datetime.now(timezone.utc)

    db.add(aggregate_rag_run)
    db.commit()
    db.refresh(aggregate_rag_run)

    return {
        "rag_run_id": aggregate_rag_run.id,
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "prompt_version_id": selected_prompt["id"],
        "prompt_version_name": selected_prompt["name"],
        "status": aggregate_rag_run.status,
        "quality_gate_passed": quality_gate_passed,
        "total_cases": total_cases,
        "passed_cases": passed_cases,
        "failed_cases": failed_cases,
        "pass_rate": round(pass_rate, 4),
        "avg_answer_score": round(avg_answer_score, 4),
        "avg_retrieval_score": round(avg_retrieval_score, 4),
        "avg_citation_coverage": round(avg_citation_coverage, 4),
        "avg_grounding_score": round(avg_grounding_score, 4),
        "total_unsupported_claims": total_unsupported_claims,
        "avg_latency_ms": round(avg_latency_ms, 2),
        "thresholds": thresholds,
        "results": case_results,
    }


def calculate_prompt_quality_score(run: dict) -> float:
    """
    Weighted quality score used only for prompt comparison.

    Latency remains visible separately because a prompt may improve
    quality while becoming slower.
    """
    score = (
        float(run["pass_rate"]) * 0.35
        + float(run["avg_answer_score"]) * 0.20
        + float(run["avg_grounding_score"]) * 0.25
        + float(run["avg_citation_coverage"]) * 0.15
        + min(float(run["avg_retrieval_score"]), 1.0) * 0.05
    )

    return round(score, 4)


def compare_prompt_versions(
    db: Session,
    dataset: EvalDataset,
    prompt_version_a_id: str,
    prompt_version_b_id: str,
    top_k: int,
    vector_weight: float,
    keyword_weight: float,
    use_query_rewrite: bool,
    max_rewritten_queries: int,
    thresholds: dict,
) -> dict:
    if prompt_version_a_id == prompt_version_b_id:
        raise ValueError("Choose two different prompt versions for comparison")

    prompt_a = resolve_prompt_version(
        db=db,
        prompt_version_id=prompt_version_a_id,
    )

    prompt_b = resolve_prompt_version(
        db=db,
        prompt_version_id=prompt_version_b_id,
    )

    run_a = run_dataset_evaluation(
        db=db,
        dataset=dataset,
        top_k=top_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        use_query_rewrite=use_query_rewrite,
        max_rewritten_queries=max_rewritten_queries,
        prompt_version_id=prompt_a["id"],
        thresholds=thresholds,
    )

    run_b = run_dataset_evaluation(
        db=db,
        dataset=dataset,
        top_k=top_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        use_query_rewrite=use_query_rewrite,
        max_rewritten_queries=max_rewritten_queries,
        prompt_version_id=prompt_b["id"],
        thresholds=thresholds,
    )

    score_a = calculate_prompt_quality_score(run_a)
    score_b = calculate_prompt_quality_score(run_b)

    if score_b > score_a:
        winner = "prompt_b"

    elif score_a > score_b:
        winner = "prompt_a"

    elif run_b["avg_latency_ms"] < run_a["avg_latency_ms"]:
        winner = "prompt_b_latency_tiebreaker"

    elif run_a["avg_latency_ms"] < run_b["avg_latency_ms"]:
        winner = "prompt_a_latency_tiebreaker"

    else:
        winner = "tie"

    metric_deltas = {
        "pass_rate": round(run_b["pass_rate"] - run_a["pass_rate"], 4),
        "avg_answer_score": round(
            run_b["avg_answer_score"] - run_a["avg_answer_score"],
            4,
        ),
        "avg_retrieval_score": round(
            run_b["avg_retrieval_score"] - run_a["avg_retrieval_score"],
            4,
        ),
        "avg_citation_coverage": round(
            run_b["avg_citation_coverage"] - run_a["avg_citation_coverage"],
            4,
        ),
        "avg_grounding_score": round(
            run_b["avg_grounding_score"] - run_a["avg_grounding_score"],
            4,
        ),
        "avg_latency_ms": round(
            run_b["avg_latency_ms"] - run_a["avg_latency_ms"],
            2,
        ),
    }

    generation_strategies_a = {
        result.get("answer_generation_strategy")
        for result in run_a["results"]
        if result.get("answer_generation_strategy")
    }

    generation_strategies_b = {
        result.get("answer_generation_strategy")
        for result in run_b["results"]
        if result.get("answer_generation_strategy")
    }

    verification_strategies_a = {
        result.get("verification_strategy")
        for result in run_a["results"]
        if result.get("verification_strategy")
    }

    verification_strategies_b = {
        result.get("verification_strategy")
        for result in run_b["results"]
        if result.get("verification_strategy")
    }

    same_generation_strategy = (
        len(generation_strategies_a) == 1
        and len(generation_strategies_b) == 1
        and generation_strategies_a == generation_strategies_b
    )

    same_verification_strategy = (
        len(verification_strategies_a) == 1
        and len(verification_strategies_b) == 1
        and verification_strategies_a == verification_strategies_b
    )

    both_runs_used_llm_prompts = (
        generation_strategies_a == {"llm_citation_first"}
        and generation_strategies_b == {"llm_citation_first"}
    )

    comparison_valid = (
        same_generation_strategy
        and same_verification_strategy
        and both_runs_used_llm_prompts
    )

    comparison_warning = None

    if not same_generation_strategy or not same_verification_strategy:
        comparison_warning = (
            "Prompt runs used different answer-generation or verification "
            "strategies. The comparison completed successfully, but it is not "
            "a controlled prompt-only A/B test. Rerun when the LLM provider "
            "is consistently available."
        )

    elif not both_runs_used_llm_prompts:
        comparison_warning = (
            "Both prompt runs used extractive fallback answer generation. "
            "The selected prompts were not used to generate answers, so this "
            "result is not a valid prompt-only A/B comparison. Rerun when the "
            "LLM provider is available."
        )

    comparison_record = PromptComparison(
        dataset_id=dataset.id,
        prompt_version_a_id=prompt_a["id"],
        prompt_version_a_name=prompt_a["name"],
        prompt_version_b_id=prompt_b["id"],
        prompt_version_b_name=prompt_b["name"],
        run_a_id=run_a["rag_run_id"],
        run_b_id=run_b["rag_run_id"],
        winner=winner,
        score_a=score_a,
        score_b=score_b,
        comparison_valid=comparison_valid,
        comparison_warning=comparison_warning,
        metric_deltas_json=json.dumps(metric_deltas),
        report_json="{}",
    )

    db.add(comparison_record)
    db.commit()
    db.refresh(comparison_record)

    response = {
        "comparison_id": comparison_record.id,
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "prompt_version_a_id": prompt_a["id"],
        "prompt_version_a_name": prompt_a["name"],
        "prompt_version_b_id": prompt_b["id"],
        "prompt_version_b_name": prompt_b["name"],
        "winner": winner,
        "score_a": score_a,
        "score_b": score_b,
        "comparison_valid": comparison_valid,
        "comparison_warning": comparison_warning,
        "metric_deltas_b_minus_a": metric_deltas,
        "run_a": run_a,
        "run_b": run_b,
    }

    comparison_record.report_json = json.dumps(response, default=str)

    db.add(comparison_record)
    db.commit()
    db.refresh(comparison_record)

    return response