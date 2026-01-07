/**
 * RAG Observability Power - Type Definitions
 *
 * This module exports all type definitions for the RAG Observability Power.
 */

// Core types
export type {
  Breadcrumb,
  CodeChange,
  CodingContext,
  ErrorContext,
  ErrorType,
  FileChange,
  Severity,
  TimeWindow,
} from "./core.js";

// RAG Monitor types
export type {
  ControlLimits,
  ErrorDetails,
  QualityMetrics,
  RAGBaseline,
  RAGMonitor,
  RAGQueryEvent,
  RAGStatistics,
  RetrievedDocument,
} from "./rag-monitor.js";

// Drift Detector types
export type {
  ControlLimitConfig,
  DriftAlert,
  DriftDetector,
  DriftMetric,
  DriftResult,
} from "./drift-detector.js";

// Code Correlator types
export type {
  CodeCorrelator,
  Commit,
  CommitDiff,
  FileDiff,
  RankedCommit,
} from "./code-correlator.js";

// Failure Capturer types
export type {
  CapturedFailure,
  FailureCapturer,
  FailureFilters,
  ReplayResult,
  RetrievalState,
  SystemState,
} from "./failure-capturer.js";

// Error Knowledge Base types
export type {
  ErrorKnowledgeBase,
  ErrorQuery,
  ErrorRecord,
  FixRecord,
  SimilarError,
} from "./error-knowledge-base.js";

// Fix Suggester types
export type { FixSuggester, FixSuggestion } from "./fix-suggester.js";

// Self-Improvement types
export type {
  FixPattern,
  RelevantError,
  SelfImprovementLoop,
  SteeringRule,
} from "./self-improvement.js";

// Storage types
export type {
  BaselineTable,
  CapturedFailureTable,
  ErrorEmbeddingRecord,
  ErrorTable,
  FixTable,
  QueryEventTable,
  SteeringRuleTable,
} from "./storage.js";

// Dashboard types
export type {
  CommitTimelineEntry,
  DashboardDataProvider,
  DashboardFilters,
  DashboardSummary,
  DriftEventHighlight,
  ErrorDetailView,
  ErrorListItem,
  ErrorStatus,
  RAGMetricsTimeSeries,
  ReplayPreparation,
  TimeSeriesDataPoint,
} from "./dashboard.js";
