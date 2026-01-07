/**
 * Failure Capturer type definitions
 */

import type { RAGQueryEvent } from "./rag-monitor.js";

// Retrieval state at time of failure
export interface RetrievalState {
  indexVersion: string;
  embeddingModel: string;
  searchParameters: Record<string, unknown>;
}

// System state at time of failure
export interface SystemState {
  modelVersion: string;
  configSnapshot: Record<string, unknown>;
  environmentVariables: Record<string, string>;
}

// Captured failure with full state
export interface CapturedFailure {
  id: string;
  timestamp: Date;
  queryEvent: RAGQueryEvent;
  embeddingSnapshot: number[][]; // Embeddings at time of failure
  retrievalState: RetrievalState;
  systemState: SystemState;
  replayable: boolean;
}

// Result of replaying a failure
export interface ReplayResult {
  failureId: string;
  reproduced: boolean;
  originalOutput: string;
  replayOutput: string;
  differences: string[];
}

// Filters for listing failures
export interface FailureFilters {
  startDate?: Date;
  endDate?: Date;
  errorType?: string;
  replayable?: boolean;
  limit?: number;
}

// Failure Capturer interface
export interface FailureCapturer {
  // Capture a failure with full state
  captureFailure(event: RAGQueryEvent): Promise<CapturedFailure>;

  // Retrieve a captured failure by ID
  getFailure(id: string): Promise<CapturedFailure>;

  // Replay a failure with captured state
  replayFailure(id: string): Promise<ReplayResult>;

  // List captured failures with filters
  listFailures(filters: FailureFilters): Promise<CapturedFailure[]>;
}
