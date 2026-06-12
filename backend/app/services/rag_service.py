import json
import re
import time
from datetime import datetime
from typing import Any

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.agent_step import AgentStep
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.rag_run import RagRun
from app.services.embedding_service import generate_embeddings
from app.services.llm_service import (
    LLMUnavailableError,
    generate_grounded_answer_with_llm,
    rewrite_query_with_llm,
)
from app.services.verification_service import run_grounding_verification
from datetime import datetime, timezone
from app.services.prompt_service import resolve_prompt_version




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


def now_ms() -> int:
    return int(time.time() * 1000)


def tokenize(text_value: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9_]+", text_value.lower())
    return {token for token in tokens if len(token) > 2 and token not in STOPWORDS}


def keyword_overlap_score(question: str, content: str) -> float:
    question_tokens = tokenize(question)
    content_tokens = tokenize(content)

    if not question_tokens:
        return 0.0

    overlap = question_tokens.intersection(content_tokens)

    return round(len(overlap) / len(question_tokens), 4)


def rule_based_query_rewrite(question: str, max_queries: int) -> list[str]:
    tokens = sorted(list(tokenize(question)))
    keyword_query = " ".join(tokens[:12])

    expanded_queries = [
        question,
        keyword_query,
        f"{question} retrieval citation grounding evaluation",
        f"{question} RAG metrics quality scoring",
    ]

    cleaned: list[str] = []

    for query in expanded_queries:
        normalized = " ".join(query.split())
        if normalized and normalized.lower() not in {item.lower() for item in cleaned}:
            cleaned.append(normalized)

    return cleaned[:max_queries]


def rewrite_queries(
    question: str,
    use_query_rewrite: bool,
    max_queries: int,
) -> tuple[list[str], str]:
    if not use_query_rewrite:
        return [question], "disabled"

    fallback_queries = rule_based_query_rewrite(
        question=question,
        max_queries=max_queries,
    )

    if settings.ENABLE_LLM_QUERY_REWRITE and settings.GEMINI_API_KEY:
        try:
            llm_queries = rewrite_query_with_llm(
                question=question,
                max_queries=max_queries,
            )

            combined_queries = [question] + llm_queries + fallback_queries

            deduped: list[str] = []

            for query in combined_queries:
                normalized = " ".join(query.split())

                if normalized and normalized.lower() not in {
                    item.lower() for item in deduped
                }:
                    deduped.append(normalized)

            final_queries = deduped[: max_queries + 1]

            strategy = "llm_plus_rule_based_fallback"

            return final_queries, strategy

        except LLMUnavailableError:
            pass
        except Exception:
            pass

    return fallback_queries[: max_queries + 1], "rule_based_fallback"


def log_agent_step(
    db: Session,
    rag_run_id: str,
    step_name: str,
    step_order: int,
    input_data: dict[str, Any] | None,
    output_data: dict[str, Any] | None,
    status: str,
    latency_ms: int,
) -> AgentStep:
    step = AgentStep(
        rag_run_id=rag_run_id,
        step_name=step_name,
        step_order=step_order,
        input_data=json.dumps(input_data or {}, default=str),
        output_data=json.dumps(output_data or {}, default=str),
        status=status,
        latency_ms=latency_ms,
    )

    db.add(step)
    db.commit()
    db.refresh(step)

    return step


def create_rag_run(
    db: Session,
    question: str,
    prompt_version_id: str | None,
) -> RagRun:
    rag_run = RagRun(
        prompt_version_id=prompt_version_id,
        status="running",
        total_cases=1,
        passed_cases=0,
        failed_cases=0,
        notes=f"Ad-hoc advanced RAG query: {question[:200]}",
    )

    db.add(rag_run)
    db.commit()
    db.refresh(rag_run)

    return rag_run


def vector_retrieve_chunks(
    db: Session,
    query_embedding: list[float],
    limit: int,
) -> list[dict]:
    """
    Executes one pgvector similarity search using an embedding
    that has already been generated.

    Embedding generation is intentionally handled outside this function
    so rewritten queries can be embedded in one batch.
    """
    sql = text(
        """
        select
            document_chunks.id as chunk_id,
            document_chunks.document_id as document_id,
            documents.file_name as file_name,
            document_chunks.chunk_index as chunk_index,
            document_chunks.page_number as page_number,
            document_chunks.content as content,
            1 - (
                document_chunks.embedding
                <=> CAST(:query_embedding AS vector)
            ) as vector_score
        from document_chunks
        join documents
            on documents.id = document_chunks.document_id
        where document_chunks.embedding is not null
        order by
            document_chunks.embedding
            <=> CAST(:query_embedding AS vector)
        limit :limit
        """
    )

    result = db.execute(
        sql,
        {
            "query_embedding": query_embedding,
            "limit": limit,
        },
    )

    rows = result.mappings().all()

    return [
        dict(row)
        for row in rows
    ]


