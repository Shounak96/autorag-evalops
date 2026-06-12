import json
import re
from functools import lru_cache
import logging
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMUnavailableError(Exception):
    pass


@lru_cache(maxsize=1)
def get_genai_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise LLMUnavailableError("GEMINI_API_KEY is missing in backend/.env")

    return genai.Client(api_key=settings.GEMINI_API_KEY)


def clean_json_text(text: str) -> str:
    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "")
    cleaned = cleaned.replace("```", "")
    cleaned = cleaned.strip()
    return cleaned


def extract_json_array(text: str) -> list[str]:
    cleaned = clean_json_text(text)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[[\s\S]*\]", cleaned)

    if not match:
        return []

    try:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        return []

    return []


def build_rule_based_rewrite_queries(question: str, max_queries: int = 4) -> list[str]:
    important_terms = [
        "retrieval accuracy",
        "citation coverage",
        "grounding score",
        "unsupported claims",
        "latency",
        "RAG evaluation",
        "CI/CD quality gate",
        "deployment threshold",
    ]

    queries = [
        question,
        f"{question} {' '.join(important_terms[:4])}",
        "RAG evaluation metrics retrieval accuracy citation coverage grounding latency",
        "CI/CD quality gate deployment threshold unsupported claims RAG pipeline",
    ]

    deduped: list[str] = []

    for query in queries:
        normalized = " ".join(query.split())
        if normalized and normalized.lower() not in {item.lower() for item in deduped}:
            deduped.append(normalized)

    return deduped[:max_queries]


def rewrite_query_with_llm(question: str, max_queries: int = 4) -> list[str]:
    client = get_genai_client()

    prompt = f"""
Generate exactly {max_queries} search queries for document retrieval.

User question:
{question}

Rules:
- Return only a JSON array.
- No explanation.
- No markdown.
- No introduction.
- Each query should be short.
- Queries should cover RAG evaluation metrics, citations, grounding, unsupported claims, latency, and CI/CD quality gates when relevant.

Return exactly this format:
["query 1", "query 2", "query 3", "query 4"]
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_REWRITE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=1024,
            ),
        )

        raw_text = response.text or ""

        llm_queries = extract_json_array(raw_text)

    except Exception as error:
        logger.warning(
        "Gemini query rewrite unavailable; using deterministic fallback. "
        "Error type: %s",
        type(error).__name__,
        )
        llm_queries = []

    fallback_queries = build_rule_based_rewrite_queries(
        question=question,
        max_queries=max_queries,
    )

    combined = [question] + llm_queries + fallback_queries

    deduped: list[str] = []

    for query in combined:
        normalized = " ".join(query.split())

        if normalized and normalized.lower() not in {item.lower() for item in deduped}:
            deduped.append(normalized)

    return deduped[:max_queries]

def build_labeled_context(ranked_chunks: list[dict]) -> str:
    """
    Converts retrieved chunks into labeled context blocks.

    Example:
    [S1] file=policy.pdf; page=2; chunk=0
    Relevant document content...
    """
    context_blocks: list[str] = []

    for index, chunk in enumerate(ranked_chunks, start=1):
        source_label = f"S{index}"

        file_name = chunk.get("file_name", "unknown")
        page_number = chunk.get("page_number")
        chunk_index = chunk.get("chunk_index", 0)
        content = chunk.get("content", "")

        page_value = page_number if page_number is not None else "N/A"

        context_blocks.append(
            f"[{source_label}] "
            f"file={file_name}; "
            f"page={page_value}; "
            f"chunk={chunk_index}\n"
            f"{content}"
        )

    return "\n\n".join(context_blocks)


def extract_valid_citation_labels(
    answer: str,
    max_sources: int,
) -> list[str]:
    """
    Extracts citation labels such as [S1], [S2] from an LLM answer.
    Only labels that correspond to retrieved sources are accepted.
    """
    raw_labels = re.findall(r"\[S(\d+)\]", answer)

    valid_labels: list[str] = []

    for raw_label in raw_labels:
        source_number = int(raw_label)

        if 1 <= source_number <= max_sources:
            normalized_label = f"S{source_number}"

            if normalized_label not in valid_labels:
                valid_labels.append(normalized_label)

    return valid_labels


def generate_grounded_answer_with_llm(
    question: str,
    ranked_chunks: list[dict],
    system_prompt: str,
    user_prompt_template: str,
) -> tuple[str, list[str]]:
    """
    Generates a document-grounded answer using the selected prompt version.

    Raises an exception if:
    - there are no retrieved chunks,
    - the prompt template is invalid,
    - Gemini returns an empty answer,
    - the answer does not contain valid citations.

    The RAG service will catch failures and use extractive fallback.
    """
    if not ranked_chunks:
        raise ValueError("Cannot generate LLM answer without retrieved chunks")

    client = get_genai_client()

    labeled_context = build_labeled_context(ranked_chunks)

    try:
        user_prompt = user_prompt_template.format(
            question=question,
            context=labeled_context,
        )

    except KeyError as error:
        raise ValueError(
            f"Prompt template contains an unsupported placeholder: {str(error)}"
        )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=1024,
        ),
    )

    answer = (response.text or "").strip()

    if not answer:
        raise ValueError("Gemini returned an empty answer")

    citation_labels = extract_valid_citation_labels(
        answer=answer,
        max_sources=len(ranked_chunks),
    )

    if not citation_labels:
        raise ValueError("Gemini answer did not contain valid source citations")

    return answer, citation_labels

def extract_json_object(text: str) -> dict:
    """
    Extracts a JSON object from an LLM response.

    Supports:
    - pure JSON responses
    - JSON wrapped in markdown code fences
    - responses containing additional text before or after JSON
    """
    cleaned = clean_json_text(text)

    try:
        parsed = json.loads(cleaned)

        if isinstance(parsed, dict):
            return parsed

    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)

    if not match:
        return {}

    try:
        parsed = json.loads(match.group(0))

        if isinstance(parsed, dict):
            return parsed

    except json.JSONDecodeError:
        return {}

    return {}


def normalize_source_labels(
    raw_labels: list,
    max_sources: int,
) -> list[str]:
    """
    Validates labels returned by the LLM.

    Only labels matching retrieved sources are accepted.
    Example:
    S1 is valid only if at least one retrieved chunk exists.
    """
    valid_labels: list[str] = []

    for raw_label in raw_labels:
        label_text = str(raw_label).strip().upper()

        match = re.fullmatch(r"S(\d+)", label_text)

        if not match:
            continue

        source_number = int(match.group(1))

        if 1 <= source_number <= max_sources:
            normalized_label = f"S{source_number}"

            if normalized_label not in valid_labels:
                valid_labels.append(normalized_label)

    return valid_labels


def verify_answer_grounding_with_llm(
    question: str,
    answer: str,
    ranked_chunks: list[dict],
) -> dict:
    """
    Uses Gemini as a claim-level grounding verifier.

    Important:
    The backend recalculates grounding_score and
    unsupported_claims_count instead of trusting model-generated numbers.
    """
    if not ranked_chunks:
        raise ValueError("Cannot verify grounding without retrieved chunks")

    if not answer.strip():
        raise ValueError("Cannot verify an empty answer")

    client = get_genai_client()

    labeled_context = build_labeled_context(ranked_chunks)

    prompt = f"""
