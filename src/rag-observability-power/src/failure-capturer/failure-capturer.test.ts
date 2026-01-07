/**
 * Failure Capturer Tests
 *
 * Unit tests for the FailureCapturer implementation.
 */

import { describe, expect, it, beforeEach } from "vitest";
import * as fc from "fast-check";

import type { CapturedFailure, RAGQueryEvent } from "../types/index.js";
import { ragQueryEventArb } from "../test-utils/index.js";

import { FailureCapturerImpl } from "./failure-capturer.js";
import { InMemoryFailureStore } from "./failure-store.js";

/**
 * Create a valid RAGQueryEvent for testing
 */
function createTestQueryEvent(overrides: Partial<RAGQueryEvent> = {}): RAGQueryEvent {
  return {
    id: "test-query-1",
    timestamp: new Date("2024-01-15T10:00:00Z"),
    query: "What is the capital of France?",
    retrievedDocuments: [
      {
        id: "doc-1",
        content: "Paris is the capital of France.",
        score: 0.95,
        metadata: { source: "geography" },
      },
      {
        id: "doc-2",
        content: "France is a country in Western Europe.",
        score: 0.85,
      },
    ],
    contextWindow: "Context: Paris is the capital of France.",
    generationOutput: "The capital of France is Paris.",
    qualityMetrics: {
      retrievalRelevanceScore: 0.9,
      generationConfidence: 0.95,
      latencyMs: 150,
      tokenCount: 50,
    },
    success: false,
    errorDetails: {
      type: "generation_error",
      message: "Model returned incomplete response",
    },
    ...overrides,
  };
}

