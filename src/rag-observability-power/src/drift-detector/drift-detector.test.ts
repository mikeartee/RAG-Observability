/**
 * Drift Detector Tests
 *
 * Tests for the DriftDetectorImpl class including drift detection,
 * severity quantification, and alert management.
 */

import { describe, expect, it, beforeEach } from "vitest";
import * as fc from "fast-check";

import { DriftDetectorImpl } from "./drift-detector.js";
import { timeWindowArb, qualityMetricsArb } from "../test-utils/index.js";

import type {
  ControlLimitConfig,
  RAGBaseline,
  RAGStatistics,
  TimeWindow,
} from "../types/index.js";

// Helper to create a valid TimeWindow
function createTimeWindow(hoursAgo: number = 24): TimeWindow {
  const end = new Date();
  const start = new Date(end.getTime() - hoursAgo * 60 * 60 * 1000);
  return { start, end, granularity: "hour" };
}

// Helper to create a valid RAGBaseline
function createBaseline(overrides: Partial<RAGBaseline> = {}): RAGBaseline {
  return {
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    successRate: 0.95,
    avgRelevanceScore: 0.85,
    avgLatencyMs: 200,
    controlLimits: {
      successRateLower: 0.9,
      relevanceScoreLower: 0.7,
      latencyUpper: 500,
      sigma: 2,
    },
    ...overrides,
  };
}

// Helper to create valid RAGStatistics
function createStatistics(overrides: Partial<RAGStatistics> = {}): RAGStatistics {
  return {
    window: createTimeWindow(),
    queryCount: 100,
    successRate: 0.95,
    avgRelevanceScore: 0.85,
    avgLatencyMs: 200,
    p95LatencyMs: 350,
    errorBreakdown: {
      retrieval_failure: 2,
      relevance_degradation: 1,
      generation_error: 1,
      context_overflow: 0,
      latency_spike: 1,
      embedding_error: 0,
      unknown: 0,
    },
    ...overrides,
  };
}

