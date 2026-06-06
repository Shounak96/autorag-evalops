import re

from app.services.llm_service import verify_answer_grounding_with_llm


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


def remove_inline_citations(text_value: str) -> str:
    return re.sub(r"\[S\d+\]", "", text_value).strip()


def split_answer_into_claims(answer: str) -> list[str]:
    """
    Splits an answer into simple sentence-level claims.

    The LLM verifier is preferred, but this method protects the pipeline
    if the Gemini API is unavailable.
    """
    cleaned_answer = remove_inline_citations(answer)

    sentences = re.split(r"(?<=[.!?])\s+", cleaned_answer)

    return [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]


def calculate_chunk_overlap(
    claim: str,
    chunk_content: str,
) -> float:
    claim_tokens = tokenize(claim)
    chunk_tokens = tokenize(chunk_content)

    if not claim_tokens:
        return 0.0

    overlap = claim_tokens.intersection(chunk_tokens)

    return len(overlap) / len(claim_tokens)


def deterministic_grounding_verification(
    answer: str,
    ranked_chunks: list[dict],
) -> dict:
    """
    Fallback verifier used when Gemini fails.

    It compares claim keywords against retrieved document chunks.
    """
    claims = split_answer_into_claims(answer)

    if not claims:
        return {
            "claims": [],
            "grounding_score": 0.0,
            "unsupported_claims_count": 1,
            "summary": "No verifiable claims were found in the generated answer.",
        }

    verified_claims: list[dict] = []

    for claim in claims:
        chunk_matches: list[tuple[str, float]] = []

        for index, chunk in enumerate(ranked_chunks, start=1):
            overlap_score = calculate_chunk_overlap(
                claim=claim,
                chunk_content=chunk.get("content", ""),
            )

            chunk_matches.append(
                (
                    f"S{index}",
                    overlap_score,
                )
            )

        chunk_matches.sort(
            key=lambda item: item[1],
            reverse=True,
        )

        best_score = chunk_matches[0][1] if chunk_matches else 0.0

        source_labels = [
            label
            for label, score in chunk_matches[:2]
            if score > 0
        ]

        if best_score >= 0.6:
            status = "supported"
            explanation = (
                "The claim has strong keyword overlap with retrieved evidence."
            )

        elif best_score >= 0.3:
            status = "partially_supported"
            explanation = (
                "The claim has partial keyword overlap with retrieved evidence."
            )

        else:
            status = "unsupported"
            explanation = (
                "The retrieved evidence does not sufficiently support this claim."
            )

        verified_claims.append(
            {
                "claim": claim,
                "status": status,
                "source_labels": source_labels,
                "explanation": explanation,
            }
        )

    score_weights = {
        "supported": 1.0,
        "partially_supported": 0.5,
        "unsupported": 0.0,
    }

    grounding_score = sum(
        score_weights[claim["status"]]
        for claim in verified_claims
    ) / len(verified_claims)

    unsupported_claims_count = sum(
        1
        for claim in verified_claims
        if claim["status"] == "unsupported"
    )

    return {
        "claims": verified_claims,
        "grounding_score": round(grounding_score, 4),
        "unsupported_claims_count": unsupported_claims_count,
        "summary": (
            "Deterministic fallback verification completed using "
            "claim-to-evidence keyword overlap."
        ),
    }


def run_grounding_verification(
    question: str,
    answer: str,
    ranked_chunks: list[dict],
) -> dict:
    """
    Runs Gemini claim verification when possible.

    Falls back to deterministic verification if:
    - Gemini quota is exceeded,
    - Gemini API is unavailable,
    - Gemini returns invalid JSON,
    - Gemini returns no usable claims.
    """
    try:
        report = verify_answer_grounding_with_llm(
            question=question,
            answer=answer,
            ranked_chunks=ranked_chunks,
        )

        return {
            "strategy": "llm_claim_verifier",
            **report,
            "fallback_reason": None,
        }

    except Exception as error:
        fallback_report = deterministic_grounding_verification(
            answer=answer,
            ranked_chunks=ranked_chunks,
        )

        return {
            "strategy": "deterministic_fallback",
            **fallback_report,
            "fallback_reason": str(error),
        }