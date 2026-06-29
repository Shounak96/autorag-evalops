from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
import hmac
from app.db import get_db
from app.schemas.eval import (
    DeleteEvalTestCaseResponse,
    EvalDatasetCreateRequest,
    EvalDatasetDetailResponse,
    EvalDatasetListResponse,
    EvalDatasetResponse,
    EvalDatasetRunRequest,
    EvalDatasetRunSummary,
    EvalTestCaseCreateRequest,
    EvalTestCaseListResponse,
    EvalTestCaseResponse,
    PromptComparisonRequest,
    PromptComparisonResponse,
    EvalRunDetailResponse,
    EvalRunListResponse,
    EvalRunResultsResponse,
    PromptComparisonDetailResponse,
    PromptComparisonListResponse,
)

from app.services.eval_service import (
    create_eval_dataset,
    create_eval_test_case,
    delete_eval_test_case,
    get_eval_dataset_by_id,
    get_eval_datasets,
    get_eval_test_case_by_id,
    get_eval_test_cases,
    serialize_dataset,
    serialize_test_case,
)

from app.services.evaluation_runner_service import (
    compare_prompt_versions,
    run_dataset_evaluation,
)

from app.services.eval_history_service import (
    get_eval_run_by_id,
    get_eval_runs,
    get_prompt_comparison_by_id,
    get_prompt_comparisons,
    get_run_results,
    serialize_prompt_comparison,
    serialize_run,
    serialize_run_result,
)
from app.core.config import settings

router = APIRouter(prefix="/eval", tags=["Evaluation Datasets"])


@router.post(
    "/datasets",
    response_model=EvalDatasetResponse,
    status_code=201,
)
def create_dataset(
    request: EvalDatasetCreateRequest,
    db: Session = Depends(get_db),
):
    dataset = create_eval_dataset(
        db=db,
        name=request.name,
        description=request.description,
    )

    return serialize_dataset(dataset)


@router.get(
    "/datasets",
    response_model=EvalDatasetListResponse,
)
def list_datasets(
    db: Session = Depends(get_db),
):
    datasets = get_eval_datasets(db)

    return {
        "datasets": [
            serialize_dataset(dataset)
            for dataset in datasets
        ],
        "count": len(datasets),
    }


@router.get(
    "/datasets/{dataset_id}",
    response_model=EvalDatasetDetailResponse,
)
def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    return serialize_dataset(
        dataset=dataset,
        include_test_cases=True,
    )


@router.post(
    "/datasets/{dataset_id}/test-cases",
    response_model=EvalTestCaseResponse,
    status_code=201,
)
def create_test_case(
    dataset_id: str,
    request: EvalTestCaseCreateRequest,
    db: Session = Depends(get_db),
):
    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    test_case = create_eval_test_case(
        db=db,
        dataset_id=dataset_id,
        question=request.question,
        expected_answer=request.expected_answer,
        required_document_name=request.required_document_name,
        tags=request.tags,
    )

    return serialize_test_case(test_case)


