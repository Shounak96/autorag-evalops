export interface DocumentListResponse {
  count: number;
}

export interface EvalDatasetListResponse {
  datasets: unknown[];
  count: number;
}

export interface PromptVersion {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string;
  is_default: boolean;
  created_at: string;
}

export interface PromptVersionListResponse {
  prompts: PromptVersion[];
  count: number;
}

export interface EvalRun {
  rag_run_id: string;
  dataset_id: string | null;
  dataset_name: string | null;
  prompt_version_id: string | null;
  prompt_version_name: string | null;
  status: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  pass_rate: number;
  avg_retrieval_score: number;
  avg_grounding_score: number;
  avg_citation_coverage: number;
  avg_latency_ms: number;
  total_unsupported_claims: number;
  quality_gate_passed: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface EvalRunListResponse {
  runs: EvalRun[];
  count: number;
}

export interface PromptComparison {
  comparison_id: string;
  dataset_id: string;
  dataset_name: string | null;
  prompt_version_a_id: string | null;
  prompt_version_a_name: string;
  prompt_version_b_id: string | null;
  prompt_version_b_name: string;
  run_a_id: string | null;
  run_b_id: string | null;
  winner: string;
  score_a: number;
  score_b: number;
  comparison_valid: boolean;
  comparison_warning: string | null;
  metric_deltas_b_minus_a: Record<string, number>;
  created_at: string;
}

export interface PromptComparisonListResponse {
  comparisons: PromptComparison[];
  count: number;
}

export interface RagAskRequest {
  question: string;
  top_k: number;
  vector_weight: number;
  keyword_weight: number;
  use_query_rewrite: boolean;
  max_rewritten_queries: number;
  prompt_version_id: string | null;
}

export interface RagCitation {
  chunk_id: string;
  document_id: string;
  file_name: string;
  page_number: number | null;
  chunk_index: number;
}

export interface RagRetrievedChunk {
  chunk_id: string;
  document_id: string;
  file_name: string;
  page_number: number | null;
  chunk_index: number;
  content: string;
  vector_score: number;
  keyword_score: number;
  hybrid_score: number;
}

export interface ClaimVerification {
  claim: string;
  status: string;
  source_labels: string[];
  explanation: string;
}

export interface GroundingVerificationReport {
  strategy: string;
  claims: ClaimVerification[];
  grounding_score: number;
  unsupported_claims_count: number;
  summary: string;
  fallback_reason: string | null;
}

export interface RagMetrics {
  retrieval_score: number;
  citation_coverage: number;
  grounding_score: number;
  unsupported_claims_count: number;
  latency_ms: number;
}

export interface AgentTraceStep {
  step_name: string;
  status: string;
  latency_ms: number;
}

export interface RagAskResponse {
  rag_run_id: string;
  question: string;
  selected_prompt_version_id: string | null;
  selected_prompt_version_name: string;
  rewritten_queries: string[];
  answer: string;
  answer_generation_strategy: string;
  citations: RagCitation[];
  retrieved_chunks: RagRetrievedChunk[];
  verification_report: GroundingVerificationReport;
  metrics: RagMetrics;
  agent_trace: AgentTraceStep[];
}