import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def read_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value:
        print(f"[ERROR] Missing required environment variable: {name}")
        sys.exit(2)

    return value


def read_float_env(name: str, default: float) -> float:
    raw_value = os.getenv(name, "").strip()

    if not raw_value:
        return default

    try:
        return float(raw_value)
    except ValueError:
        print(f"[ERROR] {name} must be a valid number")
        sys.exit(2)


def read_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name, "").strip()

    if not raw_value:
        return default

    try:
        return int(raw_value)
    except ValueError:
        print(f"[ERROR] {name} must be a valid integer")
        sys.exit(2)


def read_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name, "").strip().lower()

    if not raw_value:
        return default

    if raw_value in {"true", "1", "yes", "y"}:
        return True

    if raw_value in {"false", "0", "no", "n"}:
        return False

    print(f"[ERROR] {name} must be true or false")
    sys.exit(2)


def save_report(report: dict) -> Path:
    artifacts_directory = Path("artifacts")
    artifacts_directory.mkdir(parents=True, exist_ok=True)

    report_path = artifacts_directory / "ci-quality-gate-report.json"

    report_path.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    return report_path


def main() -> None:
    api_base_url = read_required_env(
        "AUTORAG_API_BASE_URL"
    ).rstrip("/")

    ci_gate_token = read_required_env(
        "AUTORAG_CI_GATE_TOKEN"
    )

    dataset_id = read_required_env(
        "AUTORAG_DATASET_ID"
    )

    prompt_version_id = os.getenv(
        "AUTORAG_PROMPT_VERSION_ID",
        "",
    ).strip()

    payload = {
        "top_k": read_int_env("AUTORAG_TOP_K", 5),
        "vector_weight": read_float_env(
            "AUTORAG_VECTOR_WEIGHT",
            0.7,
        ),
        "keyword_weight": read_float_env(
            "AUTORAG_KEYWORD_WEIGHT",
            0.3,
        ),
        "use_query_rewrite": read_bool_env(
            "AUTORAG_USE_QUERY_REWRITE",
            True,
        ),
        "max_rewritten_queries": read_int_env(
            "AUTORAG_MAX_REWRITTEN_QUERIES",
            4,
        ),
        "prompt_version_id": prompt_version_id or None,
        "thresholds": {
            "min_pass_rate": read_float_env(
                "AUTORAG_MIN_PASS_RATE",
                0.8,
            ),
            "min_retrieval_score": read_float_env(
                "AUTORAG_MIN_RETRIEVAL_SCORE",
                0.2,
            ),
            "min_grounding_score": read_float_env(
                "AUTORAG_MIN_GROUNDING_SCORE",
                0.75,
            ),
            "min_citation_coverage": read_float_env(
                "AUTORAG_MIN_CITATION_COVERAGE",
                1.0,
            ),
            "min_answer_score": read_float_env(
                "AUTORAG_MIN_ANSWER_SCORE",
                0.6,
            ),
            "max_unsupported_claims": read_int_env(
                "AUTORAG_MAX_UNSUPPORTED_CLAIMS",
                0,
            ),
            "max_avg_latency_ms": read_float_env(
                "AUTORAG_MAX_AVG_LATENCY_MS",
                15000,
            ),
        },

        "source": "ci",
        "branch_name": os.getenv("GITHUB_REF_NAME"),
        "commit_sha": os.getenv("GITHUB_SHA"),
        "trigger_type": os.getenv("GITHUB_EVENT_NAME"),
        "external_run_url": (
            f"{os.getenv('GITHUB_SERVER_URL')}/"
            f"{os.getenv('GITHUB_REPOSITORY')}/actions/runs/"
            f"{os.getenv('GITHUB_RUN_ID')}"
            if os.getenv("GITHUB_SERVER_URL")
            and os.getenv("GITHUB_REPOSITORY")
            and os.getenv("GITHUB_RUN_ID")
            else None
        ),
    }

    endpoint = (
        f"{api_base_url}/eval/datasets/"
        f"{dataset_id}/ci-gate"
    )

    request = Request(
        url=endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-CI-GATE-TOKEN": ci_gate_token,
        },
        method="POST",
    )

    print("================================================")
    print("AutoRAG EvalOps CI Quality Gate")
    print("================================================")
    print(f"Endpoint: {endpoint}")
    print(f"Dataset ID: {dataset_id}")
    print(
        "Prompt version: "
        f"{prompt_version_id or 'database default'}"
    )
    print(
        "Commit SHA: "
        f"{os.getenv('GITHUB_SHA', 'local-run')}"
    )
    print("Running regression evaluation...")
    print("")

    try:
        with urlopen(request, timeout=900) as response:
            response_body = response.read().decode("utf-8")

        report = json.loads(response_body)

    except HTTPError as error:
        error_body = error.read().decode(
            "utf-8",
            errors="replace",
        )

        print(
            f"[ERROR] Backend returned HTTP {error.code}"
        )
        print(error_body)
        sys.exit(2)

    except URLError as error:
        print(f"[ERROR] Could not reach backend: {error}")
        sys.exit(2)

    except json.JSONDecodeError:
        print("[ERROR] Backend returned invalid JSON")
        sys.exit(2)

    report_path = save_report(report)

    print("================================================")
    print("Quality-Gate Report")
    print("================================================")
    print(f"Run ID: {report.get('rag_run_id')}")
    print(f"Dataset: {report.get('dataset_name')}")
    print(
        "Prompt: "
        f"{report.get('prompt_version_name')}"
    )
    print(
        "Passed cases: "
        f"{report.get('passed_cases')}/"
        f"{report.get('total_cases')}"
    )
    print(
        "Pass rate: "
        f"{float(report.get('pass_rate', 0)) * 100:.1f}%"
    )
    print(
        "Average retrieval score: "
        f"{float(report.get('avg_retrieval_score', 0)):.4f}"
    )
    print(
        "Average grounding score: "
        f"{float(report.get('avg_grounding_score', 0)):.4f}"
    )
    print(
        "Average citation coverage: "
        f"{float(report.get('avg_citation_coverage', 0)):.4f}"
    )
    print(
        "Unsupported claims: "
        f"{report.get('total_unsupported_claims')}"
    )
    print(
        "Average latency: "
        f"{float(report.get('avg_latency_ms', 0)):.2f} ms"
    )
    print(f"Saved report: {report_path}")
    print("================================================")

    quality_gate_passed = bool(
        report.get("quality_gate_passed")
    )

    if not quality_gate_passed:
        print(
            "[FAIL] RAG quality gate failed. "
            "Deployment must be blocked."
        )

        failed_results = [
            result
            for result in report.get("results", [])
            if not result.get("passed")
        ]

        for index, result in enumerate(
            failed_results,
            start=1,
        ):
            print("")
            print(f"Failed case {index}:")
            print(
                f"Question: {result.get('question')}"
            )

            for reason in result.get(
                "failure_reasons",
                [],
            ):
                print(f"- {reason}")

        sys.exit(1)

    print(
        "[PASS] RAG quality gate passed. "
        "Deployment may continue."
    )

    sys.exit(0)


if __name__ == "__main__":
    main()