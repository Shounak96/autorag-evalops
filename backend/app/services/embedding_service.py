from functools import lru_cache

from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """
    Loads the embedding model once and reuses it.
    all-MiniLM-L6-v2 creates 384-dimensional embeddings.
    This matches our pgvector column: Vector(384).
    """
    return SentenceTransformer(MODEL_NAME)


def generate_embedding(text: str) -> list[float]:
    model = get_embedding_model()

    embedding = model.encode(
        text,
        normalize_embeddings=True,
    )

    return embedding.tolist()


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()

    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
    )

    return [embedding.tolist() for embedding in embeddings]