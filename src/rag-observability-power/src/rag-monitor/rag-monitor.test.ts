/**
 * RAG Monitor Tests
 *
 * Tests for the RAGMonitorImpl class including query logging,
 * statistics calculation, and baseline management.
 */

import { describe, expect, it, beforeEach } from "vitest";
import * as fc from "fast-check";

import { RAGMonitorImpl } from "./rag-monitor.js";
import { InMemoryQueryStore } from "./query-store.js";
import { ragQueryEventArb } from "../test-utils/index.js";

import type { RAGQueryEvent, TimeWindow } from "../types/index.js";

// Helper to create a valid RAGQueryEvent
function createValidEvent(overrides: Partial<RAGQueryEvent> = {}): RAGQueryEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date(),
    query: "test query",
    retrievedDocuments: [
      { id: "doc-1", content: "test content", score: 0.9 },
    ],
    contextWindow: "test context",
    generationOutput: "test output",
    qualityMetrics: {
      retrievalRelevanceScore: 0.85,
      generationConfidence: 0.9,
      latencyMs: 150,
      tokenCount: 100,
    },
    success: true,
    ...overrides,
  };
}

describe("RAGMonitorImpl", () => {
  let monitor: RAGMonitorImpl;
  let queryStore: InMemoryQueryStore;

  beforeEach(() => {
    queryStore = new InMemoryQueryStore();
    monitor = new RAGMonitorImpl({ queryStore });
  });

  describe("logQuery", () => {
    it("should store a valid query event", async () => {
      const event = createValidEvent();
      await monitor.logQuery(event);

      const stored = await queryStore.getById(event.id);
      expect(stored).not.toBeNull();
      expect(stored?.id).toBe(event.id);
      expect(stored?.query).toBe(event.query);
    });

    it("should reject event without id", async () => {
      const event = createValidEvent({ id: "" });
      await expect(monitor.logQuery(event)).rejects.toThrow("valid id");
    });

    it("should reject event without valid timestamp", async () => {
      const event = createValidEvent({ timestamp: new Date("invalid") });
      await expect(monitor.logQuery(event)).rejects.toThrow("valid timestamp");
    });

    it("should reject event without qualityMetrics", async () => {
      const event = createValidEvent();
      // @ts-expect-error - Testing invalid input
      delete event.qualityMetrics;
      await expect(monitor.logQuery(event)).rejects.toThrow("qualityMetrics");
    });

    it("should reject event with invalid relevance score", async () => {
      const event = createValidEvent({
        qualityMetrics: {
          retrievalRelevanceScore: 1.5, // Invalid: > 1
          generationConfidence: 0.9,
          latencyMs: 150,
          tokenCount: 100,
        },
      });
      await expect(monitor.logQuery(event)).rejects.toThrow("retrievalRelevanceScore");
    });

    it("should store multiple events", async () => {
      const event1 = createValidEvent({ id: "event-1" });
      const event2 = createValidEvent({ id: "event-2" });

      await monitor.logQuery(event1);
      await monitor.logQuery(event2);

      expect(await queryStore.count()).toBe(2);
    });
  });

  describe("Property-Based Tests", () => {
    describe("Property 1: Query Logging Completeness", () => {
      it("should store all required fields for any valid RAG query event", () => {
        /**
         * Feature: rag-observability-power, Property 1: Query Logging Completeness
         * Validates: Requirements 1.1
         * 
         * For any RAG query event that is logged, the stored record SHALL contain 
         * all required fields: query, retrieved documents, generation output, and 
         * quality metrics with no null or missing values.
         */
        fc.assert(
          fc.asyncProperty(ragQueryEventArb, async (event: RAGQueryEvent) => {
            const queryStore = new InMemoryQueryStore();
            const monitor = new RAGMonitorImpl({ queryStore });

            // Log the event
            await monitor.logQuery(event);

            // Retrieve the stored event
            const storedEvent = await queryStore.getById(event.id);

            // Verify the event was stored
            expect(storedEvent).not.toBeNull();
            expect(storedEvent).toBeDefined();

            if (storedEvent) {
              // Verify all required fields are present and not null/undefined
              expect(storedEvent.id).toBe(event.id);
              expect(storedEvent.id).toBeTruthy();
              
              expect(storedEvent.timestamp).toEqual(event.timestamp);
              expect(storedEvent.timestamp).toBeInstanceOf(Date);
              
              expect(storedEvent.query).toBe(event.query);
              expect(typeof storedEvent.query).toBe("string");
              
              expect(storedEvent.retrievedDocuments).toEqual(event.retrievedDocuments);
              expect(Array.isArray(storedEvent.retrievedDocuments)).toBe(true);
              
              expect(storedEvent.contextWindow).toBe(event.contextWindow);
              expect(typeof storedEvent.contextWindow).toBe("string");
              
              expect(storedEvent.generationOutput).toBe(event.generationOutput);
              expect(typeof storedEvent.generationOutput).toBe("string");
              
              expect(storedEvent.qualityMetrics).toEqual(event.qualityMetrics);
              expect(storedEvent.qualityMetrics).toBeDefined();
              expect(typeof storedEvent.qualityMetrics.retrievalRelevanceScore).toBe("number");
              expect(typeof storedEvent.qualityMetrics.generationConfidence).toBe("number");
              expect(typeof storedEvent.qualityMetrics.latencyMs).toBe("number");
              expect(typeof storedEvent.qualityMetrics.tokenCount).toBe("number");
              
              expect(storedEvent.success).toBe(event.success);
              expect(typeof storedEvent.success).toBe("boolean");

              // If errorDetails exist, they should be preserved
              if (event.errorDetails) {
                expect(storedEvent.errorDetails).toEqual(event.errorDetails);
              }
            }
          }),
          { numRuns: 100 }
        );
      });

      it("should calculate correct statistics for any set of query events", () => {
        /**
         * Feature: rag-observability-power, Property 2: Statistics Calculation Correctness
         * Validates: Requirements 1.2
         * 
         * For any set of logged RAG queries within a time window, the calculated rolling 
         * statistics (success rate, average relevance score, average latency) SHALL equal 
         * the expected values computed directly from the raw query data.
         */
        fc.assert(
          fc.asyncProperty(
            fc.array(ragQueryEventArb, { minLength: 1, maxLength: 50 }),
            async (events: RAGQueryEvent[]) => {
              const queryStore = new InMemoryQueryStore();
              const monitor = new RAGMonitorImpl({ queryStore });

              // Log all events
              for (const event of events) {
                await monitor.logQuery(event);
              }

              // Create a time window that encompasses all events
              const timestamps = events.map(e => e.timestamp.getTime());
              const minTime = Math.min(...timestamps);
              const maxTime = Math.max(...timestamps);
              
              const window: TimeWindow = {
                start: new Date(minTime - 1000), // 1 second before earliest
                end: new Date(maxTime + 1000),   // 1 second after latest
                granularity: "minute"
              };

              // Get statistics from monitor
              const stats = await monitor.getStatistics(window);

              // Calculate expected values directly from events
              const expectedQueryCount = events.length;
              const successfulEvents = events.filter(e => e.success);
              const expectedSuccessRate = successfulEvents.length / events.length;
              
              const relevanceScores = events.map(e => e.qualityMetrics.retrievalRelevanceScore);
              const expectedAvgRelevanceScore = relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length;
              
              const latencies = events.map(e => e.qualityMetrics.latencyMs);
              const expectedAvgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
              
              // Calculate expected p95 latency
              const sortedLatencies = [...latencies].sort((a, b) => a - b);
              const p95Index = Math.ceil(0.95 * sortedLatencies.length) - 1;
              const expectedP95LatencyMs = sortedLatencies[Math.max(0, p95Index)];

              // Calculate expected error breakdown
              const expectedErrorBreakdown = {
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
                  expectedErrorBreakdown[event.errorDetails.type]++;
                }
              }

              // Verify all statistics match expected values
              expect(stats.queryCount).toBe(expectedQueryCount);
              expect(stats.successRate).toBeCloseTo(expectedSuccessRate, 10);
              expect(stats.avgRelevanceScore).toBeCloseTo(expectedAvgRelevanceScore, 10);
              expect(stats.avgLatencyMs).toBeCloseTo(expectedAvgLatencyMs, 10);
              expect(stats.p95LatencyMs).toBe(expectedP95LatencyMs);
              expect(stats.errorBreakdown).toEqual(expectedErrorBreakdown);
            }
          ),
          { numRuns: 100 }
        );
      });

      it("should persist and retrieve baseline correctly for any baseline data", () => {
        /**
         * Feature: rag-observability-power, Property 4: Baseline Persistence
         * Validates: Requirements 1.4
         * 
         * For any active monitoring session, retrieving the baseline SHALL return 
         * valid metrics that were previously set, and updating the baseline SHALL 
         * persist the new values for subsequent retrievals.
         */
        fc.assert(
          fc.asyncProperty(
            fc.array(ragQueryEventArb, { minLength: 1, maxLength: 20 }),
            async (events: RAGQueryEvent[]) => {
              const queryStore = new InMemoryQueryStore();
              const monitor = new RAGMonitorImpl({ queryStore });

              // Log all events to create data for baseline calculation
              for (const event of events) {
                await monitor.logQuery(event);
              }

              // Update baseline from the logged events
              await monitor.updateBaseline();
              const firstBaseline = await monitor.getBaseline();

              // Verify baseline has valid structure and values
              expect(firstBaseline).toBeDefined();
              expect(firstBaseline.createdAt).toBeInstanceOf(Date);
              expect(firstBaseline.updatedAt).toBeInstanceOf(Date);
              expect(typeof firstBaseline.successRate).toBe("number");
              expect(firstBaseline.successRate).toBeGreaterThanOrEqual(0);
              expect(firstBaseline.successRate).toBeLessThanOrEqual(1);
              expect(typeof firstBaseline.avgRelevanceScore).toBe("number");
              expect(firstBaseline.avgRelevanceScore).toBeGreaterThanOrEqual(0);
              expect(firstBaseline.avgRelevanceScore).toBeLessThanOrEqual(1);
              expect(typeof firstBaseline.avgLatencyMs).toBe("number");
              expect(firstBaseline.avgLatencyMs).toBeGreaterThanOrEqual(0);
              expect(firstBaseline.controlLimits).toBeDefined();

              // Calculate expected baseline values from events
              const successfulEvents = events.filter(e => e.success);
              const expectedSuccessRate = successfulEvents.length / events.length;
              const relevanceScores = events.map(e => e.qualityMetrics.retrievalRelevanceScore);
              const expectedAvgRelevanceScore = relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length;
              const latencies = events.map(e => e.qualityMetrics.latencyMs);
              const expectedAvgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

              // Verify baseline values match expected calculations
              expect(firstBaseline.successRate).toBeCloseTo(expectedSuccessRate, 10);
              expect(firstBaseline.avgRelevanceScore).toBeCloseTo(expectedAvgRelevanceScore, 10);
              expect(firstBaseline.avgLatencyMs).toBeCloseTo(expectedAvgLatencyMs, 10);

              // Retrieve baseline again - should return the same values
              const retrievedBaseline = await monitor.getBaseline();
              expect(retrievedBaseline.successRate).toBe(firstBaseline.successRate);
              expect(retrievedBaseline.avgRelevanceScore).toBe(firstBaseline.avgRelevanceScore);
              expect(retrievedBaseline.avgLatencyMs).toBe(firstBaseline.avgLatencyMs);
              expect(retrievedBaseline.createdAt.getTime()).toBe(firstBaseline.createdAt.getTime());
              expect(retrievedBaseline.updatedAt.getTime()).toBe(firstBaseline.updatedAt.getTime());

              // Add more events and update baseline again
              const additionalEvents = events.slice(0, Math.min(5, events.length));
              for (const event of additionalEvents) {
                // Create new event with different ID to avoid duplicates
                const newEvent = { ...event, id: `${event.id}-additional-${Math.random()}` };
                await monitor.logQuery(newEvent);
              }

              await monitor.updateBaseline();
              const updatedBaseline = await monitor.getBaseline();

              // Verify baseline was updated (updatedAt should be newer)
              expect(updatedBaseline.updatedAt.getTime()).toBeGreaterThanOrEqual(firstBaseline.updatedAt.getTime());
              
              // Verify createdAt is preserved from first baseline
              expect(updatedBaseline.createdAt.getTime()).toBe(firstBaseline.createdAt.getTime());

              // Verify updated baseline persists on subsequent retrieval
              const finalBaseline = await monitor.getBaseline();
              expect(finalBaseline.successRate).toBe(updatedBaseline.successRate);
              expect(finalBaseline.avgRelevanceScore).toBe(updatedBaseline.avgRelevanceScore);
              expect(finalBaseline.avgLatencyMs).toBe(updatedBaseline.avgLatencyMs);
              expect(finalBaseline.updatedAt.getTime()).toBe(updatedBaseline.updatedAt.getTime());
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe("getStatistics", () => {
    it("should return empty statistics for empty window", async () => {
      const window: TimeWindow = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-02"),
        granularity: "hour",
      };

      const stats = await monitor.getStatistics(window);

      expect(stats.queryCount).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgRelevanceScore).toBe(0);
    });

    it("should calculate correct success rate", async () => {
      const baseTime = new Date("2024-01-01T12:00:00Z");

      // Add 3 successful and 1 failed event
      await monitor.logQuery(createValidEvent({
        id: "e1",
        timestamp: new Date(baseTime.getTime() + 1000),
        success: true,
      }));
      await monitor.logQuery(createValidEvent({
        id: "e2",
        timestamp: new Date(baseTime.getTime() + 2000),
        success: true,
      }));
      await monitor.logQuery(createValidEvent({
        id: "e3",
        timestamp: new Date(baseTime.getTime() + 3000),
        success: true,
      }));
      await monitor.logQuery(createValidEvent({
        id: "e4",
        timestamp: new Date(baseTime.getTime() + 4000),
        success: false,
        errorDetails: { type: "retrieval_failure", message: "test error" },
      }));

      const window: TimeWindow = {
        start: baseTime,
        end: new Date(baseTime.getTime() + 10000),
        granularity: "minute",
      };

      const stats = await monitor.getStatistics(window);

      expect(stats.queryCount).toBe(4);
      expect(stats.successRate).toBe(0.75); // 3/4
    });

    it("should calculate correct average relevance score", async () => {
      const baseTime = new Date("2024-01-01T12:00:00Z");

      await monitor.logQuery(createValidEvent({
        id: "e1",
        timestamp: new Date(baseTime.getTime() + 1000),
        qualityMetrics: {
          retrievalRelevanceScore: 0.8,
          generationConfidence: 0.9,
          latencyMs: 100,
          tokenCount: 50,
        },
      }));
      await monitor.logQuery(createValidEvent({
        id: "e2",
        timestamp: new Date(baseTime.getTime() + 2000),
        qualityMetrics: {
          retrievalRelevanceScore: 0.6,
          generationConfidence: 0.9,
          latencyMs: 100,
          tokenCount: 50,
        },
      }));

      const window: TimeWindow = {
        start: baseTime,
        end: new Date(baseTime.getTime() + 10000),
        granularity: "minute",
      };

      const stats = await monitor.getStatistics(window);

      expect(stats.avgRelevanceScore).toBe(0.7); // (0.8 + 0.6) / 2
    });

    it("should calculate correct latency metrics", async () => {
      const baseTime = new Date("2024-01-01T12:00:00Z");

      // Add events with different latencies
      const latencies = [100, 200, 300, 400, 500];
      for (let i = 0; i < latencies.length; i++) {
        await monitor.logQuery(createValidEvent({
          id: `e${i}`,
          timestamp: new Date(baseTime.getTime() + i * 1000),
          qualityMetrics: {
            retrievalRelevanceScore: 0.8,
            generationConfidence: 0.9,
            latencyMs: latencies[i],
            tokenCount: 50,
          },
        }));
      }

      const window: TimeWindow = {
        start: baseTime,
        end: new Date(baseTime.getTime() + 10000),
        granularity: "minute",
      };

      const stats = await monitor.getStatistics(window);

      expect(stats.avgLatencyMs).toBe(300); // (100+200+300+400+500) / 5
      expect(stats.p95LatencyMs).toBe(500); // 95th percentile
    });

    it("should calculate error breakdown", async () => {
      const baseTime = new Date("2024-01-01T12:00:00Z");

      await monitor.logQuery(createValidEvent({
        id: "e1",
        timestamp: new Date(baseTime.getTime() + 1000),
        success: false,
        errorDetails: { type: "retrieval_failure", message: "error 1" },
      }));
      await monitor.logQuery(createValidEvent({
        id: "e2",
        timestamp: new Date(baseTime.getTime() + 2000),
        success: false,
        errorDetails: { type: "retrieval_failure", message: "error 2" },
      }));
      await monitor.logQuery(createValidEvent({
        id: "e3",
        timestamp: new Date(baseTime.getTime() + 3000),
        success: false,
        errorDetails: { type: "generation_error", message: "error 3" },
      }));

      const window: TimeWindow = {
        start: baseTime,
        end: new Date(baseTime.getTime() + 10000),
        granularity: "minute",
      };

      const stats = await monitor.getStatistics(window);

      expect(stats.errorBreakdown.retrieval_failure).toBe(2);
      expect(stats.errorBreakdown.generation_error).toBe(1);
      expect(stats.errorBreakdown.unknown).toBe(0);
    });

    it("should only include events within the time window", async () => {
      const baseTime = new Date("2024-01-01T12:00:00Z");

      // Event before window
      await monitor.logQuery(createValidEvent({
        id: "before",
        timestamp: new Date(baseTime.getTime() - 10000),
      }));

      // Event in window
      await monitor.logQuery(createValidEvent({
        id: "in-window",
        timestamp: new Date(baseTime.getTime() + 1000),
      }));

      // Event after window
      await monitor.logQuery(createValidEvent({
        id: "after",
        timestamp: new Date(baseTime.getTime() + 20000),
      }));

      const window: TimeWindow = {
        start: baseTime,
        end: new Date(baseTime.getTime() + 10000),
        granularity: "minute",
      };

      const stats = await monitor.getStatistics(window);

      expect(stats.queryCount).toBe(1);
    });
  });

  describe("getBaseline and updateBaseline", () => {
    it("should return default baseline when none set", async () => {
      const baseline = await monitor.getBaseline();

      expect(baseline.successRate).toBe(1.0);
      expect(baseline.avgRelevanceScore).toBe(1.0);
      expect(baseline.avgLatencyMs).toBe(0);
      expect(baseline.controlLimits).toBeDefined();
    });

    it("should update baseline from stored events", async () => {
      // Add some events
      await monitor.logQuery(createValidEvent({
        id: "e1",
        success: true,
        qualityMetrics: {
          retrievalRelevanceScore: 0.8,
          generationConfidence: 0.9,
          latencyMs: 100,
          tokenCount: 50,
        },
      }));
      await monitor.logQuery(createValidEvent({
        id: "e2",
        success: true,
        qualityMetrics: {
          retrievalRelevanceScore: 0.6,
          generationConfidence: 0.9,
          latencyMs: 200,
          tokenCount: 50,
        },
      }));
      await monitor.logQuery(createValidEvent({
        id: "e3",
        success: false,
        errorDetails: { type: "retrieval_failure", message: "error" },
        qualityMetrics: {
          retrievalRelevanceScore: 0.4,
          generationConfidence: 0.5,
          latencyMs: 300,
          tokenCount: 50,
        },
      }));

      await monitor.updateBaseline();
      const baseline = await monitor.getBaseline();

      // 2 out of 3 successful
      expect(baseline.successRate).toBeCloseTo(2 / 3, 5);
      // Average of 0.8, 0.6, 0.4
      expect(baseline.avgRelevanceScore).toBeCloseTo(0.6, 5);
      // Average of 100, 200, 300
      expect(baseline.avgLatencyMs).toBeCloseTo(200, 5);
    });

    it("should preserve createdAt on subsequent updates", async () => {
      await monitor.logQuery(createValidEvent({ id: "e1" }));
      await monitor.updateBaseline();

      const firstBaseline = await monitor.getBaseline();
      const firstCreatedAt = firstBaseline.createdAt;

      // Wait a bit and update again
      await new Promise((resolve) => setTimeout(resolve, 10));

      await monitor.logQuery(createValidEvent({ id: "e2" }));
      await monitor.updateBaseline();

      const secondBaseline = await monitor.getBaseline();

      expect(secondBaseline.createdAt.getTime()).toBe(firstCreatedAt.getTime());
      expect(secondBaseline.updatedAt.getTime()).toBeGreaterThan(firstCreatedAt.getTime());
    });

    it("should set baseline directly", async () => {
      const customBaseline = {
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        successRate: 0.95,
        avgRelevanceScore: 0.85,
        avgLatencyMs: 250,
        controlLimits: {
          successRateLower: 0.9,
          relevanceScoreLower: 0.7,
          latencyUpper: 500,
          sigma: 2,
        },
      };

      monitor.setBaseline(customBaseline);
      const baseline = await monitor.getBaseline();

      expect(baseline.successRate).toBe(0.95);
      expect(baseline.avgRelevanceScore).toBe(0.85);
      expect(baseline.avgLatencyMs).toBe(250);
    });
  });
});

