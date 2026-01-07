/**
 * Dashboard Data Provider Implementation
 *
 * Implements the DashboardDataProvider interface for aggregating data
 * from various components for visualization and analysis.
 */

import type {
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
  TimeWindow,
  RAGMonitor,
  DriftDetector,
  CodeCorrelator,
  FailureCapturer,
  ErrorKnowledgeBase,
  FixSuggester,
  ReplayResult,
  RAGQueryEvent,
  DriftAlert,
  ErrorRecord,
} from "../types/index.js";

/**
 * Configuration for DashboardDataProviderImpl
 */
export interface DashboardDataProviderConfig {
  ragMonitor: RAGMonitor;
  driftDetector: DriftDetector;
  codeCorrelator: CodeCorrelator;
  failureCapturer: FailureCapturer;
  errorKnowledgeBase: ErrorKnowledgeBase;
  fixSuggester: FixSuggester;

  /**
   * Function to get all query events (for time-series aggregation)
   */
  getQueryEvents?: (start: Date, end: Date) => Promise<RAGQueryEvent[]>;

  /**
   * Function to determine error status
   */
  getErrorStatus?: (error: ErrorRecord) => ErrorStatus;
}

/**
 * Default error status determination
 */
function defaultGetErrorStatus(error: ErrorRecord): ErrorStatus {
  if (error.fixes.length > 0) {
    const hasResolvedFix = error.fixes.some((f) => f.resolved);
    if (hasResolvedFix) {
      return "fixed";
    }
    return "investigating";
  }
  return "open";
}

/**
 * Group data points by time granularity
 */
function groupByGranularity(
  timestamp: Date,
  granularity: "minute" | "hour" | "day" | "week"
): Date {
  const date = new Date(timestamp);

  switch (granularity) {
    case "minute":
      date.setSeconds(0, 0);
      break;
    case "hour":
      date.setMinutes(0, 0, 0);
      break;
    case "day":
      date.setHours(0, 0, 0, 0);
      break;
    case "week":
      const dayOfWeek = date.getDay();
      date.setDate(date.getDate() - dayOfWeek);
      date.setHours(0, 0, 0, 0);
      break;
  }

  return date;
}

/**
 * Generate time buckets between start and end dates
 */
function generateTimeBuckets(
  start: Date,
  end: Date,
  granularity: "minute" | "hour" | "day" | "week"
): Date[] {
  const buckets: Date[] = [];
  const current = groupByGranularity(start, granularity);

  const incrementMs = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
  };

  while (current <= end) {
    buckets.push(new Date(current));
    current.setTime(current.getTime() + incrementMs[granularity]);
  }

  return buckets;
}

/**
 * Dashboard Data Provider implementation
 */
export class DashboardDataProviderImpl implements DashboardDataProvider {
  private ragMonitor: RAGMonitor;
  private driftDetector: DriftDetector;
  private codeCorrelator: CodeCorrelator;
  private failureCapturer: FailureCapturer;
  private errorKnowledgeBase: ErrorKnowledgeBase;
  private fixSuggester: FixSuggester;
  private getQueryEvents?: (start: Date, end: Date) => Promise<RAGQueryEvent[]>;
  private getErrorStatus: (error: ErrorRecord) => ErrorStatus;

  constructor(config: DashboardDataProviderConfig) {
    this.ragMonitor = config.ragMonitor;
    this.driftDetector = config.driftDetector;
    this.codeCorrelator = config.codeCorrelator;
    this.failureCapturer = config.failureCapturer;
    this.errorKnowledgeBase = config.errorKnowledgeBase;
    this.fixSuggester = config.fixSuggester;
    this.getQueryEvents = config.getQueryEvents;
    this.getErrorStatus = config.getErrorStatus ?? defaultGetErrorStatus;
  }

  /**
   * Get time-series data for RAG metrics
   *
   * Creates data aggregation for time-series charts showing
   * success/failure rates over time.
   *
   * Requirements: 6.1
   */
  async getMetricsTimeSeries(
    startDate: Date,
    endDate: Date,
    granularity: "minute" | "hour" | "day" | "week"
  ): Promise<RAGMetricsTimeSeries> {
    const timeBuckets = generateTimeBuckets(startDate, endDate, granularity);

    // Initialize empty time series
    const successRate: TimeSeriesDataPoint[] = [];
    const relevanceScore: TimeSeriesDataPoint[] = [];
    const latency: TimeSeriesDataPoint[] = [];
    const queryCount: TimeSeriesDataPoint[] = [];

    // Get statistics for each time bucket
    for (let i = 0; i < timeBuckets.length - 1; i++) {
      const bucketStart = timeBuckets[i];
      const bucketEnd = timeBuckets[i + 1];

      const window: TimeWindow = {
        start: bucketStart,
        end: bucketEnd,
        granularity,
      };

      const stats = await this.ragMonitor.getStatistics(window);

      successRate.push({
        timestamp: bucketStart,
        value: stats.successRate,
        label: `${(stats.successRate * 100).toFixed(1)}%`,
      });

      relevanceScore.push({
        timestamp: bucketStart,
        value: stats.avgRelevanceScore,
        label: `${(stats.avgRelevanceScore * 100).toFixed(1)}%`,
      });

      latency.push({
        timestamp: bucketStart,
        value: stats.avgLatencyMs,
        label: `${stats.avgLatencyMs.toFixed(0)}ms`,
      });

      queryCount.push({
        timestamp: bucketStart,
        value: stats.queryCount,
        label: `${stats.queryCount} queries`,
      });
    }

    return {
      successRate,
      relevanceScore,
      latency,
      queryCount,
    };
  }