def keyword_retrieve_chunks(
    db: Session,
    query: str,
    scoring_question: str,
    limit: int,
) -> list[dict]:
    tokens = list(tokenize(query))

    if not tokens:
        return []

    filters = [
        DocumentChunk.content.ilike(f"%{token}%")
        for token in tokens[:8]
    ]

    rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(or_(*filters))
        .limit(limit)
        .all()
    )

    results: list[dict] = []

    for chunk, document in rows:
        results.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "file_name": document.file_name,
                "chunk_index": chunk.chunk_index,
                "page_number": chunk.page_number,
                "content": chunk.content,
                "keyword_score": keyword_overlap_score(scoring_question, chunk.content),
            }
        )

    return results


def multi_query_vector_retrieve(
    db: Session,
    queries: list[str],
    limit_per_query: int,
) -> tuple[list[dict], int, int]:
    """
    Encodes all retrieval queries in one batch, then performs
    one pgvector search per query.

    Returns:
    - all_results
    - embedding_latency_ms
    - pgvector_search_latency_ms
    """
    if not queries:
        return [], 0, 0

    embedding_start = now_ms()
    query_embeddings = generate_embeddings(queries)
    embedding_latency_ms = now_ms() - embedding_start

    pgvector_start = now_ms()

    all_results: list[dict] = []

    for query, query_embedding in zip(
        queries,
        query_embeddings,
    ):
        results = vector_retrieve_chunks(
            db=db,
            query_embedding=query_embedding,
            limit=limit_per_query,
        )

        for result in results:
            result["source_query"] = query
            all_results.append(result)

    pgvector_latency_ms = now_ms() - pgvector_start

    return all_results, embedding_latency_ms, pgvector_latency_ms


def multi_query_keyword_retrieve(
    db: Session,
    queries: list[str],
    scoring_question: str,
    limit_per_query: int,
) -> list[dict]:
    all_results: list[dict] = []

    for query in queries:
        results = keyword_retrieve_chunks(
            db=db,
            query=query,
            scoring_question=scoring_question,
            limit=limit_per_query,
        )

        for result in results:
            result["source_query"] = query
            all_results.append(result)

    return all_results

def normalize_chunk_content(content: str) -> str:
    """
    Creates a stable representation for retrieval deduplication.

    This collapses whitespace and ignores casing so duplicate chunks
    are removed even when formatting differs slightly.
    """
    return re.sub(r"\s+", " ", content).strip().lower()


def deduplicate_ranked_chunks(
    chunks: list[dict],
) -> list[dict]:
    """
    Keeps only the highest-scoring version of each unique chunk body.

    Chunk IDs alone are insufficient because legacy duplicate documents
    may contain identical text under different IDs.
    """
    deduplicated: dict[str, dict] = {}

    for chunk in chunks:
        normalized_content = normalize_chunk_content(
            chunk.get("content", "")
        )

        if not normalized_content:
            continue

        existing_chunk = deduplicated.get(normalized_content)

        if (
            existing_chunk is None
            or float(chunk.get("hybrid_score") or 0.0)
            > float(existing_chunk.get("hybrid_score") or 0.0)
        ):
            deduplicated[normalized_content] = chunk

    return list(deduplicated.values())


def hybrid_rerank_chunks(
    question: str,
    vector_results: list[dict],
    keyword_results: list[dict],
    top_k: int,
    vector_weight: float,
    keyword_weight: float,
) -> list[dict]:
    merged: dict[str, dict] = {}

    for item in vector_results:
        chunk_id = item["chunk_id"]
        incoming_vector_score = round(float(item.get("vector_score") or 0.0), 4)

        if chunk_id not in merged:
            merged[chunk_id] = {
                **item,
                "vector_score": incoming_vector_score,
                "keyword_score": keyword_overlap_score(question, item.get("content", "")),
            }
        else:
            merged[chunk_id]["vector_score"] = max(
                merged[chunk_id].get("vector_score", 0.0),
                incoming_vector_score,
            )

    for item in keyword_results:
        chunk_id = item["chunk_id"]
        incoming_keyword_score = round(float(item.get("keyword_score") or 0.0), 4)

        if chunk_id not in merged:
            merged[chunk_id] = {
                **item,
                "vector_score": 0.0,
                "keyword_score": incoming_keyword_score,
            }
        else:
            merged[chunk_id]["keyword_score"] = max(
                merged[chunk_id].get("keyword_score", 0.0),
                incoming_keyword_score,
            )

    reranked: list[dict] = []

    for item in merged.values():
        vector_score = float(item.get("vector_score") or 0.0)
        keyword_score = float(item.get("keyword_score") or 0.0)

        hybrid_score = (vector_score * vector_weight) + (keyword_score * keyword_weight)

        reranked.append(
            {
                **item,
                "vector_score": round(vector_score, 4),
                "keyword_score": round(keyword_score, 4),
                "hybrid_score": round(hybrid_score, 4),
            }
        )

        reranked.sort(
        key=lambda chunk: chunk["hybrid_score"],
        reverse=True,
    )

    deduplicated_chunks = deduplicate_ranked_chunks(reranked)

    deduplicated_chunks.sort(
        key=lambda chunk: chunk["hybrid_score"],
        reverse=True,
    )

    return deduplicated_chunks[:top_k]


