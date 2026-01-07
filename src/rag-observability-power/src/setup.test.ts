/**
 * Setup verification tests
 *
 * Verifies that the project structure and dependencies are correctly configured.
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { POWER_NAME, VERSION } from "./index.js";
import { InMemoryVectorDB } from "./config/index.js";
import {
  errorTypeArb,
  qualityMetricsArb,
  ragQueryEventArb,
  severityArb,
} from "./test-utils/index.js";

describe("Project Setup", () => {
  it("should export version and power name", () => {
    expect(VERSION).toBe("1.0.0");
    expect(POWER_NAME).toBe("rag-observability-power");
  });

  it("should have fast-check configured correctly", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === "number";
      }),
      { numRuns: 10 }
    );
  });
});

describe("Type Generators", () => {
  it("should generate valid error types", () => {
    fc.assert(
      fc.property(errorTypeArb, (errorType) => {
        const validTypes = [
          "retrieval_failure",
          "relevance_degradation",
          "generation_error",
          "context_overflow",
          "latency_spike",
          "embedding_error",
          "unknown",
        ];
        return validTypes.includes(errorType);
      }),
      { numRuns: 100 }
    );
  });

  it("should generate valid severity levels", () => {
    fc.assert(
      fc.property(severityArb, (severity) => {
        const validSeverities = ["low", "medium", "high", "critical"];
        return validSeverities.includes(severity);
      }),
      { numRuns: 100 }
    );
  });

  it("should generate valid quality metrics", () => {
    fc.assert(
      fc.property(qualityMetricsArb, (metrics) => {
        return (
          metrics.retrievalRelevanceScore >= 0 &&
          metrics.retrievalRelevanceScore <= 1 &&
          metrics.generationConfidence >= 0 &&
          metrics.generationConfidence <= 1 &&
          metrics.latencyMs >= 1 &&
          metrics.tokenCount >= 1
        );
      }),
      { numRuns: 100 }
    );
  });

  it("should generate valid RAG query events", () => {
    fc.assert(
      fc.property(ragQueryEventArb, (event) => {
        return (
          typeof event.id === "string" &&
          event.timestamp instanceof Date &&
          typeof event.query === "string" &&
          Array.isArray(event.retrievedDocuments) &&
          typeof event.success === "boolean"
        );
      }),
      { numRuns: 100 }
    );
  });
});

describe("InMemoryVectorDB", () => {
  it("should store and retrieve vectors", async () => {
    const db = new InMemoryVectorDB();

    await db.upsert([
      {
        id: "test-1",
        values: [0.1, 0.2, 0.3],
        metadata: { type: "test" },
      },
    ]);

    const results = await db.fetch(["test-1"]);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("test-1");
  });

  it("should search for similar vectors", async () => {
    const db = new InMemoryVectorDB();

    await db.upsert([
      { id: "vec-1", values: [1, 0, 0], metadata: { label: "x" } },
      { id: "vec-2", values: [0, 1, 0], metadata: { label: "y" } },
      { id: "vec-3", values: [0, 0, 1], metadata: { label: "z" } },
    ]);

    const results = await db.search([1, 0, 0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("vec-1");
    expect(results[0].score).toBeCloseTo(1, 5);
  });

  it("should filter search results by metadata", async () => {
    const db = new InMemoryVectorDB();

    await db.upsert([
      { id: "vec-1", values: [1, 0, 0], metadata: { type: "error" } },
      { id: "vec-2", values: [0.9, 0.1, 0], metadata: { type: "warning" } },
      { id: "vec-3", values: [0.8, 0.2, 0], metadata: { type: "error" } },
    ]);

    const results = await db.search([1, 0, 0], 10, { type: "error" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.metadata.type === "error")).toBe(true);
  });

  it("should delete vectors", async () => {
    const db = new InMemoryVectorDB();

    await db.upsert([
      { id: "vec-1", values: [1, 0, 0], metadata: {} },
      { id: "vec-2", values: [0, 1, 0], metadata: {} },
    ]);

    expect(db.size()).toBe(2);

    await db.delete(["vec-1"]);
    expect(db.size()).toBe(1);

    const results = await db.fetch(["vec-1"]);
    expect(results).toHaveLength(0);
  });
});