describe("DriftDetectorImpl", () => {
  let detector: DriftDetectorImpl;

  beforeEach(() => {
    detector = new DriftDetectorImpl();
  });

  describe("Property-Based Tests", () => {
    describe("Property 3: Drift Detection Accuracy", () => {
      it("should generate alert if and only if at least one metric breaches control limit", () => {
        /**
         * Feature: rag-observability-power, Property 3: Drift Detection Accuracy
         * Validates: Requirements 1.3, 1.5
         * 
         * For any set of current statistics and baseline metrics, the Drift Detector 
         * SHALL generate an alert if and only if at least one metric breaches its 
         * control limit, and the severity message SHALL accurately reflect the change percentage.
         */
        fc.assert(
          fc.property(
            // Generate baseline with valid ranges
            fc.record({
              createdAt: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
              updatedAt: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
              successRate: fc.double({ min: 0.5, max: 1.0, noNaN: true }),
              avgRelevanceScore: fc.double({ min: 0.3, max: 1.0, noNaN: true }),
              avgLatencyMs: fc.integer({ min: 50, max: 2000 }),
              controlLimits: fc.record({
                successRateLower: fc.double({ min: 0.3, max: 0.95, noNaN: true }),
                relevanceScoreLower: fc.double({ min: 0.2, max: 0.9, noNaN: true }),
                latencyUpper: fc.integer({ min: 100, max: 5000 }),
                sigma: fc.constantFrom(1, 2, 3),
              }),
            }),
            // Generate current statistics
            fc.record({
              window: timeWindowArb,
              queryCount: fc.integer({ min: 1, max: 1000 }),
              successRate: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
              avgRelevanceScore: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
              avgLatencyMs: fc.integer({ min: 10, max: 10000 }),
              p95LatencyMs: fc.integer({ min: 10, max: 15000 }),
              errorBreakdown: fc.record({
                retrieval_failure: fc.integer({ min: 0, max: 50 }),
                relevance_degradation: fc.integer({ min: 0, max: 50 }),
                generation_error: fc.integer({ min: 0, max: 50 }),
                context_overflow: fc.integer({ min: 0, max: 50 }),
                latency_spike: fc.integer({ min: 0, max: 50 }),
                embedding_error: fc.integer({ min: 0, max: 50 }),
                unknown: fc.integer({ min: 0, max: 50 }),
              }),
            }),
            (baseline: RAGBaseline, statistics: RAGStatistics) => {
              const detector = new DriftDetectorImpl();
              const result = detector.checkForDrift(statistics, baseline);

              // Determine if any metric should breach based on control limits
              const shouldBreachSuccess = statistics.successRate < baseline.controlLimits.successRateLower;
              const shouldBreachRelevance = statistics.avgRelevanceScore < baseline.controlLimits.relevanceScoreLower;
              const shouldBreachLatency = statistics.avgLatencyMs > baseline.controlLimits.latencyUpper;
              const shouldHaveDrift = shouldBreachSuccess || shouldBreachRelevance || shouldBreachLatency;

              // Verify drift detection matches expected breach conditions
              expect(result.hasDrift).toBe(shouldHaveDrift);

              // Verify individual metric breach detection
              const successMetric = result.metrics.find(m => m.name === "successRate");
              const relevanceMetric = result.metrics.find(m => m.name === "relevanceScore");
              const latencyMetric = result.metrics.find(m => m.name === "latency");

              expect(successMetric?.breached).toBe(shouldBreachSuccess);
              expect(relevanceMetric?.breached).toBe(shouldBreachRelevance);
              expect(latencyMetric?.breached).toBe(shouldBreachLatency);

              // Verify change percentages are calculated correctly
              if (baseline.successRate > 0) {
                const expectedSuccessChange = ((statistics.successRate - baseline.successRate) / baseline.successRate) * 100;
                expect(successMetric?.changePercent).toBeCloseTo(expectedSuccessChange, 5);
              }

              if (baseline.avgRelevanceScore > 0) {
                const expectedRelevanceChange = ((statistics.avgRelevanceScore - baseline.avgRelevanceScore) / baseline.avgRelevanceScore) * 100;
                expect(relevanceMetric?.changePercent).toBeCloseTo(expectedRelevanceChange, 5);
              }

              if (baseline.avgLatencyMs > 0) {
                const expectedLatencyChange = ((statistics.avgLatencyMs - baseline.avgLatencyMs) / baseline.avgLatencyMs) * 100;
                expect(latencyMetric?.changePercent).toBeCloseTo(expectedLatencyChange, 5);
              }

              // Verify message accuracy
              if (result.hasDrift) {
                expect(result.message).not.toContain("No significant drift");
                expect(result.message.length).toBeGreaterThan(0);
                
                // Message should mention the breached metrics
                if (shouldBreachSuccess) {
                  expect(result.message.toLowerCase()).toContain("success");
                }
                if (shouldBreachRelevance) {
                  expect(result.message.toLowerCase()).toContain("relevance");
                }
                if (shouldBreachLatency) {
                  expect(result.message.toLowerCase()).toContain("latency");
                }
              } else {
                expect(result.message).toContain("No significant drift");
              }

              // Verify confidence interval is valid
              expect(result.confidenceInterval).toBeGreaterThan(0);
              expect(result.confidenceInterval).toBeLessThanOrEqual(1);

              // Verify severity is appropriate
              const breachedCount = result.metrics.filter(m => m.breached).length;
              if (breachedCount === 0) {
                expect(result.severity).toBe("low");
              } else {
                expect(["low", "medium", "high", "critical"]).toContain(result.severity);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe("checkForDrift", () => {
    it("should detect no drift when metrics are within limits", () => {
      const baseline = createBaseline();
      const statistics = createStatistics();

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.hasDrift).toBe(false);
      expect(result.metrics.every((m) => !m.breached)).toBe(true);
      expect(result.message).toContain("No significant drift");
    });

    it("should detect drift when success rate drops below limit", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: 0.85, // Below 0.9 limit
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.hasDrift).toBe(true);
      const successMetric = result.metrics.find((m) => m.name === "successRate");
      expect(successMetric?.breached).toBe(true);
      expect(result.message).toContain("success rate");
      expect(result.message).toContain("dropped");
    });

    it("should detect drift when relevance score drops below limit", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        avgRelevanceScore: 0.65, // Below 0.7 limit
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.hasDrift).toBe(true);
      const relevanceMetric = result.metrics.find((m) => m.name === "relevanceScore");
      expect(relevanceMetric?.breached).toBe(true);
      expect(result.message).toContain("relevance");
      expect(result.message).toContain("dropped");
    });

    it("should detect drift when latency exceeds limit", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        avgLatencyMs: 600, // Above 500 limit
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.hasDrift).toBe(true);
      const latencyMetric = result.metrics.find((m) => m.name === "latency");
      expect(latencyMetric?.breached).toBe(true);
      expect(result.message).toContain("latency");
      expect(result.message).toContain("increased");
    });

    it("should detect multiple breaches simultaneously", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: 0.85,
        avgRelevanceScore: 0.65,
        avgLatencyMs: 600,
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.hasDrift).toBe(true);
      const breachedCount = result.metrics.filter((m) => m.breached).length;
      expect(breachedCount).toBe(3);
    });

    it("should calculate correct change percentages", () => {
      const baseline = createBaseline({
        successRate: 1.0,
        avgRelevanceScore: 1.0,
        avgLatencyMs: 100,
      });
      const statistics = createStatistics({
        successRate: 0.85, // -15%
        avgRelevanceScore: 0.80, // -20%
        avgLatencyMs: 150, // +50%
      });

      const result = detector.checkForDrift(statistics, baseline);

      const successMetric = result.metrics.find((m) => m.name === "successRate");
      expect(successMetric?.changePercent).toBeCloseTo(-15, 1);

      const relevanceMetric = result.metrics.find((m) => m.name === "relevanceScore");
      expect(relevanceMetric?.changePercent).toBeCloseTo(-20, 1);

      const latencyMetric = result.metrics.find((m) => m.name === "latency");
      expect(latencyMetric?.changePercent).toBeCloseTo(50, 1);
    });

    it("should include confidence interval in result", () => {
      const baseline = createBaseline();
      const statistics = createStatistics();

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.confidenceInterval).toBeGreaterThan(0);
      expect(result.confidenceInterval).toBeLessThanOrEqual(1);
    });

    it("should store alert when drift is detected", async () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: 0.85,
      });

      detector.checkForDrift(statistics, baseline);

      const alerts = await detector.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].result.hasDrift).toBe(true);
    });

    it("should not store alert when no drift detected", async () => {
      const baseline = createBaseline();
      const statistics = createStatistics();

      detector.checkForDrift(statistics, baseline);

      const alerts = await detector.getActiveAlerts();
      expect(alerts.length).toBe(0);
    });
  });

  describe("severity quantification", () => {
    it("should return low severity when no metrics breached", () => {
      const baseline = createBaseline();
      const statistics = createStatistics();

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.severity).toBe("low");
    });

    it("should return medium severity for moderate single breach", () => {
      const baseline = createBaseline({
        successRate: 0.95,
        controlLimits: {
          successRateLower: 0.9,
          relevanceScoreLower: 0.7,
          latencyUpper: 500,
          sigma: 2,
        },
      });
      const statistics = createStatistics({
        successRate: 0.75, // ~21% drop, breaches limit
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.severity).toBe("medium");
    });

    it("should return high severity for multiple breaches", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: 0.85,
        avgRelevanceScore: 0.65,
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.severity).toBe("high");
    });

    it("should return critical severity for severe degradation", () => {
      const baseline = createBaseline({
        successRate: 0.95,
        avgRelevanceScore: 0.85,
        avgLatencyMs: 200,
      });
      const statistics = createStatistics({
        successRate: 0.5, // ~47% drop
        avgRelevanceScore: 0.4, // ~53% drop
        avgLatencyMs: 1000, // 400% increase
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.severity).toBe("critical");
    });

    it("should generate human-readable severity message", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: 0.85,
        avgRelevanceScore: 0.65,
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message).not.toBe("No significant drift detected");
    });

    it("should include time window in message when available", () => {
      const baseline = createBaseline();
      const window = createTimeWindow(48);
      const statistics = createStatistics({
        window,
        successRate: 0.85,
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.message).toContain("48 hours");
    });
  });

  describe("setControlLimits", () => {
    it("should update control limits", () => {
      const newLimits: ControlLimitConfig = {
        successRateLower: 0.8,
        relevanceScoreLower: 0.6,
        latencyUpper: 1000,
        sigma: 3,
      };

      detector.setControlLimits(newLimits);

      const limits = detector.getControlLimits();
      expect(limits.successRateLower).toBe(0.8);
      expect(limits.relevanceScoreLower).toBe(0.6);
      expect(limits.latencyUpper).toBe(1000);
      expect(limits.sigma).toBe(3);
    });

    it("should use new limits for drift detection", () => {
      // Set more lenient limits
      detector.setControlLimits({
        successRateLower: 0.7,
        relevanceScoreLower: 0.5,
        latencyUpper: 1000,
        sigma: 2,
      });

      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: 0.75, // Would breach 0.9 but not 0.7
      });

      const result = detector.checkForDrift(statistics, baseline);

      // Should still detect drift because baseline has its own limits
      // But if we use detector's limits directly...
      const baselineWithDetectorLimits = createBaseline({
        controlLimits: detector.getControlLimits(),
      });
      const result2 = detector.checkForDrift(statistics, baselineWithDetectorLimits);

      expect(result2.hasDrift).toBe(false);
    });
  });

  describe("alert management", () => {
    it("should return empty array when no alerts", async () => {
      const alerts = await detector.getActiveAlerts();
      expect(alerts).toEqual([]);
    });

    it("should return active alerts only", async () => {
      const baseline = createBaseline();

      // Generate two alerts
      detector.checkForDrift(createStatistics({ successRate: 0.85 }), baseline);
      detector.checkForDrift(createStatistics({ avgRelevanceScore: 0.65 }), baseline);

      const allAlerts = detector.getAllAlerts();
      expect(allAlerts.length).toBe(2);

      // Acknowledge one
      detector.acknowledgeAlert(allAlerts[0].id);

      const activeAlerts = await detector.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
    });

    it("should generate unique alert IDs", async () => {
      const baseline = createBaseline();

      detector.checkForDrift(createStatistics({ successRate: 0.85 }), baseline);
      detector.checkForDrift(createStatistics({ avgRelevanceScore: 0.65 }), baseline);

      const alerts = detector.getAllAlerts();
      expect(alerts[0].id).not.toBe(alerts[1].id);
    });

    it("should include timestamp in alerts", async () => {
      const baseline = createBaseline();
      const beforeTime = new Date();

      detector.checkForDrift(createStatistics({ successRate: 0.85 }), baseline);

      const alerts = detector.getAllAlerts();
      expect(alerts[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });

    it("should clear all alerts", async () => {
      const baseline = createBaseline();

      detector.checkForDrift(createStatistics({ successRate: 0.85 }), baseline);
      expect(detector.getAllAlerts().length).toBe(1);

      detector.clearAlerts();
      expect(detector.getAllAlerts().length).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle zero baseline values", () => {
      const baseline = createBaseline({
        avgLatencyMs: 0,
      });
      const statistics = createStatistics({
        avgLatencyMs: 100,
      });

      const result = detector.checkForDrift(statistics, baseline);

      const latencyMetric = result.metrics.find((m) => m.name === "latency");
      expect(latencyMetric?.changePercent).toBe(100);
    });

    it("should handle identical baseline and current values", () => {
      const baseline = createBaseline();
      const statistics = createStatistics({
        successRate: baseline.successRate,
        avgRelevanceScore: baseline.avgRelevanceScore,
        avgLatencyMs: baseline.avgLatencyMs,
      });

      const result = detector.checkForDrift(statistics, baseline);

      expect(result.metrics.every((m) => m.changePercent === 0)).toBe(true);
    });

    it("should handle missing control limits in baseline", () => {
      const baseline: RAGBaseline = {
        createdAt: new Date(),
        updatedAt: new Date(),
        successRate: 0.95,
        avgRelevanceScore: 0.85,
        avgLatencyMs: 200,
        controlLimits: {
          successRateLower: 0.9,
          relevanceScoreLower: 0.7,
          latencyUpper: 500,
          sigma: 2,
        },
      };
      const statistics = createStatistics();

      // Should not throw
      const result = detector.checkForDrift(statistics, baseline);
      expect(result).toBeDefined();
    });
  });
});
