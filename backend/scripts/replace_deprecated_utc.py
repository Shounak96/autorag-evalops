from pathlib import Path


MODEL_FILES = [
    Path("app/models/agent_step.py"),
    Path("app/models/document.py"),
    Path("app/models/document_chunk.py"),
    Path("app/models/eval_dataset.py"),
    Path("app/models/eval_test_case.py"),
    Path("app/models/prompt_version.py"),
    Path("app/models/rag_run.py"),
    Path("app/models/rag_run_result.py"),
]


def update_file(file_path: Path) -> None:
    original_text = file_path.read_text(encoding="utf-8")

    updated_text = original_text.replace(
        "from datetime import datetime",
        "from datetime import datetime, timezone",
    )

    updated_text = updated_text.replace(
        "default=datetime.utcnow,",
        "default=lambda: datetime.now(timezone.utc),",
    )

    if updated_text == original_text:
        print(f"[SKIP] {file_path}: no changes required")
        return

    file_path.write_text(
        updated_text,
        encoding="utf-8",
    )

    print(f"[UPDATED] {file_path}")


def main() -> None:
    for file_path in MODEL_FILES:
        if not file_path.exists():
            print(f"[MISSING] {file_path}")
            continue

        update_file(file_path)

    print("")
    print("Deprecated UTC cleanup complete.")


if __name__ == "__main__":
    main()