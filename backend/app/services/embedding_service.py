from functools import lru_cache
from typing import Any

import logging

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

LOCAL_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384


def get_embedding_provider() -> str:
    return settings.EMBEDDING_PROVIDER.strip().lower()


@lru_cache(maxsize=1)
def get_embedding_model() -> Any | None:
    """
    Loads the local embedding model only when EMBEDDING_PROVIDER=local.

    In cloud deployment, EMBEDDING_PROVIDER=gemini avoids loading
    sentence-transformers and torch into memory.
    """
    provider = get_embedding_provider()

    if provider == "gemini":
        logger.info(
            "Using Gemini embeddings. Local embedding model will not be loaded."
        )
        return None

    if provider != "local":
        raise ValueError(
            "Unsupported EMBEDDING_PROVIDER. Use 'local' or 'gemini'."
        )

    from sentence_transformers import SentenceTransformer

    logger.info(
        "Loading local embedding model: %s",
        LOCAL_MODEL_NAME,
    )

    return SentenceTransformer(LOCAL_MODEL_NAME)


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    """
    Creates one cached Gemini client per backend process.
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini."
        )

    return genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_local_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    model = get_embedding_model()

    if model is None:
        raise RuntimeError(
            "Local embedding model is not available because "
            "EMBEDDING_PROVIDER is not set to local."
        )

    embeddings = model.encode(
        texts,
        batch_size=min(len(texts), 32),
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    return [
        embedding.tolist()
        for embedding in embeddings
    ]


def generate_gemini_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    client = get_gemini_client()

    response = client.models.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            output_dimensionality=EMBEDDING_DIMENSION,
        ),
    )

    return [
        embedding.values
        for embedding in response.embeddings
    ]


def generate_embedding(text: str) -> list[float]:
    """
    Generates one embedding using the configured provider.

    local:
      SentenceTransformer all-MiniLM-L6-v2, 384 dimensions

    gemini:
      Gemini embedding model, forced to 384 dimensions for pgvector compatibility
    """
    embeddings = generate_embeddings([text])

    if not embeddings:
        raise RuntimeError("Embedding generation returned no vectors.")

    return embeddings[0]


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for multiple texts using the configured provider.
    """
    provider = get_embedding_provider()

    if provider == "gemini":
        return generate_gemini_embeddings(texts)

    if provider == "local":
        return generate_local_embeddings(texts)

    raise ValueError(
        "Unsupported EMBEDDING_PROVIDER. Use 'local' or 'gemini'."
    )


def warm_up_embedding_model() -> None:
    """
    Warms up local embeddings only.

    Gemini embeddings are API-based and do not need a heavy startup warm-up.
    This keeps cloud deployment lightweight and avoids unnecessary startup calls.
    """
    provider = get_embedding_provider()

    if provider == "gemini":
        logger.info(
            "Skipping local embedding warm-up because EMBEDDING_PROVIDER=gemini."
        )
        return

    generate_embedding("embedding model warm-up")