You are a strict claim-level grounding verification agent for an advanced RAG system.

Your task:
Evaluate whether each factual claim in the generated answer is supported by the provided document sources.

Classification rules:
- supported:
  The claim is directly supported by one or more sources.
- partially_supported:
  Part of the claim is supported, but some detail is missing or unclear.
- unsupported:
  The claim is not supported by any source.

Strict requirements:
- Split the generated answer into individual factual claims.
- Do not use outside knowledge.
- Use only source labels present in the document sources.
- Return only valid JSON.
- Do not include markdown.
- Do not include explanations outside JSON.

Return exactly this structure:
{{
  "claims": [
    {{
      "claim": "A factual claim from the answer.",
      "status": "supported",
      "source_labels": ["S1"],
      "explanation": "Brief evidence-based explanation."
    }}
  ],
  "summary": "Brief overall verification summary."
}}

User question:
{question}

Generated answer:
{answer}

Document sources:
{labeled_context}
"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=2048,
        ),
    )

    raw_text = response.text or ""

    parsed_report = extract_json_object(raw_text)

    raw_claims = parsed_report.get("claims", [])

    if not isinstance(raw_claims, list) or not raw_claims:
        raise ValueError("Gemini verifier did not return valid claims")

    valid_statuses = {
        "supported",
        "partially_supported",
        "unsupported",
    }

    normalized_claims: list[dict] = []

    for raw_claim in raw_claims:
        if not isinstance(raw_claim, dict):
            continue

        claim_text = str(raw_claim.get("claim", "")).strip()
        status = str(raw_claim.get("status", "")).strip().lower()
        explanation = str(raw_claim.get("explanation", "")).strip()

        if not claim_text:
            continue

        if status not in valid_statuses:
            status = "unsupported"

        raw_source_labels = raw_claim.get("source_labels", [])

        if not isinstance(raw_source_labels, list):
            raw_source_labels = []

        source_labels = normalize_source_labels(
            raw_labels=raw_source_labels,
            max_sources=len(ranked_chunks),
        )

        # A supported claim without evidence labels is unsafe.
        if status == "supported" and not source_labels:
            status = "unsupported"

        normalized_claims.append(
            {
                "claim": claim_text,
                "status": status,
                "source_labels": source_labels,
                "explanation": explanation,
            }
        )

    if not normalized_claims:
        raise ValueError("Gemini verifier returned no usable claims")

    score_weights = {
        "supported": 1.0,
        "partially_supported": 0.5,
        "unsupported": 0.0,
    }

    grounding_score = sum(
        score_weights[claim["status"]]
        for claim in normalized_claims
    ) / len(normalized_claims)

    unsupported_claims_count = sum(
        1
        for claim in normalized_claims
        if claim["status"] == "unsupported"
    )

    summary = str(parsed_report.get("summary", "")).strip()

    if not summary:
        summary = "Claim-level grounding verification completed."

    return {
        "claims": normalized_claims,
        "grounding_score": round(grounding_score, 4),
        "unsupported_claims_count": unsupported_claims_count,
        "summary": summary,
    }