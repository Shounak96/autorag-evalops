# AutoRAG EvalOps

A full-stack RAG testing, evaluation, monitoring, and CI/CD quality-gate platform for Retrieval-Augmented Generation applications.

Production RAG systems can fail silently when documents change, prompts are edited, retrieval settings are tuned, or models are swapped. AutoRAG EvalOps gives developers a structured, repeatable way to measure RAG quality and automatically block unsafe releases before deployment.

## Live Links

- **Frontend:** https://autorag-evalops.vercel.app
- **Backend API:** https://autorag-evalops-api.onrender.com
- **API Docs:** https://autorag-evalops-api.onrender.com/docs

## Architecture

```
Vercel (Next.js frontend)
        ↓
Render (FastAPI backend)
        ↓
Supabase PostgreSQL + pgvector
        ↓
Gemini API

GitHub Actions → deployed FastAPI quality-gate endpoint → results stored in Supabase → CI/CD dashboard
```

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, Python, SQLAlchemy, Pydantic, Uvicorn |
| Database | Supabase PostgreSQL + pgvector |
| AI / RAG | Gemini API (generation + embeddings), hybrid retrieval, query rewriting, grounding checks |
| CI/CD | GitHub Actions, custom quality-gate runner, JSON report artifacts |

## Features

- Document ingestion with chunking, embeddings, and SHA-256 duplicate detection
- RAG Playground for interactive, citation-backed Q&A
- Hybrid retrieval (vector + keyword, configurable weights, query rewriting)
- Reusable evaluation datasets and test cases
- Prompt version management + A/B prompt comparisons
- Manual quality gate with configurable thresholds
- Baseline regression detection
- GitHub Actions CI/CD quality gate with run history dashboard

## Quality Metrics

Pass rate, retrieval score, grounding score, citation coverage, answer score, unsupported claims, and latency.

## Quick Start

1. **Upload documents** — Documents page → upload → Process → wait for `indexed` status.
2. **Test in the Playground** — ask a question, tune retrieval settings, review answer/citations/scores.
3. **Build a dataset** — add test cases (question, expected answer, required document, tags).
4. **Manage prompts** — create/version prompts on the Prompt Versions page.
5. **Run the quality gate** — pick a dataset + prompt, set thresholds, optionally select a baseline, run.
6. **Wire up CI/CD** — copy the generated GitHub variables/secrets from the CI/CD Pipeline page into your repo, then push. The Actions job fails automatically if the quality gate fails.

## Limitations

- Gemini free-tier rate/quota limits — batch large benchmark runs
- Tested on smaller controlled datasets so far; larger benchmarks planned
- Local (SentenceTransformer) vs. cloud (Gemini) embeddings differ — reprocessing needed if you switch providers
- Some metrics (answer-score matching, unsupported-claim detection) are heuristic, not perfect semantic evaluation
- Render free-tier cold starts
- Not yet validated at large enterprise scale

## Status

Frontend deployed on Vercel · Backend deployed on Render · Database on Supabase (PostgreSQL + pgvector) · CI/CD quality gate working via GitHub Actions.
