/**
 * RAG Monitor type definitions
 */

import type { ErrorType, TimeWindow } from "./core.js";

// Retrieved document from RAG system
export interface RetrievedDocument {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// Quality metrics for a RAG query
export interface QualityMetrics {
  retrievalRelevanceScore: number; // 0-1
  generationConfidence: number; // 0-1
  latencyMs: number;
  tokenCount: number;
}

// Error details when a query fails
export interface ErrorDetails {
  type: ErrorType;
  message: string;
  stackTrace?: string;
  component?: string;
  severity?: "low" | "medium" | "high" | "critical";
  breadcrumbs?: Array<{
    timestamp: Date;
    category: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
}

// RAG query event logged by the monitor
export interface RAGQueryEvent {
  id: string;
  timestamp: Date;
  query: string;
  retrievedDocuments: RetrievedDocument[];
  contextWindow: string;
  generationOutput: string;
  qualityMetrics: QualityMetrics;
  success: boolean;
  errorDetails?: ErrorDetails;
}

// RAG statistics over a time window
export interface RAGStatistics {
  window: TimeWindow;
  queryCount: number;
  successRate: number;
  avgRelevanceScore: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorBreakdown: Record<ErrorType, number>;
}

// Control limits for statistical process control
export interface ControlLimits {
  successRateLower: number;
  relevanceScoreLower: number;
  latencyUpper: number;
  sigma: number; // Number of standard deviations for control limits
}

// Baseline metrics for drift detection
export interface RAGBaseline {
  createdAt: Date;
  updatedAt: Date;
  successRate: number;
  avgRelevanceScore: number;
  avgLatencyMs: number;
  controlLimits: ControlLimits;
}

// RAG Monitor interface
export interface RAGMonitor {
  // Log a RAG query execution
  logQuery(event: RAGQueryEvent): Promise<void>;

  // Get rolling statistics for a time window
  getStatistics(window: TimeWindow): Promise<RAGStatistics>;

  // Get baseline metrics for comparison
  getBaseline(): Promise<RAGBaseline>;

  // Update baseline with current metrics
  updateBaseline(): Promise<void>;
}