  /**
   * Get drift events for highlighting on charts
   *
   * Implements drift event highlighting for dashboard visualization.
   *
   * Requirements: 6.2
   */
  async getDriftEvents(
    startDate: Date,
    endDate: Date
  ): Promise<DriftEventHighlight[]> {
    const alerts = await this.driftDetector.getActiveAlerts();

    // Filter alerts within the time range and include acknowledged ones
    const allAlerts = alerts.filter(
      (alert) => alert.timestamp >= startDate && alert.timestamp <= endDate
    );

    return allAlerts.map((alert) => ({
      id: alert.id,
      timestamp: alert.timestamp,
      severity: alert.result.severity,
      message: alert.result.message,
      metrics: alert.result.metrics,
      acknowledged: alert.acknowledged,
    }));
  }

  /**
   * Get commit timeline correlated with performance
   *
   * Creates commit timeline correlation data showing commits
   * alongside performance metrics.
   *
   * Requirements: 6.3, 6.4
   */
  async getCommitTimeline(
    startDate: Date,
    endDate: Date
  ): Promise<CommitTimelineEntry[]> {
    // Get commits in the time window
    const commits = await this.codeCorrelator.getCommitsInWindow(startDate, endDate);

    // Get drift events to correlate with commits
    const driftEvents = await this.getDriftEvents(startDate, endDate);

    // Rank commits to identify RAG-related changes
    const rankedCommits = await this.codeCorrelator.rankCommits(commits, "all");

    // Create timeline entries
    const timeline: CommitTimelineEntry[] = rankedCommits.map((ranked) => {
      // Find drift events that occurred after this commit
      const correlatedDriftEvents = driftEvents
        .filter((event) => {
          const eventTime = event.timestamp.getTime();
          const commitTime = ranked.commit.timestamp.getTime();
          // Drift event within 24 hours after commit
          return eventTime > commitTime && eventTime - commitTime < 24 * 60 * 60 * 1000;
        })
        .map((event) => event.id);

      return {
        commit: ranked.commit,
        timestamp: ranked.commit.timestamp,
        ragRelated: ranked.ragRelatedFiles.length > 0,
        ragRelatedFiles: ranked.ragRelatedFiles,
        correlatedDriftEvents,
        probability: ranked.probability,
      };
    });

    // Sort by timestamp descending (most recent first)
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return timeline;
  }

