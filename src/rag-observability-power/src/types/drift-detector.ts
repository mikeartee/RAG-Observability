/**
 * Drift Detector type definitions
 */

import type { Severity } from "./core.js";
import type { ControlLimits, RAGBaseline, RAGStatistics } from "./rag-monitor.js";

// Individual drift metric
export interface DriftMetric {
  name: string;
  baseline: number;
  current: number;
  changePercent: number;
  controlLimit: number;
  breached: boolean;
}

// Result of drift detection
export interface DriftResult {
  hasDrift: boolean;
  metrics: DriftMetric[];
  severity: Severity;
  confidenceInterval: number;
  message: string; // e.g., "retrieval relevance dropped 15% over 48 hours"
}

// Drift alert
export interface DriftAlert {
  id: string;
  timestamp: Date;
  result: DriftResult;
  acknowledged: boolean;
}

// Control limit configuration
export interface ControlLimitConfig {
  successRateLower: number;
  relevanceScoreLower: number;
  latencyUpper: number;
  sigma: number;
}

// Drift Detector interface
export interface DriftDetector {
  // Check current metrics against control limits
  checkForDrift(statistics: RAGStatistics, baseline: RAGBaseline): DriftResult;

  // Configure control limits and sensitivity
  setControlLimits(config: ControlLimitConfig): void;

  // Get active drift alerts
  getActiveAlerts(): Promise<DriftAlert[]>;
}
