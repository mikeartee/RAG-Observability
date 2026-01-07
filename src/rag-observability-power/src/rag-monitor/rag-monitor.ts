/**
 * RAG Monitor Implementation
 *
 * Implements the RAGMonitor interface for tracking RAG system behavior
 * over populations of queries.
 */

import type {
  ControlLimits,
  ErrorType,
  RAGBaseline,
  RAGMonitor,
  RAGQueryEvent,
  RAGStatistics,
  TimeWindow,
} from "../types/index.js";

import type { QueryStore } from "./query-store.js";
import { InMemoryQueryStore } from "./query-store.js";

/**
 * Configuration for RAGMonitorImpl
 */
export interface RAGMonitorConfig {
  /**
   * Query store for persisting events
   */
  queryStore?: QueryStore;

  /**
   * Default control limits for baseline
   */
  defaultControlLimits?: ControlLimits;
}

/**
 * Default control limits for statistical process control
 */
const DEFAULT_CONTROL_LIMITS: ControlLimits = {
  successRateLower: 0.9, // Alert if success rate drops below 90%
  relevanceScoreLower: 0.7, // Alert if relevance drops below 70%
  latencyUpper: 5000, // Alert if latency exceeds 5 seconds
  sigma: 2, // 2 standard deviations for control limits
};

/**
 * Validates that a RAGQueryEvent has all required fields
 */
function validateQueryEvent(event: RAGQueryEvent): void {
  if (!event.id || typeof event.id !== "string") {
    throw new Error("RAGQueryEvent must have a valid id");
  }
  if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
    throw new Error("RAGQueryEvent must have a valid timestamp");
  }
  if (typeof event.query !== "string") {
    throw new Error("RAGQueryEvent must have a query string");
  }
  if (!Array.isArray(event.retrievedDocuments)) {
    throw new Error("RAGQueryEvent must have retrievedDocuments array");
  }
  if (typeof event.contextWindow !== "string") {
    throw new Error("RAGQueryEvent must have a contextWindow string");
  }
  if (typeof event.generationOutput !== "string") {
    throw new Error("RAGQueryEvent must have a generationOutput string");
  }
  if (!event.qualityMetrics) {
    throw new Error("RAGQueryEvent must have qualityMetrics");
  }
  if (
    typeof event.qualityMetrics.retrievalRelevanceScore !== "number" ||
    event.qualityMetrics.retrievalRelevanceScore < 0 ||
    event.qualityMetrics.retrievalRelevanceScore > 1
  ) {
    throw new Error("qualityMetrics.retrievalRelevanceScore must be a number between 0 and 1");
  }
  if (
    typeof event.qualityMetrics.generationConfidence !== "number" ||
    event.qualityMetrics.generationConfidence < 0 ||
    event.qualityMetrics.generationConfidence > 1
  ) {
    throw new Error("qualityMetrics.generationConfidence must be a number between 0 and 1");
  }
  if (
    typeof event.qualityMetrics.latencyMs !== "number" ||
    event.qualityMetrics.latencyMs < 0
  ) {
    throw new Error("qualityMetrics.latencyMs must be a non-negative number");
  }
  if (
    typeof event.qualityMetrics.tokenCount !== "number" ||
    event.qualityMetrics.tokenCount < 0
  ) {
    throw new Error("qualityMetrics.tokenCount must be a non-negative number");
  }
  if (typeof event.success !== "boolean") {
    throw new Error("RAGQueryEvent must have a success boolean");
  }
}

/**
 * RAG Monitor implementation
 */
export class RAGMonitorImpl implements RAGMonitor {
  private queryStore: QueryStore;
  private baseline: RAGBaseline | null = null;
  private defaultControlLimits: ControlLimits;

  constructor(config: RAGMonitorConfig = {}) {
    this.queryStore = config.queryStore ?? new InMemoryQueryStore();
    this.defaultControlLimits = config.defaultControlLimits ?? DEFAULT_CONTROL_LIMITS;
  }

  /**
   * Log a RAG query execution
   * Validates all required fields are present before storing
   */
  async logQuery(event: RAGQueryEvent): Promise<void> {
    validateQueryEvent(event);
    await this.queryStore.store(event);
  }