def select_relevant_sentences(question: str, content: str, max_sentences: int = 2) -> list[str]:
    question_tokens = tokenize(question)
    sentences = re.split(r"(?<=[.!?])\s+", content)

    scored_sentences: list[tuple[float, str]] = []

    for sentence in sentences:
        sentence = sentence.strip()

        if not sentence:
            continue

        sentence_tokens = tokenize(sentence)

        if not sentence_tokens:
            continue

        overlap = question_tokens.intersection(sentence_tokens)
        score = len(overlap) / max(len(question_tokens), 1)

        scored_sentences.append((score, sentence))

    scored_sentences.sort(key=lambda item: item[0], reverse=True)

    selected = [sentence for score, sentence in scored_sentences if score > 0]

    if not selected:
        selected = [content[:350].strip()]

    return selected[:max_sentences]


def build_extractive_answer(question: str, ranked_chunks: list[dict]) -> str:
    if not ranked_chunks:
        return (
            "I could not find enough relevant document context to answer this question. "
            "Upload and process more documents, then try again."
        )

    evidence_sentences: list[str] = []

    for chunk in ranked_chunks[:3]:
        evidence_sentences.extend(
            select_relevant_sentences(
                question=question,
                content=chunk["content"],
                max_sentences=2,
            )
        )

    unique_sentences: list[str] = []

    for sentence in evidence_sentences:
        if sentence not in unique_sentences:
            unique_sentences.append(sentence)

    if not unique_sentences:
        return (
            "The retrieved documents contain related context, but the system could not "
            "extract a confident grounded answer from the available chunks."
        )

    return " ".join(unique_sentences[:4])


def build_citations(ranked_chunks: list[dict]) -> list[dict]:
    citations: list[dict] = []

    for chunk in ranked_chunks:
        citations.append(
            {
                "chunk_id": chunk["chunk_id"],
                "document_id": chunk["document_id"],
                "file_name": chunk["file_name"],
                "page_number": chunk["page_number"],
                "chunk_index": chunk["chunk_index"],
            }
        )

    return citations

def build_citations_from_labels(
    ranked_chunks: list[dict],
    citation_labels: list[str],
) -> list[dict]:
    """
    Returns only the chunks that were actually cited by the LLM.

    Example:
    citation_labels = ["S1", "S3"]
    """
    citations: list[dict] = []

    for label in citation_labels:
        source_number = int(label.replace("S", ""))

        chunk_position = source_number - 1

        if chunk_position < 0 or chunk_position >= len(ranked_chunks):
            continue

        chunk = ranked_chunks[chunk_position]

        citations.append(
            {
                "chunk_id": chunk["chunk_id"],
                "document_id": chunk["document_id"],
                "file_name": chunk["file_name"],
                "page_number": chunk["page_number"],
                "chunk_index": chunk["chunk_index"],
            }
        )

    return citations


def calculate_metrics(
    ranked_chunks: list[dict],
    citations: list[dict],
    verification_report: dict,
    latency_ms: int,
) -> dict:
    """
    Calculates metrics using the claim-level verifier output.
    """
    if not ranked_chunks:
        return {
            "retrieval_score": 0.0,
            "citation_coverage": 0.0,
            "grounding_score": 0.0,
            "unsupported_claims_count": 1,
            "latency_ms": latency_ms,
        }

    avg_hybrid_score = (
        sum(chunk["hybrid_score"] for chunk in ranked_chunks)
        / len(ranked_chunks)
    )

    claims = verification_report.get("claims", [])

    if claims:
        claims_with_evidence = sum(
            1
            for claim in claims
            if claim.get("source_labels")
        )

        citation_coverage = claims_with_evidence / len(claims)

    else:
        citation_coverage = 0.0

    if not citations:
        citation_coverage = 0.0

    return {
        "retrieval_score": round(avg_hybrid_score, 4),
        "citation_coverage": round(citation_coverage, 4),
        "grounding_score": round(
            float(verification_report.get("grounding_score", 0.0)),
            4,
        ),
        "unsupported_claims_count": int(
            verification_report.get("unsupported_claims_count", 0)
        ),
        "latency_ms": latency_ms,
    }


