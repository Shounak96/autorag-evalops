from app.services.evaluation_runner_service import (
    build_failure_reasons,
    calculate_expected_answer_score,
    check_required_document_hit,
)


THRESHOLDS = {
    "min_pass_rate": 0.8,
    "min_retrieval_score": 0.2,
    "min_grounding_score": 0.75,
    "min_citation_coverage": 1.0,
    "min_answer_score": 0.6,
    "max_unsupported_claims": 0,
}


def test_expected_answer_score_for_matching_answer():
    score = calculate_expected_answer_score(
        expected_answer="Deployment is blocked when quality drops.",
        generated_answer="When quality drops, deployment is blocked.",
    )

    assert score == 1.0


def test_required_document_is_detected_in_citations():
    result = check_required_document_hit(
        required_document_name="rag_test.txt",
        citations=[
            {
                "file_name": "rag_test.txt",
            }
        ],
        retrieved_chunks=[],
    )

    assert result is True


def test_quality_case_passes_when_metrics_meet_thresholds():
    reasons = build_failure_reasons(
        required_document_hit=True,
        answer_score=0.9,
        retrieval_score=0.7,
        citation_coverage=1.0,
        grounding_score=1.0,
        unsupported_claims_count=0,
        thresholds=THRESHOLDS,
    )

    assert reasons == []


def test_quality_case_fails_for_unsupported_claims():
    reasons = build_failure_reasons(
        required_document_hit=True,
        answer_score=0.9,
        retrieval_score=0.7,
        citation_coverage=1.0,
        grounding_score=1.0,
        unsupported_claims_count=2,
        thresholds=THRESHOLDS,
    )

    assert (
        "Unsupported claim count exceeds the configured threshold."
        in reasons
    )


def test_quality_case_reports_all_failed_metrics():
    reasons = build_failure_reasons(
        required_document_hit=False,
        answer_score=0.2,
        retrieval_score=0.1,
        citation_coverage=0.5,
        grounding_score=0.4,
        unsupported_claims_count=1,
        thresholds=THRESHOLDS,
    )

    assert len(reasons) == 6