  /**
   * Get rolling statistics for a time window
   */
  async getStatistics(window: TimeWindow): Promise<RAGStatistics> {
    const events = await this.queryStore.getEventsInWindow(window);

    if (events.length === 0) {
      return this.createEmptyStatistics(window);
    }

    // Calculate success rate
    const successCount = events.filter((e) => e.success).length;
    const successRate = successCount / events.length;

    // Calculate average relevance score
    const relevanceScores = events.map((e) => e.qualityMetrics.retrievalRelevanceScore);
    const avgRelevanceScore = relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length;

    // Calculate latency metrics
    const latencies = events.map((e) => e.qualityMetrics.latencyMs);
    const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95LatencyMs = this.calculatePercentile(latencies, 95);

    // Calculate error breakdown
    const errorBreakdown = this.calculateErrorBreakdown(events);

    return {
      window,
      queryCount: events.length,
      successRate,
      avgRelevanceScore,
      avgLatencyMs,
      p95LatencyMs,
      errorBreakdown,
    };
  }

  /**
   * Get baseline metrics for comparison
   */
  async getBaseline(): Promise<RAGBaseline> {
    if (!this.baseline) {
      // Return default baseline if none set
      const now = new Date();
      return {
        createdAt: now,
        updatedAt: now,
        successRate: 1.0,
        avgRelevanceScore: 1.0,
        avgLatencyMs: 0,
        controlLimits: this.defaultControlLimits,
      };
    }
    return this.baseline;
  }

  /**
   * Update baseline with current metrics
   * Uses all stored events to calculate new baseline
   */
  async updateBaseline(): Promise<void> {
    const allEvents = await this.queryStore.getAll();
    const now = new Date();

    if (allEvents.length === 0) {
      this.baseline = {
        createdAt: now,
        updatedAt: now,
        successRate: 1.0,
        avgRelevanceScore: 1.0,
        avgLatencyMs: 0,
        controlLimits: this.defaultControlLimits,
      };
      return;
    }

    // Calculate metrics from all events
    const successCount = allEvents.filter((e) => e.success).length;
    const successRate = successCount / allEvents.length;

    const relevanceScores = allEvents.map((e) => e.qualityMetrics.retrievalRelevanceScore);
    const avgRelevanceScore = relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length;

    const latencies = allEvents.map((e) => e.qualityMetrics.latencyMs);
    const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Calculate control limits based on standard deviation
    const latencyStdDev = this.calculateStdDev(latencies);
    const relevanceStdDev = this.calculateStdDev(relevanceScores);
    const successStdDev = this.calculateStdDev(allEvents.map((e) => (e.success ? 1 : 0)));

    const sigma = this.defaultControlLimits.sigma;

    this.baseline = {
      createdAt: this.baseline?.createdAt ?? now,
      updatedAt: now,
      successRate,
      avgRelevanceScore,
      avgLatencyMs,
      controlLimits: {
        successRateLower: Math.max(0, successRate - sigma * successStdDev),
        relevanceScoreLower: Math.max(0, avgRelevanceScore - sigma * relevanceStdDev),
        latencyUpper: avgLatencyMs + sigma * latencyStdDev,
        sigma,
      },
    };
  }

  /**
   * Get the underlying query store (for testing)
   */
  getQueryStore(): QueryStore {
    return this.queryStore;
  }

  /**
   * Set baseline directly (for testing or restoring from persistence)
   */
  setBaseline(baseline: RAGBaseline): void {
    this.baseline = baseline;
  }

  private createEmptyStatistics(window: TimeWindow): RAGStatistics {
    return {
      window,
      queryCount: 0,
      successRate: 0,
      avgRelevanceScore: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      errorBreakdown: {
        retrieval_failure: 0,
        relevance_degradation: 0,
        generation_error: 0,
        context_overflow: 0,
        latency_spike: 0,
        embedding_error: 0,
        unknown: 0,
      },
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateErrorBreakdown(events: RAGQueryEvent[]): Record<ErrorType, number> {
    const breakdown: Record<ErrorType, number> = {
      retrieval_failure: 0,
      relevance_degradation: 0,
      generation_error: 0,
      context_overflow: 0,
      latency_spike: 0,
      embedding_error: 0,
      unknown: 0,
    };

    for (const event of events) {
      if (!event.success && event.errorDetails) {
        breakdown[event.errorDetails.type]++;
      }
    }

    return breakdown;
  }
}

