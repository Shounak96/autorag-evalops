from dataclasses import dataclass


@dataclass
class TextChunk:
    chunk_index: int
    page_number: int | None
    content: str


def split_text_with_overlap(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[str]:
    cleaned_text = " ".join(text.split())

    if not cleaned_text:
        return []

    chunks: list[str] = []
    start = 0

    while start < len(cleaned_text):
        end = start + chunk_size
        chunk = cleaned_text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(cleaned_text):
            break

        start = end - overlap

    return chunks


def create_chunks_from_pages(
    pages: list[dict],
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[TextChunk]:
    all_chunks: list[TextChunk] = []
    chunk_index = 0

    for page in pages:
        page_number = page.get("page_number")
        text = page.get("text", "")

        page_chunks = split_text_with_overlap(
            text=text,
            chunk_size=chunk_size,
            overlap=overlap,
        )

        for chunk_content in page_chunks:
            all_chunks.append(
                TextChunk(
                    chunk_index=chunk_index,
                    page_number=page_number,
                    content=chunk_content,
                )
            )
            chunk_index += 1

    return all_chunks