describe("FailureCapturerImpl", () => {
  let capturer: FailureCapturerImpl;
  let store: InMemoryFailureStore;

  beforeEach(() => {
    store = new InMemoryFailureStore();
    capturer = new FailureCapturerImpl({
      failureStore: store,
    });
  });

  describe("captureFailure", () => {
    it("should capture a failure with all required fields", async () => {
      const event = createTestQueryEvent();

      const captured = await capturer.captureFailure(event);

      expect(captured.id).toBeDefined();
      expect(captured.id).toMatch(/^failure-/);
      expect(captured.timestamp).toBeInstanceOf(Date);
      expect(captured.queryEvent).toEqual(event);
      expect(captured.embeddingSnapshot).toBeDefined();
      expect(Array.isArray(captured.embeddingSnapshot)).toBe(true);
      expect(captured.retrievalState).toBeDefined();
      expect(captured.systemState).toBeDefined();
      expect(typeof captured.replayable).toBe("boolean");
    });

    it("should generate unique IDs for each capture", async () => {
      const event1 = createTestQueryEvent({ id: "query-1" });
      const event2 = createTestQueryEvent({ id: "query-2" });

      const captured1 = await capturer.captureFailure(event1);
      const captured2 = await capturer.captureFailure(event2);

      expect(captured1.id).not.toEqual(captured2.id);
    });

    it("should store the captured failure", async () => {
      const event = createTestQueryEvent();

      const captured = await capturer.captureFailure(event);
      const retrieved = await capturer.getFailure(captured.id);

      expect(retrieved).toEqual(captured);
    });

    it("should capture embeddings for query and documents", async () => {
      const event = createTestQueryEvent();

      const captured = await capturer.captureFailure(event);

      // Should have embeddings for query + each document
      expect(captured.embeddingSnapshot.length).toBe(
        1 + event.retrievedDocuments.length
      );
      // Each embedding should have correct dimension
      captured.embeddingSnapshot.forEach((embedding) => {
        expect(embedding.length).toBe(1536);
      });
    });

    it("should capture retrieval state", async () => {
      const customRetrievalState = {
        indexVersion: "v2.0",
        embeddingModel: "text-embedding-ada-002",
        searchParameters: { topK: 10, threshold: 0.7 },
      };

      const capturerWithState = new FailureCapturerImpl({
        failureStore: store,
        getRetrievalState: () => customRetrievalState,
      });

      const event = createTestQueryEvent();
      const captured = await capturerWithState.captureFailure(event);

      expect(captured.retrievalState).toEqual(customRetrievalState);
    });

    it("should capture system state", async () => {
      const customSystemState = {
        modelVersion: "gpt-4-turbo",
        configSnapshot: { temperature: 0.7, maxTokens: 1000 },
        environmentVariables: { NODE_ENV: "test" },
      };

      const capturerWithState = new FailureCapturerImpl({
        failureStore: store,
        getSystemState: () => customSystemState,
      });

      const event = createTestQueryEvent();
      const captured = await capturerWithState.captureFailure(event);

      expect(captured.systemState).toEqual(customSystemState);
    });

    it("should throw error for invalid event without id", async () => {
      const event = createTestQueryEvent();
      // @ts-expect-error - Testing invalid input
      delete event.id;

      await expect(capturer.captureFailure(event)).rejects.toThrow(
        "RAGQueryEvent must have a valid id"
      );
    });

    it("should throw error for invalid event without timestamp", async () => {
      const event = createTestQueryEvent();
      // @ts-expect-error - Testing invalid input
      event.timestamp = "not a date";

      await expect(capturer.captureFailure(event)).rejects.toThrow(
        "RAGQueryEvent must have a valid timestamp"
      );
    });

    it("should throw error for invalid event without query", async () => {
      const event = createTestQueryEvent();
      // @ts-expect-error - Testing invalid input
      delete event.query;

      await expect(capturer.captureFailure(event)).rejects.toThrow(
        "RAGQueryEvent must have a query string"
      );
    });

    it("should throw error for invalid event without retrievedDocuments", async () => {
      const event = createTestQueryEvent();
      // @ts-expect-error - Testing invalid input
      delete event.retrievedDocuments;

      await expect(capturer.captureFailure(event)).rejects.toThrow(
        "RAGQueryEvent must have retrievedDocuments array"
      );
    });

    it("should throw error for invalid event without qualityMetrics", async () => {
      const event = createTestQueryEvent();
      // @ts-expect-error - Testing invalid input
      delete event.qualityMetrics;

      await expect(capturer.captureFailure(event)).rejects.toThrow(
        "RAGQueryEvent must have qualityMetrics"
      );
    });
  });

  describe("Property-Based Tests", () => {
    describe("Property 7: Failure Capture Completeness", () => {
      it("should capture all required fields for any RAG failure", () => {
        /**
         * Feature: rag-observability-power, Property 7: Failure Capture Completeness
         * Validates: Requirements 3.1, 3.2
         * 
         * For any RAG failure that is captured, the stored snapshot SHALL contain 
         * all required fields (query, embeddings, retrieved documents, context window, 
         * generation output) and SHALL have a unique identifier distinct from all 
         * other captured failures.
         */
        fc.assert(
          fc.asyncProperty(
            ragQueryEventArb.filter(event => !event.success), // Only failed events
            async (failureEvent: RAGQueryEvent) => {
              const store = new InMemoryFailureStore();
              const capturer = new FailureCapturerImpl({ failureStore: store });

              const captured = await capturer.captureFailure(failureEvent);

              // Verify unique identifier
              expect(captured.id).toBeDefined();
              expect(typeof captured.id).toBe("string");
              expect(captured.id.length).toBeGreaterThan(0);
              expect(captured.id).toMatch(/^failure-/);

              // Verify timestamp
              expect(captured.timestamp).toBeInstanceOf(Date);
              expect(captured.timestamp.getTime()).toBeGreaterThan(0);

              // Verify complete query event is captured
              expect(captured.queryEvent).toBeDefined();
              expect(captured.queryEvent.id).toBe(failureEvent.id);
              expect(captured.queryEvent.timestamp).toEqual(failureEvent.timestamp);
              expect(captured.queryEvent.query).toBe(failureEvent.query);
              expect(captured.queryEvent.retrievedDocuments).toEqual(failureEvent.retrievedDocuments);
              expect(captured.queryEvent.contextWindow).toBe(failureEvent.contextWindow);
              expect(captured.queryEvent.generationOutput).toBe(failureEvent.generationOutput);
              expect(captured.queryEvent.qualityMetrics).toEqual(failureEvent.qualityMetrics);
              expect(captured.queryEvent.success).toBe(failureEvent.success);

              // Verify embedding snapshot is captured
              expect(captured.embeddingSnapshot).toBeDefined();
              expect(Array.isArray(captured.embeddingSnapshot)).toBe(true);
              // Should have embeddings for query + each retrieved document
              const expectedEmbeddingCount = 1 + failureEvent.retrievedDocuments.length;
              expect(captured.embeddingSnapshot.length).toBe(expectedEmbeddingCount);
              
              // Each embedding should be a valid vector
              for (const embedding of captured.embeddingSnapshot) {
                expect(Array.isArray(embedding)).toBe(true);
                expect(embedding.length).toBe(1536); // Standard embedding dimension
                for (const value of embedding) {
                  expect(typeof value).toBe("number");
                  expect(isFinite(value)).toBe(true);
                }
              }

              // Verify retrieval state is captured
              expect(captured.retrievalState).toBeDefined();
              expect(typeof captured.retrievalState).toBe("object");

              // Verify system state is captured
              expect(captured.systemState).toBeDefined();
              expect(typeof captured.systemState).toBe("object");

              // Verify replayable flag
              expect(typeof captured.replayable).toBe("boolean");

              // Verify the captured failure can be retrieved
              const retrieved = await capturer.getFailure(captured.id);
              expect(retrieved).toEqual(captured);

              // Test uniqueness by capturing another failure
              const anotherFailure = { ...failureEvent, id: `${failureEvent.id}-different` };
              const captured2 = await capturer.captureFailure(anotherFailure);
              
              // IDs should be unique
              expect(captured2.id).not.toBe(captured.id);
              expect(captured2.id).toBeDefined();
              expect(captured2.id).toMatch(/^failure-/);
            }
          ),
          { numRuns: 100 }
        );
      });

      it("should accurately replay captured failures and detect reproduction", () => {
        /**
         * Feature: rag-observability-power, Property 8: Failure Replay Round-Trip
         * Validates: Requirements 3.3, 3.5
         * 
         * For any captured failure, replaying it SHALL reconstruct the exact query 
         * event state that was originally captured, and the replay result SHALL 
         * accurately report whether the failure reproduced.
         */
        fc.assert(
          fc.asyncProperty(
            ragQueryEventArb.filter(event => !event.success), // Only failed events
            fc.boolean(), // Whether replay should reproduce the same output
            async (failureEvent: RAGQueryEvent, shouldReproduce: boolean) => {
              const store = new InMemoryFailureStore();
              
              // Create replay function that either reproduces or produces different output
              const replayFunction = async (capturedFailure: CapturedFailure) => {
                // Verify the captured failure contains the original event
                expect(capturedFailure.queryEvent).toEqual(failureEvent);
                
                if (shouldReproduce) {
                  // Return the same output to simulate reproduction
                  return failureEvent.generationOutput;
                } else {
                  // Return different output to simulate non-reproduction
                  return `DIFFERENT: ${failureEvent.generationOutput}`;
                }
              };

              const capturer = new FailureCapturerImpl({ 
                failureStore: store,
                replayFunction 
              });

              // Capture the failure
              const captured = await capturer.captureFailure(failureEvent);

              // Verify the captured failure contains all original data
              expect(captured.queryEvent).toEqual(failureEvent);
              expect(captured.replayable).toBe(true);

              // Replay the failure
              const replayResult = await capturer.replayFailure(captured.id);

              // Verify replay result structure
              expect(replayResult.failureId).toBe(captured.id);
              expect(replayResult.originalOutput).toBe(failureEvent.generationOutput);
              expect(typeof replayResult.reproduced).toBe("boolean");
              expect(Array.isArray(replayResult.differences)).toBe(true);

              if (shouldReproduce) {
                // Should detect reproduction when outputs match
                expect(replayResult.reproduced).toBe(true);
                expect(replayResult.replayOutput).toBe(failureEvent.generationOutput);
                expect(replayResult.differences).toHaveLength(0);
              } else {
                // Should detect non-reproduction when outputs differ
                expect(replayResult.reproduced).toBe(false);
                expect(replayResult.replayOutput).toBe(`DIFFERENT: ${failureEvent.generationOutput}`);
                expect(replayResult.differences.length).toBeGreaterThan(0);
                expect(replayResult.differences[0]).toContain("Output differs");
              }

              // Test round-trip: the replay should use the exact captured state
              // This is verified by the replayFunction checking capturedFailure.queryEvent
            }
          ),
          { numRuns: 100 }
        );
      });

      it("should handle replay function errors correctly", () => {
        /**
         * Additional test for error handling during replay
         */
        fc.assert(
          fc.asyncProperty(
            ragQueryEventArb.filter(event => !event.success),
            fc.string({ minLength: 1, maxLength: 100 }), // Error message
            async (failureEvent: RAGQueryEvent, errorMessage: string) => {
              const store = new InMemoryFailureStore();
              
              // Create replay function that throws an error
              const replayFunction = async () => {
                throw new Error(errorMessage);
              };

              const capturer = new FailureCapturerImpl({ 
                failureStore: store,
                replayFunction 
              });

              const captured = await capturer.captureFailure(failureEvent);
              const replayResult = await capturer.replayFailure(captured.id);

              // Error during replay should be treated as reproduction
              expect(replayResult.reproduced).toBe(true);
              expect(replayResult.replayOutput).toContain("Error during replay");
              expect(replayResult.differences).toContain(`Replay threw error: ${errorMessage}`);
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });

  describe("getFailure", () => {
    it("should retrieve a captured failure by ID", async () => {
      const event = createTestQueryEvent();
      const captured = await capturer.captureFailure(event);

      const retrieved = await capturer.getFailure(captured.id);

      expect(retrieved).toEqual(captured);
    });

    it("should throw error for non-existent failure ID", async () => {
      await expect(capturer.getFailure("non-existent-id")).rejects.toThrow(
        "Failure with id 'non-existent-id' not found"
      );
    });
  });

  describe("listFailures", () => {
    it("should list all failures when no filters provided", async () => {
      const event1 = createTestQueryEvent({ id: "query-1" });
      const event2 = createTestQueryEvent({ id: "query-2" });

      await capturer.captureFailure(event1);
      await capturer.captureFailure(event2);

      const failures = await capturer.listFailures({});

      expect(failures.length).toBe(2);
    });

    it("should filter failures by date range", async () => {
      const event1 = createTestQueryEvent({ id: "query-1" });
      const event2 = createTestQueryEvent({ id: "query-2" });

      const captured1 = await capturer.captureFailure(event1);
      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await capturer.captureFailure(event2);

      const failures = await capturer.listFailures({
        startDate: captured1.timestamp,
        endDate: new Date(),
      });

      expect(failures.length).toBe(2);
    });

    it("should filter failures by error type", async () => {
      const event1 = createTestQueryEvent({
        id: "query-1",
        errorDetails: { type: "generation_error", message: "Error 1" },
      });
      const event2 = createTestQueryEvent({
        id: "query-2",
        errorDetails: { type: "retrieval_failure", message: "Error 2" },
      });

      await capturer.captureFailure(event1);
      await capturer.captureFailure(event2);

      const failures = await capturer.listFailures({
        errorType: "generation_error",
      });

      expect(failures.length).toBe(1);
      expect(failures[0].queryEvent.errorDetails?.type).toBe("generation_error");
    });

    it("should filter failures by replayable status", async () => {
      const event = createTestQueryEvent();

      // Capturer without replay function - not replayable
      await capturer.captureFailure(event);

      const failures = await capturer.listFailures({ replayable: false });

      expect(failures.length).toBe(1);
      expect(failures[0].replayable).toBe(false);
    });
  });

  describe("replayFailure", () => {
    it("should return not reproduced when no replay function configured", async () => {
      const event = createTestQueryEvent();
      const captured = await capturer.captureFailure(event);

      const result = await capturer.replayFailure(captured.id);

      expect(result.failureId).toBe(captured.id);
      expect(result.reproduced).toBe(false);
      expect(result.differences).toContain(
        "Failure is not replayable - no replay function configured"
      );
    });

    it("should replay failure and detect reproduction when outputs match", async () => {
      const event = createTestQueryEvent();
      const originalOutput = event.generationOutput;

      const capturerWithReplay = new FailureCapturerImpl({
        failureStore: store,
        replayFunction: async () => originalOutput,
      });

      const captured = await capturerWithReplay.captureFailure(event);
      const result = await capturerWithReplay.replayFailure(captured.id);

      expect(result.failureId).toBe(captured.id);
      expect(result.reproduced).toBe(true);
      expect(result.originalOutput).toBe(originalOutput);
      expect(result.replayOutput).toBe(originalOutput);
      expect(result.differences).toHaveLength(0);
    });

    it("should replay failure and detect non-reproduction when outputs differ", async () => {
      const event = createTestQueryEvent();

      const capturerWithReplay = new FailureCapturerImpl({
        failureStore: store,
        replayFunction: async () => "Different output",
      });

      const captured = await capturerWithReplay.captureFailure(event);
      const result = await capturerWithReplay.replayFailure(captured.id);

      expect(result.failureId).toBe(captured.id);
      expect(result.reproduced).toBe(false);
      expect(result.originalOutput).toBe(event.generationOutput);
      expect(result.replayOutput).toBe("Different output");
      expect(result.differences.length).toBeGreaterThan(0);
    });

    it("should handle replay function errors as reproduction", async () => {
      const event = createTestQueryEvent();

      const capturerWithReplay = new FailureCapturerImpl({
        failureStore: store,
        replayFunction: async () => {
          throw new Error("Replay failed with same error");
        },
      });

      const captured = await capturerWithReplay.captureFailure(event);
      const result = await capturerWithReplay.replayFailure(captured.id);

      expect(result.failureId).toBe(captured.id);
      expect(result.reproduced).toBe(true);
      expect(result.replayOutput).toContain("Error during replay");
      expect(result.differences).toContain(
        "Replay threw error: Replay failed with same error"
      );
    });

    it("should throw error for non-existent failure ID", async () => {
      await expect(capturer.replayFailure("non-existent-id")).rejects.toThrow(
        "Failure with id 'non-existent-id' not found"
      );
    });
  });
});

describe("InMemoryFailureStore", () => {
  let store: InMemoryFailureStore;

  beforeEach(() => {
    store = new InMemoryFailureStore();
  });

  it("should store and retrieve failures", async () => {
    const failure: CapturedFailure = {
      id: "test-failure-1",
      timestamp: new Date(),
      queryEvent: createTestQueryEvent(),
      embeddingSnapshot: [[0.1, 0.2, 0.3]],
      retrievalState: {
        indexVersion: "v1",
        embeddingModel: "test",
        searchParameters: {},
      },
      systemState: {
        modelVersion: "test",
        configSnapshot: {},
        environmentVariables: {},
      },
      replayable: false,
    };

    await store.store(failure);
    const retrieved = await store.get(failure.id);

    expect(retrieved).toEqual(failure);
  });

  it("should return null for non-existent failure", async () => {
    const result = await store.get("non-existent");
    expect(result).toBeNull();
  });

  it("should check if failure exists", async () => {
    const failure: CapturedFailure = {
      id: "test-failure-1",
      timestamp: new Date(),
      queryEvent: createTestQueryEvent(),
      embeddingSnapshot: [],
      retrievalState: {
        indexVersion: "v1",
        embeddingModel: "test",
        searchParameters: {},
      },
      systemState: {
        modelVersion: "test",
        configSnapshot: {},
        environmentVariables: {},
      },
      replayable: false,
    };

    expect(await store.exists(failure.id)).toBe(false);
    await store.store(failure);
    expect(await store.exists(failure.id)).toBe(true);
  });

  it("should clear all failures", async () => {
    const failure: CapturedFailure = {
      id: "test-failure-1",
      timestamp: new Date(),
      queryEvent: createTestQueryEvent(),
      embeddingSnapshot: [],
      retrievalState: {
        indexVersion: "v1",
        embeddingModel: "test",
        searchParameters: {},
      },
      systemState: {
        modelVersion: "test",
        configSnapshot: {},
        environmentVariables: {},
      },
      replayable: false,
    };

    await store.store(failure);
    expect((await store.getAll()).length).toBe(1);

    store.clear();
    expect((await store.getAll()).length).toBe(0);
  });
});

