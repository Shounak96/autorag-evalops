from functools import lru_cache

from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """
    Loads the local embedding model once per backend process.

    The cached model is reused for:
    - document ingestion
    - single-query retrieval
    - batched multi-query retrieval

    all-MiniLM-L6-v2 returns 384-dimensional embeddings,
    matching the pgvector Vector(384) database column.
    """
    
    logger.info(
        "Loading embedding model: %s",
        MODEL_NAME,
    )

    return SentenceTransformer(MODEL_NAME)


def generate_embedding(text: str) -> list[float]:
    """
    Generates one normalized embedding.

    Used by routes that perform a single semantic-search query.
    """
    model = get_embedding_model()

    embedding = model.encode(
        text,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    return embedding.tolist()


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates normalized embeddings for multiple texts in one model call.

    Used for:
    - document chunks
    - rewritten multi-query retrieval inputs
    """
    if not texts:
        return []

    model = get_embedding_model()

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


def warm_up_embedding_model() -> None:
    """
    Loads the model and executes one tiny embedding request.

    We will call this during backend startup in the next optimization step.
    """
    generate_embedding("embedding model warm-up")