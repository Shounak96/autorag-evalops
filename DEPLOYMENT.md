# AutoRAG EvalOps Deployment Notes

## Backend deployment mode

For cloud deployment, use Gemini embeddings to avoid loading local Torch/SentenceTransformer models.

Required backend environment variables:

```txt
DATABASE_URL=<supabase-postgres-url>
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_REWRITE_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_PROVIDER=gemini
ENABLE_LLM_QUERY_REWRITE=true
CI_GATE_TOKEN=<secure-ci-token>
FRONTEND_URL=<deployed-frontend-url>
ENVIRONMENT=production