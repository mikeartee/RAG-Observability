/**
 * Drift Detector Implementation
 *
 * Implements the DriftDetector interface for identifying statistical changes
 * in RAG performance over time using statistical process control.
 */

import type {
  ControlLimitConfig,
  DriftAlert,
  DriftDetector,
  DriftMetric,
  DriftResult,
  RAGBaseline,
  RAGStatistics,
  Severity,
} from "../types/index.js";

/**
 * Default control limit configuration
 */
const DEFAULT_CONTROL_LIMITS: ControlLimitConfig = {
  successRateLower: 0.9,
  relevanceScoreLower: 0.7,
  latencyUpper: 5000,
  sigma: 2,
};

/**
 * Generate a unique ID for alerts
 */
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Calculate the percentage change between two values
 */
function calculateChangePercent(baseline: number, current: number): number {
  if (baseline === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - baseline) / baseline) * 100;
}

/**
 * Determine severity based on how many metrics are breached and by how much
 */
function determineSeverity(metrics: DriftMetric[]): Severity {
  const breachedMetrics = metrics.filter((m) => m.breached);
  const breachCount = breachedMetrics.length;

  if (breachCount === 0) {
    return "low";
  }

  // Calculate average breach magnitude
  const avgBreachMagnitude =
    breachedMetrics.reduce((sum, m) => sum + Math.abs(m.changePercent), 0) /
    breachCount;

  if (breachCount >= 3 || avgBreachMagnitude > 50) {
    return "critical";
  }
  if (breachCount >= 2 || avgBreachMagnitude > 30) {
    return "high";
  }
  if (avgBreachMagnitude > 15) {
    return "medium";
  }
  return "low";
}

/**
 * Generate a human-readable message describing the drift
 */
function generateDriftMessage(metrics: DriftMetric[], window?: { hours?: number }): string {
  const breachedMetrics = metrics.filter((m) => m.breached);

  if (breachedMetrics.length === 0) {
    return "No significant drift detected";
  }

  const timeFrame = window?.hours ? `over ${window.hours} hours` : "recently";
  const descriptions: string[] = [];

  for (const metric of breachedMetrics) {
    const direction = metric.changePercent > 0 ? "increased" : "dropped";
    const absChange = Math.abs(metric.changePercent).toFixed(1);

    switch (metric.name) {
      case "successRate":
        descriptions.push(`success rate ${direction} ${absChange}%`);
        break;
      case "relevanceScore":
        descriptions.push(`retrieval relevance ${direction} ${absChange}%`);
        break;
      case "latency":
        descriptions.push(`latency ${direction} ${absChange}%`);
        break;
      default:
        descriptions.push(`${metric.name} ${direction} ${absChange}%`);
    }
  }

  return `${descriptions.join(", ")} ${timeFrame}`;
}

/**
 * Calculate confidence interval based on sample size and sigma
 */
function calculateConfidenceInterval(sigma: number): number {
  // Standard confidence intervals based on sigma
  // 1 sigma = 68.27%, 2 sigma = 95.45%, 3 sigma = 99.73%
  const confidenceMap: Record<number, number> = {
    1: 0.6827,
    2: 0.9545,
    3: 0.9973,
  };
  return confidenceMap[Math.round(sigma)] ?? 0.95;
}

/**
 * Drift Detector implementation using statistical process control
 */
export class DriftDetectorImpl implements DriftDetector {
  private controlLimits: ControlLimitConfig;
  private alerts: DriftAlert[] = [];

  constructor(config?: Partial<ControlLimitConfig>) {
    this.controlLimits = {
      ...DEFAULT_CONTROL_LIMITS,
      ...config,
    };
  }

  /**
   * Check current metrics against control limits
   * Generates an alert if any metric breaches its control limit
   */
  checkForDrift(statistics: RAGStatistics, baseline: RAGBaseline): DriftResult {
    const metrics = this.calculateDriftMetrics(statistics, baseline);
    const hasDrift = metrics.some((m) => m.breached);
    const severity = determineSeverity(metrics);
    const confidenceInterval = calculateConfidenceInterval(
      baseline.controlLimits?.sigma ?? this.controlLimits.sigma
    );

    // Calculate time window in hours for message
    const windowHours = statistics.window
      ? Math.round(
          (statistics.window.end.getTime() - statistics.window.start.getTime()) /
            (1000 * 60 * 60)
        )
      : undefined;

    const message = generateDriftMessage(
      metrics,
      windowHours ? { hours: windowHours } : undefined
    );

    const result: DriftResult = {
      hasDrift,
      metrics,
      severity,
      confidenceInterval,
      message,
    };

    // Store alert if drift detected
    if (hasDrift) {
      this.storeAlert(result);
    }

    return result;
  }

  /**
   * Configure control limits and sensitivity
   */
  setControlLimits(config: ControlLimitConfig): void {
    this.controlLimits = { ...config };
  }

  /**
   * Get active drift alerts (not acknowledged)
   */
  async getActiveAlerts(): Promise<DriftAlert[]> {
    return this.alerts.filter((alert) => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert by ID
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get all alerts (for testing)
   */
  getAllAlerts(): DriftAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear all alerts (for testing)
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get current control limits
   */
  getControlLimits(): ControlLimitConfig {
    return { ...this.controlLimits };
  }

  private calculateDriftMetrics(
    statistics: RAGStatistics,
    baseline: RAGBaseline
  ): DriftMetric[] {
    const limits = baseline.controlLimits ?? this.controlLimits;

    const metrics: DriftMetric[] = [];

    // Success rate metric (lower is worse)
    const successRateChange = calculateChangePercent(
      baseline.successRate,
      statistics.successRate
    );
    metrics.push({
      name: "successRate",
      baseline: baseline.successRate,
      current: statistics.successRate,
      changePercent: successRateChange,
      controlLimit: limits.successRateLower,
      breached: statistics.successRate < limits.successRateLower,
    });

    // Relevance score metric (lower is worse)
    const relevanceChange = calculateChangePercent(
      baseline.avgRelevanceScore,
      statistics.avgRelevanceScore
    );
    metrics.push({
      name: "relevanceScore",
      baseline: baseline.avgRelevanceScore,
      current: statistics.avgRelevanceScore,
      changePercent: relevanceChange,
      controlLimit: limits.relevanceScoreLower,
      breached: statistics.avgRelevanceScore < limits.relevanceScoreLower,
    });

    // Latency metric (higher is worse)
    const latencyChange = calculateChangePercent(
      baseline.avgLatencyMs,
      statistics.avgLatencyMs
    );
    metrics.push({
      name: "latency",
      baseline: baseline.avgLatencyMs,
      current: statistics.avgLatencyMs,
      changePercent: latencyChange,
      controlLimit: limits.latencyUpper,
      breached: statistics.avgLatencyMs > limits.latencyUpper,
    });

    return metrics;
  }

  private storeAlert(result: DriftResult): void {
    const alert: DriftAlert = {
      id: generateAlertId(),
      timestamp: new Date(),
      result,
      acknowledged: false,
    };
    this.alerts.push(alert);
  }
}
