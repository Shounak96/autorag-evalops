import hashlib
from pathlib import Path

from sqlalchemy.orm import Session

from app.db import engine
from app.models.document import Document


def calculate_sha256(source_path: str) -> str:
    sha256 = hashlib.sha256()

    with Path(source_path).open("rb") as file:
        while True:
            chunk = file.read(1024 * 1024)

            if not chunk:
                break

            sha256.update(chunk)

    return sha256.hexdigest()


def main() -> None:
    updated_count = 0
    skipped_count = 0
    missing_count = 0

    with Session(engine) as db:
        documents = db.query(Document).all()

        for document in documents:
            if document.content_hash:
                print(
                    f"[SKIP] {document.file_name}: "
                    "hash already exists"
                )
                skipped_count += 1
                continue

            if not document.source_path:
                print(
                    f"[MISSING] {document.file_name}: "
                    "source_path is empty"
                )
                missing_count += 1
                continue

            source_path = Path(document.source_path)

            if not source_path.exists():
                print(
                    f"[MISSING] {document.file_name}: "
                    f"{source_path}"
                )
                missing_count += 1
                continue

            document.content_hash = calculate_sha256(
                document.source_path
            )

            db.add(document)

            print(
                f"[UPDATED] {document.file_name}: "
                f"{document.content_hash}"
            )

            updated_count += 1

        db.commit()

    print("")
    print("========================================")
    print("Document hash backfill complete")
    print("========================================")
    print(f"Updated: {updated_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Missing source files: {missing_count}")


if __name__ == "__main__":
    main()