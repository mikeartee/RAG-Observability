/**
 * Dashboard type definitions
 *
 * Types for the dashboard data layer that provides aggregated data
 * for visualization and analysis.
 */

import type { Severity, ErrorType } from "./core.js";
import type { DriftAlert, DriftMetric } from "./drift-detector.js";
import type { Commit, RankedCommit } from "./code-correlator.js";
import type { ErrorRecord, FixRecord, SimilarError } from "./error-knowledge-base.js";
import type { FixSuggestion } from "./fix-suggester.js";
import type { CapturedFailure, ReplayResult } from "./failure-capturer.js";

/**
 * Time-series data point for charts
 */
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

/**
 * Time-series data for RAG metrics
 */
export interface RAGMetricsTimeSeries {
  successRate: TimeSeriesDataPoint[];
  relevanceScore: TimeSeriesDataPoint[];
  latency: TimeSeriesDataPoint[];
  queryCount: TimeSeriesDataPoint[];
}

/**
 * Drift event for highlighting on charts
 */
export interface DriftEventHighlight {
  id: string;
  timestamp: Date;
  severity: Severity;
  message: string;
  metrics: DriftMetric[];
  acknowledged: boolean;
}

/**
 * Commit timeline entry correlated with performance
 */
export interface CommitTimelineEntry {
  commit: Commit;
  timestamp: Date;
  ragRelated: boolean;
  ragRelatedFiles: string[];
  correlatedDriftEvents: string[];
  probability?: number;
}

/**
 * Error status for dashboard display
 */
export type ErrorStatus = "open" | "investigating" | "fixed";

/**
 * Error list item for dashboard
 */
export interface ErrorListItem {
  id: string;
  timestamp: Date;
  type: ErrorType;
  component: string;
  severity: Severity;
  status: ErrorStatus;
  query: string;
  hasFixSuggestions: boolean;
  fixCount: number;
}

/**
 * Error detail view data
 */
export interface ErrorDetailView {
  error: ErrorRecord;
  similarErrors: SimilarError[];
  fixSuggestions: FixSuggestion[];
  relatedFailure?: CapturedFailure;
  replayReady: boolean;
}

/**
 * Dashboard filters
 */
export interface DashboardFilters {
  startDate?: Date;
  endDate?: Date;
  errorType?: ErrorType;
  component?: string;
  severity?: Severity;
  status?: ErrorStatus;
}

/**
 * Dashboard summary statistics
 */
export interface DashboardSummary {
  totalQueries: number;
  successRate: number;
  avgRelevanceScore: number;
  avgLatencyMs: number;
  activeDriftAlerts: number;
  openErrors: number;
  recentCommits: number;
}

/**
 * Replay preparation data
 */
export interface ReplayPreparation {
  failureId: string;
  ready: boolean;
  failure: CapturedFailure;
  estimatedDuration?: number;
}

/**
 * Dashboard data provider interface
 */
export interface DashboardDataProvider {
  /**
   * Get time-series data for RAG metrics
   */
  getMetricsTimeSeries(
    startDate: Date,
    endDate: Date,
    granularity: "minute" | "hour" | "day" | "week"
  ): Promise<RAGMetricsTimeSeries>;

  /**
   * Get drift events for highlighting on charts
   */
  getDriftEvents(startDate: Date, endDate: Date): Promise<DriftEventHighlight[]>;

  /**
   * Get commit timeline correlated with performance
   */
  getCommitTimeline(startDate: Date, endDate: Date): Promise<CommitTimelineEntry[]>;

  /**
   * Get list of errors with status
   */
  getErrorList(filters: DashboardFilters): Promise<ErrorListItem[]>;

  /**
   * Get detailed error view with similar errors and suggestions
   */
  getErrorDetail(errorId: string): Promise<ErrorDetailView>;

  /**
   * Get dashboard summary statistics
   */
  getSummary(startDate: Date, endDate: Date): Promise<DashboardSummary>;

  /**
   * Prepare failure for replay
   */
  prepareReplay(failureId: string): Promise<ReplayPreparation>;

  /**
   * Execute replay and get result
   */
  executeReplay(failureId: string): Promise<ReplayResult>;
}