@router.get(
    "/datasets/{dataset_id}/test-cases",
    response_model=EvalTestCaseListResponse,
)
def list_test_cases(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    test_cases = get_eval_test_cases(
        db=db,
        dataset_id=dataset_id,
    )

    return {
        "test_cases": [
            serialize_test_case(test_case)
            for test_case in test_cases
        ],
        "count": len(test_cases),
    }


@router.delete(
    "/test-cases/{test_case_id}",
    response_model=DeleteEvalTestCaseResponse,
)
def delete_test_case(
    test_case_id: str,
    db: Session = Depends(get_db),
):
    test_case = get_eval_test_case_by_id(
        db=db,
        test_case_id=test_case_id,
    )

    if not test_case:
        raise HTTPException(
            status_code=404,
            detail="Evaluation test case not found",
        )

    delete_eval_test_case(
        db=db,
        test_case=test_case,
    )

    return {
        "message": "Evaluation test case deleted successfully",
        "deleted_test_case_id": test_case_id,
    }

@router.post(
    "/datasets/{dataset_id}/run",
    response_model=EvalDatasetRunSummary,
)
def run_dataset(
    dataset_id: str,
    request: EvalDatasetRunRequest,
    db: Session = Depends(get_db),
):
    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    try:
        return run_dataset_evaluation(
            db=db,
            dataset=dataset,
            top_k=request.top_k,
            vector_weight=request.vector_weight,
            keyword_weight=request.keyword_weight,
            use_query_rewrite=request.use_query_rewrite,
            max_rewritten_queries=request.max_rewritten_queries,
            prompt_version_id=request.prompt_version_id,
            thresholds=request.thresholds.model_dump(),
            source=request.source,
            branch_name=request.branch_name,
            commit_sha=request.commit_sha,
            trigger_type=request.trigger_type,
            external_run_url=request.external_run_url,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset evaluation failed: {str(error)}",
        )
    

@router.post(
    "/datasets/{dataset_id}/compare-prompts",
    response_model=PromptComparisonResponse,
)
def compare_prompts(
    dataset_id: str,
    request: PromptComparisonRequest,
    db: Session = Depends(get_db),
):
    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    try:
        return compare_prompt_versions(
            db=db,
            dataset=dataset,
            prompt_version_a_id=request.prompt_version_a_id,
            prompt_version_b_id=request.prompt_version_b_id,
            top_k=request.top_k,
            vector_weight=request.vector_weight,
            keyword_weight=request.keyword_weight,
            use_query_rewrite=request.use_query_rewrite,
            max_rewritten_queries=request.max_rewritten_queries,
            thresholds=request.thresholds.model_dump(),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Prompt comparison failed: {str(error)}",
        )
    

@router.get(
    "/runs",
    response_model=EvalRunListResponse,
)
def list_eval_runs(
    dataset_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    runs = get_eval_runs(
        db=db,
        dataset_id=dataset_id,
        limit=limit,
    )

    return {
        "runs": [
            serialize_run(
                db=db,
                rag_run=rag_run,
            )
            for rag_run in runs
        ],
        "count": len(runs),
    }


@router.get(
    "/datasets/{dataset_id}/runs",
    response_model=EvalRunListResponse,
)
def list_dataset_runs(
    dataset_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    runs = get_eval_runs(
        db=db,
        dataset_id=dataset_id,
        limit=limit,
    )

    return {
        "runs": [
            serialize_run(
                db=db,
                rag_run=rag_run,
            )
            for rag_run in runs
        ],
        "count": len(runs),
    }


@router.get(
    "/runs/{rag_run_id}",
    response_model=EvalRunDetailResponse,
)
def get_eval_run_detail(
    rag_run_id: str,
    db: Session = Depends(get_db),
):
    rag_run = get_eval_run_by_id(
        db=db,
        rag_run_id=rag_run_id,
    )

    if not rag_run:
        raise HTTPException(
            status_code=404,
            detail="Evaluation run not found",
        )

    return serialize_run(
        db=db,
        rag_run=rag_run,
        include_results=True,
    )


@router.get(
    "/runs/{rag_run_id}/results",
    response_model=EvalRunResultsResponse,
)
def list_eval_run_results(
    rag_run_id: str,
    db: Session = Depends(get_db),
):
    rag_run = get_eval_run_by_id(
        db=db,
        rag_run_id=rag_run_id,
    )

    if not rag_run:
        raise HTTPException(
            status_code=404,
            detail="Evaluation run not found",
        )

    results = get_run_results(
        db=db,
        rag_run_id=rag_run_id,
    )

    return {
        "rag_run_id": rag_run_id,
        "results": [
            serialize_run_result(result)
            for result in results
        ],
        "count": len(results),
    }


@router.get(
    "/prompt-comparisons",
    response_model=PromptComparisonListResponse,
)
def list_prompt_comparisons(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    comparisons = get_prompt_comparisons(
        db=db,
        limit=limit,
    )

    return {
        "comparisons": [
            serialize_prompt_comparison(
                db=db,
                comparison=comparison,
            )
            for comparison in comparisons
        ],
        "count": len(comparisons),
    }


@router.get(
    "/prompt-comparisons/{comparison_id}",
    response_model=PromptComparisonDetailResponse,
)
def get_prompt_comparison_detail(
    comparison_id: str,
    db: Session = Depends(get_db),
):
    comparison = get_prompt_comparison_by_id(
        db=db,
        comparison_id=comparison_id,
    )

    if not comparison:
        raise HTTPException(
            status_code=404,
            detail="Prompt comparison not found",
        )

    return serialize_prompt_comparison(
        db=db,
        comparison=comparison,
        include_report=True,
    )


@router.post(
    "/datasets/{dataset_id}/ci-gate",
    response_model=EvalDatasetRunSummary,
)
def run_ci_quality_gate(
    dataset_id: str,
    request: EvalDatasetRunRequest,
    x_ci_gate_token: str | None = Header(
        default=None,
        alias="X-CI-GATE-TOKEN",
    ),
    db: Session = Depends(get_db),
):
    """
    Protected CI/CD endpoint.

    GitHub Actions calls this route before deployment.
    The workflow fails when the returned quality gate is false.
    """
    if not settings.CI_GATE_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="CI gate token is not configured on the backend",
        )

    supplied_token = x_ci_gate_token or ""

    if not hmac.compare_digest(
        supplied_token,
        settings.CI_GATE_TOKEN,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid CI gate token",
        )

    dataset = get_eval_dataset_by_id(
        db=db,
        dataset_id=dataset_id,
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Evaluation dataset not found",
        )

    try:
        return run_dataset_evaluation(
            db=db,
            dataset=dataset,
            top_k=request.top_k,
            vector_weight=request.vector_weight,
            keyword_weight=request.keyword_weight,
            use_query_rewrite=request.use_query_rewrite,
            max_rewritten_queries=request.max_rewritten_queries,
            prompt_version_id=request.prompt_version_id,
            thresholds=request.thresholds.model_dump(),
            source=request.source,
            branch_name=request.branch_name,
            commit_sha=request.commit_sha,
            trigger_type=request.trigger_type,
            external_run_url=request.external_run_url,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"CI quality-gate execution failed: {str(error)}",
        )