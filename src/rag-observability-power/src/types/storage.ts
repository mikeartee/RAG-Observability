/**
 * Storage schema type definitions
 */

import type { ErrorType } from "./core.js";

// Vector DB schema for error embeddings
export interface ErrorEmbeddingRecord {
  id: string;
  errorId: string;
  embedding: number[];
  metadata: {
    type: ErrorType;
    component: string;
    severity: string;
    timestamp: string;
  };
}

// Relational schema for errors
export interface ErrorTable {
  id: string;
  timestamp: Date;
  type: ErrorType;
  component: string;
  severity: string;
  context_json: string;
  embedding_id: string;
}

// Relational schema for fixes
export interface FixTable {
  id: string;
  error_id: string;
  description: string;
  code_changes_json: string;
  applied_at: Date;
  resolved: boolean;
  success_count: number;
  failure_count: number;
}

// Relational schema for steering rules
export interface SteeringRuleTable {
  id: string;
  pattern: string;
  rule: string;
  generated_from_json: string; // Array of error IDs
  confidence: number;
  created_at: Date;
  active: boolean;
}

// Query event storage
export interface QueryEventTable {
  id: string;
  timestamp: Date;
  query: string;
  retrieved_documents_json: string;
  context_window: string;
  generation_output: string;
  quality_metrics_json: string;
  success: boolean;
  error_details_json?: string;
}

// Baseline storage
export interface BaselineTable {
  id: string;
  created_at: Date;
  updated_at: Date;
  success_rate: number;
  avg_relevance_score: number;
  avg_latency_ms: number;
  control_limits_json: string;
}

// Captured failure storage
export interface CapturedFailureTable {
  id: string;
  timestamp: Date;
  query_event_json: string;
  embedding_snapshot_json: string;
  retrieval_state_json: string;
  system_state_json: string;
  replayable: boolean;
}
