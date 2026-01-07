/**
 * Core type definitions for RAG Observability Power
 */

// Time window for statistical analysis
export interface TimeWindow {
  start: Date;
  end: Date;
  granularity: "minute" | "hour" | "day" | "week";
}

// Error types for classification
export type ErrorType =
  | "retrieval_failure"
  | "relevance_degradation"
  | "generation_error"
  | "context_overflow"
  | "latency_spike"
  | "embedding_error"
  | "unknown";

// Severity levels
export type Severity = "low" | "medium" | "high" | "critical";

// File change record
export interface FileChange {
  path: string;
  changeType: "added" | "modified" | "deleted";
  diff?: string;
}

// Sentry-style breadcrumbs for tracing
export interface Breadcrumb {
  timestamp: Date;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

// Context for error records
export interface ErrorContext {
  query: string;
  retrievedDocs: string[];
  generationOutput?: string;
  stackTrace?: string;
  breadcrumbs: Breadcrumb[];
}

// Coding context for self-improvement loop
export interface CodingContext {
  currentFile: string;
  recentChanges: FileChange[];
  ragRelatedFiles: string[];
  sessionId: string;
}

// Code change record for fixes
export interface CodeChange {
  filePath: string;
  oldContent: string;
  newContent: string;
  description: string;
}
