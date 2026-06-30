export interface EvalDataset {
  id: string;
  name: string;
  description: string | null;
  test_case_count: number;
  created_at: string;
}

export interface EvalDatasetListResponse {
  datasets: EvalDataset[];
  count: number;
}

export interface EvalTestCase {
  id: string;
  dataset_id: string;
  question: string;
  expected_answer: string | null;
  required_document_name: string | null;
  tags: string[];
  created_at: string;
}

export interface EvalDatasetDetailResponse extends EvalDataset {
  test_cases: EvalTestCase[];
}

export interface EvalDatasetCreateRequest {
  name: string;
  description?: string | null;
}

export interface EvalTestCaseCreateRequest {
  question: string;
  expected_answer?: string | null;
  required_document_name?: string | null;
  tags: string[];
}

export interface DeleteEvalTestCaseResponse {
  message: string;
  deleted_test_case_id: string;
}

export interface QualityGateThresholds {
  min_pass_rate: number;
  min_retrieval_score: number;
  min_grounding_score: number;
  min_citation_coverage: number;
  min_answer_score: number;
  max_unsupported_claims: number;
  max_avg_latency_ms: number;
  baseline_run_id?: string | null;
  max_pass_rate_drop: number;
  max_answer_score_drop: number;
  max_retrieval_score_drop: number;
  max_grounding_score_drop: number;
  max_citation_coverage_drop: number;
}

export interface EvalDatasetRunRequest {
  top_k: number;
  vector_weight: number;
  keyword_weight: number;
  use_query_rewrite: boolean;
  max_rewritten_queries: number;
  prompt_version_id?: string | null;
  thresholds: QualityGateThresholds;
}

export interface EvalCaseRunResponse {
  test_case_id: string;
  child_rag_run_id: string | null;
  question: string;
  expected_answer: string | null;
  generated_answer: string | null;
  passed: boolean;
  failure_reasons: string[];
  required_document_hit: boolean;
  answer_score: number;
  retrieval_score: number;
  citation_coverage: number;
  grounding_score: number;
  unsupported_claims_count: number;
  latency_ms: number;
  answer_generation_strategy: string | null;
  verification_strategy: string | null;
}

export interface EvalDatasetRunSummary {
  rag_run_id: string;
  dataset_id: string;
  dataset_name: string;
  prompt_version_id: string | null;
  prompt_version_name: string;
  status: string;
  quality_gate_passed: boolean;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  pass_rate: number;
  avg_answer_score: number;
  avg_retrieval_score: number;
  avg_citation_coverage: number;
  avg_grounding_score: number;
  total_unsupported_claims: number;
  avg_latency_ms: number;
  thresholds: QualityGateThresholds;
  results: EvalCaseRunResponse[];
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

export interface PromptListResponse {
  prompts: PromptVersion[];
  count: number;
}

export interface EvalRun {
  rag_run_id: string;
  source: string | null;
  branch_name: string | null;
  commit_sha: string | null;
  trigger_type: string | null;
  external_run_url: string | null;
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

export interface PromptComparisonMetricDeltas {
  pass_rate: number;
  avg_answer_score: number;
  avg_retrieval_score: number;
  avg_citation_coverage: number;
  avg_grounding_score: number;
  avg_latency_ms: number;
}

export interface PromptComparison {
  comparison_id: string;
  dataset_id: string;
  dataset_name: string;
  prompt_version_a_id: string;
  prompt_version_a_name: string;
  prompt_version_b_id: string;
  prompt_version_b_name: string;
  run_a_id: string;
  run_b_id: string;
  winner: string;
  score_a: number;
  score_b: number;
  comparison_valid: boolean;
  comparison_warning: string | null;
  metric_deltas_b_minus_a: PromptComparisonMetricDeltas;
  created_at: string;
}

export interface PromptComparisonListResponse {
  comparisons: PromptComparison[];
  count: number;
}

export interface PromptComparisonRunSummary {
  rag_run_id: string;
  dataset_id: string;
  dataset_name: string;
  prompt_version_id: string | null;
  prompt_version_name: string;
  status: string;
  quality_gate_passed: boolean;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  pass_rate: number;
  avg_answer_score: number;
  avg_retrieval_score: number;
  avg_citation_coverage: number;
  avg_grounding_score: number;
  total_unsupported_claims: number;
  avg_latency_ms: number;
  thresholds: QualityGateThresholds;
  results: EvalCaseRunResponse[];
}

export interface PromptComparisonResponse {
  comparison_id: string;
  dataset_id: string;
  dataset_name: string;
  prompt_version_a_id: string;
  prompt_version_a_name: string;
  prompt_version_b_id: string;
  prompt_version_b_name: string;
  winner: string;
  score_a: number;
  score_b: number;
  comparison_valid: boolean;
  comparison_warning: string | null;
  metric_deltas_b_minus_a: Record<string, number>;
  run_a: PromptComparisonRunSummary;
  run_b: PromptComparisonRunSummary;
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


export interface DocumentRecord {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  status: string;
  total_chunks: number;
  source_path: string | null;
  content_hash: string | null;
  created_at: string;
}

export interface DocumentListResponse {
  documents: DocumentRecord[];
  count: number;
}

export interface ProcessDocumentResponse {
  document_id: string;
  status: string;
  total_chunks: number;
  message: string;
}

export interface DeleteDocumentResponse {
  document_id: string;
  file_name: string;
  status: string;
  message: string;
}

export interface EvalRunResult {
  id: string;
  rag_run_id: string;
  child_rag_run_id: string;
  test_case_id: string;
  question: string;
  generated_answer: string;
  expected_answer: string;
  retrieval_score: number;
  citation_coverage: number;
  grounding_score: number;
  answer_score: number;
  unsupported_claims_count: number;
  required_document_hit: boolean;
  answer_generation_strategy: string;
  verification_strategy: string;
  passed: boolean;
  failure_reasons: string[];
  latency_ms: number;
  created_at: string;
}

export interface EvalRunResultsResponse {
  rag_run_id: string;
  results: EvalRunResult[];
  count: number;
}

