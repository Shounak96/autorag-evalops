import csv
from pathlib import Path

import fitz


def extract_text_from_txt_or_md(file_path: str) -> list[dict]:
    path = Path(file_path)

    text = path.read_text(encoding="utf-8", errors="ignore")

    return [
        {
            "page_number": None,
            "text": text,
        }
    ]


def extract_text_from_csv(file_path: str) -> list[dict]:
    rows: list[str] = []

    with open(file_path, "r", encoding="utf-8", errors="ignore", newline="") as file:
        reader = csv.reader(file)
        for row in reader:
            rows.append(" | ".join(row))

    return [
        {
            "page_number": None,
            "text": "\n".join(rows),
        }
    ]


def extract_text_from_pdf(file_path: str) -> list[dict]:
    pages: list[dict] = []

    pdf_document = fitz.open(file_path)

    for page_index, page in enumerate(pdf_document):
        text = page.get_text("text")

        if text.strip():
            pages.append(
                {
                    "page_number": page_index + 1,
                    "text": text,
                }
            )

    pdf_document.close()

    return pages


def extract_text(file_path: str, file_type: str) -> list[dict]:
    file_type = file_type.lower()

    if file_type in {"txt", "md"}:
        return extract_text_from_txt_or_md(file_path)

    if file_type == "csv":
        return extract_text_from_csv(file_path)

    if file_type == "pdf":
        return extract_text_from_pdf(file_path)

    raise ValueError(f"Unsupported file type for extraction: {file_type}")