  /**
   * Get list of errors with status
   *
   * Lists recent errors with their status for dashboard display.
   *
   * Requirements: 6.4
   */
  async getErrorList(filters: DashboardFilters): Promise<ErrorListItem[]> {
    // Query errors from knowledge base with filters
    const errors = await (this.errorKnowledgeBase as ErrorKnowledgeBaseWithQuery).queryErrors({
      type: filters.errorType,
      component: filters.component,
      severity: filters.severity,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Convert to list items with status
    const listItems: ErrorListItem[] = [];

    for (const error of errors) {
      const status = this.getErrorStatus(error);

      // Filter by status if specified
      if (filters.status && status !== filters.status) {
        continue;
      }

      // Check if fix suggestions are available
      const suggestions = await this.fixSuggester.suggestFixes(error);

      listItems.push({
        id: error.id,
        timestamp: error.timestamp,
        type: error.type,
        component: error.component,
        severity: error.severity,
        status,
        query: error.context.query,
        hasFixSuggestions: suggestions.length > 0,
        fixCount: error.fixes.length,
      });
    }

    // Sort by timestamp descending (most recent first)
    listItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return listItems;
  }

  /**
 * Get detailed error view with similar errors and suggestions
 *
 * Aggregates error context, similar errors, and suggestions
 * for the error detail view.
 *
 * Requirements: 6.5
 */
  async getErrorDetail(errorId: string): Promise<ErrorDetailView> {
    // Get the error record
    const error = await this.errorKnowledgeBase.getError(errorId);

    // Get similar errors
    const similarErrors = await this.errorKnowledgeBase.searchSimilar({
      queryEmbedding: error.embedding,
      limit: 5,
    });

    // Filter out the current error from similar errors
    const filteredSimilarErrors = similarErrors.filter((se) => se.error.id !== errorId);

    // Get fix suggestions
    const fixSuggestions = await this.fixSuggester.suggestFixes(error);

    // Try to find related captured failure for one-click replay
    let relatedFailure: import("../types/index.js").CapturedFailure | undefined;
    let replayReady = false;

    try {
      // Search for failures with matching query within a time window
      const failures = await this.failureCapturer.listFailures({
        startDate: new Date(error.timestamp.getTime() - 60000), // 1 minute before
        endDate: new Date(error.timestamp.getTime() + 60000), // 1 minute after
      });

      // Find failure with matching query
      relatedFailure = failures.find(
        (f) => f.queryEvent.query === error.context.query
      );

      if (relatedFailure) {
        replayReady = relatedFailure.replayable;
      }
    } catch {
      // No related failure found
    }

    return {
      error,
      similarErrors: filteredSimilarErrors,
      fixSuggestions,
      relatedFailure,
      replayReady,
    };
  }

  /**
   * Get error detail with full context for debugging
   *
   * Extended version that includes additional context for debugging,
   * including breadcrumbs, stack traces, and related failures.
   *
   * Requirements: 6.5
   */
  async getErrorDetailWithContext(errorId: string): Promise<ErrorDetailView & {
    breadcrumbs: import("../types/index.js").Breadcrumb[];
    stackTrace?: string;
    relatedFailures: import("../types/index.js").CapturedFailure[];
  }> {
    const baseDetail = await this.getErrorDetail(errorId);

    // Get all related failures (not just the closest one)
    let relatedFailures: import("../types/index.js").CapturedFailure[] = [];

    try {
      // Search for failures within a wider time window
      const failures = await this.failureCapturer.listFailures({
        startDate: new Date(baseDetail.error.timestamp.getTime() - 3600000), // 1 hour before
        endDate: new Date(baseDetail.error.timestamp.getTime() + 3600000), // 1 hour after
      });

      // Filter to failures with similar queries
      relatedFailures = failures.filter((f) => {
        const queryMatch = f.queryEvent.query === baseDetail.error.context.query;
        const componentMatch = f.queryEvent.errorDetails?.type === baseDetail.error.type;
        return queryMatch || componentMatch;
      });
    } catch {
      // No related failures found
    }

    return {
      ...baseDetail,
      breadcrumbs: baseDetail.error.context.breadcrumbs,
      stackTrace: baseDetail.error.context.stackTrace,
      relatedFailures,
    };
  }

  /**
   * Prepare error for one-click replay
   *
   * Finds or creates a replayable failure capture for the error.
   *
   * Requirements: 6.5
   */
  async prepareErrorForReplay(errorId: string): Promise<{
    errorId: string;
    failureId?: string;
    replayReady: boolean;
    message: string;
  }> {
    const detail = await this.getErrorDetail(errorId);

    if (detail.relatedFailure) {
      return {
        errorId,
        failureId: detail.relatedFailure.id,
        replayReady: detail.replayReady,
        message: detail.replayReady
          ? "Ready for replay"
          : "Failure captured but replay function not configured",
      };
    }

    return {
      errorId,
      replayReady: false,
      message: "No captured failure found for this error. Capture a failure first to enable replay.",
    };
  }

  /**
   * Get dashboard summary statistics
   */
  async getSummary(startDate: Date, endDate: Date): Promise<DashboardSummary> {
    // Get overall statistics
    const window: TimeWindow = {
      start: startDate,
      end: endDate,
      granularity: "day",
    };

    const stats = await this.ragMonitor.getStatistics(window);

    // Get active drift alerts
    const driftAlerts = await this.driftDetector.getActiveAlerts();
    const activeDriftAlerts = driftAlerts.filter((a) => !a.acknowledged).length;

    // Get open errors count
    const errors = await (this.errorKnowledgeBase as ErrorKnowledgeBaseWithQuery).queryErrors({
      startDate,
      endDate,
    });
    const openErrors = errors.filter((e) => this.getErrorStatus(e) === "open").length;

    // Get recent commits count
    const commits = await this.codeCorrelator.getCommitsInWindow(startDate, endDate);

    return {
      totalQueries: stats.queryCount,
      successRate: stats.successRate,
      avgRelevanceScore: stats.avgRelevanceScore,
      avgLatencyMs: stats.avgLatencyMs,
      activeDriftAlerts,
      openErrors,
      recentCommits: commits.length,
    };
  }

  /**
   * Prepare failure for replay
   *
   * Supports one-click replay data preparation.
   *
   * Requirements: 6.5
   */
  async prepareReplay(failureId: string): Promise<ReplayPreparation> {
    const failure = await this.failureCapturer.getFailure(failureId);

    return {
      failureId,
      ready: failure.replayable,
      failure,
      estimatedDuration: failure.replayable ? 5000 : undefined, // 5 seconds estimate
    };
  }

  /**
   * Execute replay and get result
   */
  async executeReplay(failureId: string): Promise<ReplayResult> {
    return this.failureCapturer.replayFailure(failureId);
  }
}

/**
 * Extended ErrorKnowledgeBase interface with queryErrors method
 */
interface ErrorKnowledgeBaseWithQuery extends ErrorKnowledgeBase {
  queryErrors(filters: import("../types/index.js").ErrorQuery): Promise<ErrorRecord[]>;
}