def run_advanced_rag(
    db: Session,
    question: str,
    top_k: int,
    vector_weight: float,
    keyword_weight: float,
    use_query_rewrite: bool,
    max_rewritten_queries: int,
    prompt_version_id: str | None = None,
) -> dict:
    request_start = now_ms()

    selected_prompt = resolve_prompt_version(
        db=db,
        prompt_version_id=prompt_version_id,
    )

    rag_run = create_rag_run(
        db=db,
        question=question,
        prompt_version_id=selected_prompt["id"],
    )

    agent_trace: list[dict] = []

    step_start = now_ms()
    rewritten_queries, rewrite_strategy = rewrite_queries(
        question=question,
        use_query_rewrite=use_query_rewrite,
        max_queries=max_rewritten_queries,
    )
    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="query_rewriting",
        step_order=1,
        input_data={
            "question": question,
            "use_query_rewrite": use_query_rewrite,
            "max_rewritten_queries": max_rewritten_queries,
        },
        output_data={
            "strategy": rewrite_strategy,
            "rewritten_queries": rewritten_queries,
        },
        status="success",
        latency_ms=now_ms() - step_start,
    )
    agent_trace.append(
        {
            "step_name": "query_rewriting",
            "status": "success",
            "latency_ms": now_ms() - step_start,
        }
    )

    retrieval_limit = max(top_k * 3, 8)

    vector_results, embedding_latency_ms, pgvector_latency_ms = (
        multi_query_vector_retrieve(
            db=db,
            queries=rewritten_queries,
            limit_per_query=retrieval_limit,
        )
    )

    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="batch_query_embedding_generation",
        step_order=2,
        input_data={
            "queries": rewritten_queries,
            "query_count": len(rewritten_queries),
        },
        output_data={
            "embedding_count": len(rewritten_queries),
        },
        status="success",
        latency_ms=embedding_latency_ms,
    )
    agent_trace.append(
        {
            "step_name": "batch_query_embedding_generation",
            "status": "success",
            "latency_ms": embedding_latency_ms,
        }
    )

    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="multi_query_pgvector_search",
        step_order=3,
        input_data={
            "queries": rewritten_queries,
            "limit_per_query": retrieval_limit,
        },
        output_data={
            "raw_retrieved_count": len(vector_results),
        },
        status="success",
        latency_ms=pgvector_latency_ms,
    )
    agent_trace.append(
        {
            "step_name": "multi_query_pgvector_search",
            "status": "success",
            "latency_ms": pgvector_latency_ms,
        }
    )

    step_start = now_ms()
    keyword_results = multi_query_keyword_retrieve(
        db=db,
        queries=rewritten_queries,
        scoring_question=question,
        limit_per_query=retrieval_limit,
    )
    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="multi_query_keyword_retrieval",
        step_order=4,
        input_data={
            "queries": rewritten_queries,
            "limit_per_query": retrieval_limit,
        },
        output_data={
            "raw_retrieved_count": len(keyword_results),
        },
        status="success",
        latency_ms=now_ms() - step_start,
    )
    agent_trace.append(
        {
            "step_name": "multi_query_keyword_retrieval",
            "status": "success",
            "latency_ms": now_ms() - step_start,
        }
    )

    step_start = now_ms()
    ranked_chunks = hybrid_rerank_chunks(
        question=question,
        vector_results=vector_results,
        keyword_results=keyword_results,
        top_k=top_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )

    raw_unique_chunk_ids = {
        item["chunk_id"]
        for item in vector_results + keyword_results
    }

    duplicate_chunks_removed = max(
        len(raw_unique_chunk_ids) - len(ranked_chunks),
        0,
    )

    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="hybrid_reranking",
        step_order=5,
        input_data={
            "vector_count": len(vector_results),
            "keyword_count": len(keyword_results),
            "top_k": top_k,
            "vector_weight": vector_weight,
            "keyword_weight": keyword_weight,
        },
        output_data={
            "selected_count": len(ranked_chunks),
            "duplicate_chunks_removed": duplicate_chunks_removed,
            "top_scores": [
                chunk["hybrid_score"]
                for chunk in ranked_chunks
            ],
        },
        status="success",
        latency_ms=now_ms() - step_start,
    )
    agent_trace.append(
        {
            "step_name": "hybrid_reranking",
            "status": "success",
            "latency_ms": now_ms() - step_start,
        }
    )

    step_start = now_ms()

    answer_generation_strategy = "llm_citation_first"
    generation_error: str | None = None
    used_citation_labels: list[str] = []

    try:
        answer, used_citation_labels = generate_grounded_answer_with_llm(
            question=question,
            ranked_chunks=ranked_chunks,
            system_prompt=selected_prompt["system_prompt"],
            user_prompt_template=selected_prompt["user_prompt_template"],
        )

        citations = build_citations_from_labels(
            ranked_chunks=ranked_chunks,
            citation_labels=used_citation_labels,
        )

    except Exception as error:
        answer_generation_strategy = "extractive_fallback"
        generation_error = str(error)

        answer = build_extractive_answer(
            question=question,
            ranked_chunks=ranked_chunks,
        )

        citations = build_citations(ranked_chunks)

    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="citation_first_answer_generation",
        step_order=6,
        input_data={
            "question": question,
            "selected_chunks": [chunk["chunk_id"] for chunk in ranked_chunks],
        },
        output_data={
            "strategy": answer_generation_strategy,
            "prompt_version_id": selected_prompt["id"],
            "prompt_version_name": selected_prompt["name"],
            "prompt_source": selected_prompt["source"],
            "answer_preview": answer[:500],
            "citation_labels": used_citation_labels,
            "citation_count": len(citations),
            "fallback_reason": generation_error,
        },
        status="success",
        latency_ms=now_ms() - step_start,
    )

    agent_trace.append(
        {
            "step_name": "citation_first_answer_generation",
            "status": "success",
            "latency_ms": now_ms() - step_start,
        }
    )

    step_start = now_ms()

    verification_report = run_grounding_verification(
        question=question,
        answer=answer,
        ranked_chunks=ranked_chunks,
    )

    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="claim_level_grounding_verification",
        step_order=7,
        input_data={
            "question": question,
            "answer": answer,
            "selected_chunks": [
                chunk["chunk_id"]
                for chunk in ranked_chunks
            ],
        },
        output_data=verification_report,
        status="success",
        latency_ms=now_ms() - step_start,
    )

    agent_trace.append(
        {
            "step_name": "claim_level_grounding_verification",
            "status": "success",
            "latency_ms": now_ms() - step_start,
        }
    )

    latency_ms = now_ms() - request_start

    step_start = now_ms()
    metrics = calculate_metrics(
        ranked_chunks=ranked_chunks,
        citations=citations,
        verification_report=verification_report,
        latency_ms=latency_ms,
    )

    verdict_passed = (
        metrics["retrieval_score"] >= 0.4
        and metrics["citation_coverage"] >= 1.0
        and metrics["unsupported_claims_count"] == 0
    )

    rag_run.status = "completed"
    rag_run.passed_cases = 1 if verdict_passed else 0
    rag_run.failed_cases = 0 if verdict_passed else 1
    rag_run.pass_rate = 1.0 if verdict_passed else 0.0
    rag_run.avg_retrieval_score = metrics["retrieval_score"]
    rag_run.avg_grounding_score = metrics["grounding_score"]
    rag_run.avg_latency_ms = metrics["latency_ms"]
    rag_run.completed_at = datetime.now(timezone.utc)

    db.add(rag_run)
    db.commit()
    db.refresh(rag_run)

    log_agent_step(
        db=db,
        rag_run_id=rag_run.id,
        step_name="quality_scoring",
        step_order=8,
        input_data={
            "ranked_chunk_count": len(ranked_chunks),
            "rewritten_queries": rewritten_queries,
        },
        output_data={
            "metrics": metrics,
            "verdict": "pass" if verdict_passed else "fail",
        },
        status="success",
        latency_ms=now_ms() - step_start,
    )
    agent_trace.append(
        {
            "step_name": "quality_scoring",
            "status": "success",
            "latency_ms": now_ms() - step_start,
        }
    )

    return {
        "rag_run_id": rag_run.id,
        "question": question,
        "selected_prompt_version_id": selected_prompt["id"],
        "selected_prompt_version_name": selected_prompt["name"],
        "rewritten_queries": rewritten_queries,
        "answer": answer,
        "answer_generation_strategy": answer_generation_strategy,
        "citations": citations,
        "retrieved_chunks": ranked_chunks,
        "verification_report": verification_report,
        "metrics": metrics,
        "agent_trace": agent_trace,
    }