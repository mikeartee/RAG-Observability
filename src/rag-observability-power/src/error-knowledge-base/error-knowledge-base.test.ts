/**
 * Error Knowledge Base Tests
 *
 * Unit tests for the ErrorKnowledgeBase implementation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

import type { ErrorRecord, FixRecord, ErrorQuery } from "../types/index.js";
import { InMemoryVectorDB } from "../config/vector-db.js";
import {
  errorTypeArb,
  severityArb,
  errorContextArb,
  embeddingArb,
  codeChangeArb,
  dateArb,
} from "../test-utils/generators.js";

import {
  ErrorKnowledgeBaseImpl,
  createErrorRecord,
  createFixRecord,
} from "./error-knowledge-base.js";
import { InMemoryErrorStore } from "./error-store.js";

describe("ErrorKnowledgeBaseImpl", () => {
  let knowledgeBase: ErrorKnowledgeBaseImpl;
  let errorStore: InMemoryErrorStore;
  let vectorDB: InMemoryVectorDB;

  beforeEach(() => {
    errorStore = new InMemoryErrorStore();
    vectorDB = new InMemoryVectorDB();
    knowledgeBase = new ErrorKnowledgeBaseImpl({
      errorStore,
      vectorDB,
      embeddingDimension: 8, // Small dimension for testing
    });
  });

  /**
   * Helper to create a valid error record for testing
   */
  function createTestError(overrides: Partial<ErrorRecord> = {}): ErrorRecord {
    return createErrorRecord({
      timestamp: new Date(),
      type: "retrieval_failure",
      component: "retriever",
      severity: "medium",
      context: {
        query: "test query",
        retrievedDocs: ["doc1", "doc2"],
        breadcrumbs: [],
      },
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      ...overrides,
    });
  }

  /**
   * Helper to create a valid fix record for testing
   */
  function createTestFix(errorId: string, overrides: Partial<FixRecord> = {}): FixRecord {
    return createFixRecord({
      errorId,
      description: "Test fix description",
      codeChanges: [],
      appliedAt: new Date(),
      resolved: true,
      successRate: 0.8,
      ...overrides,
    });
  }

  describe("storeError", () => {
    it("should store an error and return its ID", async () => {
      const error = createTestError();
      const id = await knowledgeBase.storeError(error);

      expect(id).toBe(error.id);
      expect(await errorStore.exists(error.id)).toBe(true);
    });

    it("should store error in vector DB", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      expect(vectorDB.size()).toBe(1);
    });

    it("should generate embedding if not provided", async () => {
      const error = createTestError({ embedding: [] });
      await knowledgeBase.storeError(error);

      const stored = await knowledgeBase.getError(error.id);
      expect(stored.embedding.length).toBe(8);
    });

    it("should reject error without required fields", async () => {
      const invalidError = {
        id: "test-id",
        timestamp: new Date(),
        type: "retrieval_failure",
        // Missing component, severity, context
      } as ErrorRecord;

      await expect(knowledgeBase.storeError(invalidError)).rejects.toThrow();
    });

    it("should reject error with wrong embedding dimension", async () => {
      const error = createTestError({
        embedding: [0.1, 0.2, 0.3], // Wrong dimension
      });

      await expect(knowledgeBase.storeError(error)).rejects.toThrow("dimension mismatch");
    });

    it("should initialize fixes array if not provided", async () => {
      const error = createTestError();
      delete (error as Partial<ErrorRecord>).fixes;

      await knowledgeBase.storeError(error);
      const stored = await knowledgeBase.getError(error.id);

      expect(stored.fixes).toEqual([]);
    });
  });

  describe("getError", () => {
    it("should retrieve a stored error by ID", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const retrieved = await knowledgeBase.getError(error.id);

      expect(retrieved.id).toBe(error.id);
      expect(retrieved.type).toBe(error.type);
      expect(retrieved.component).toBe(error.component);
    });

    it("should throw for non-existent error", async () => {
      await expect(knowledgeBase.getError("non-existent")).rejects.toThrow("not found");
    });
  });

  describe("linkFix", () => {
    it("should link a fix to an error", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const fix = createTestFix(error.id);
      await knowledgeBase.linkFix(error.id, fix);

      const retrieved = await knowledgeBase.getError(error.id);
      expect(retrieved.fixes).toHaveLength(1);
      expect(retrieved.fixes[0].id).toBe(fix.id);
    });

    it("should update existing fix if ID matches", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const fix = createTestFix(error.id);
      await knowledgeBase.linkFix(error.id, fix);

      const updatedFix = { ...fix, description: "Updated description" };
      await knowledgeBase.linkFix(error.id, updatedFix);

      const retrieved = await knowledgeBase.getError(error.id);
      expect(retrieved.fixes).toHaveLength(1);
      expect(retrieved.fixes[0].description).toBe("Updated description");
    });

    it("should throw if error does not exist", async () => {
      const fix = createTestFix("non-existent");
      await expect(knowledgeBase.linkFix("non-existent", fix)).rejects.toThrow("not found");
    });

    it("should throw if fix errorId does not match", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const fix = createTestFix("different-error-id");
      await expect(knowledgeBase.linkFix(error.id, fix)).rejects.toThrow("does not match");
    });

    it("should validate fix record", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const invalidFix = {
        id: "fix-id",
        errorId: error.id,
        // Missing required fields
      } as FixRecord;

      await expect(knowledgeBase.linkFix(error.id, invalidFix)).rejects.toThrow();
    });
  });

  describe("searchSimilar", () => {
    it("should return similar errors ordered by similarity", async () => {
      // Store multiple errors
      const error1 = createTestError({
        embedding: [1, 0, 0, 0, 0, 0, 0, 0],
        context: { query: "query 1", retrievedDocs: [], breadcrumbs: [] },
      });
      const error2 = createTestError({
        embedding: [0.9, 0.1, 0, 0, 0, 0, 0, 0],
        context: { query: "query 2", retrievedDocs: [], breadcrumbs: [] },
      });
      const error3 = createTestError({
        embedding: [0, 1, 0, 0, 0, 0, 0, 0],
        context: { query: "query 3", retrievedDocs: [], breadcrumbs: [] },
      });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);
      await knowledgeBase.storeError(error3);

      // Search with embedding similar to error1
      const query: ErrorQuery = {
        queryEmbedding: [1, 0, 0, 0, 0, 0, 0, 0],
        limit: 3,
      };

      const results = await knowledgeBase.searchSimilar(query);

      expect(results.length).toBe(3);
      expect(results[0].error.id).toBe(error1.id);
      expect(results[0].similarity).toBeCloseTo(1, 5);
    });

    it("should filter by type", async () => {
      const error1 = createTestError({ type: "retrieval_failure" });
      const error2 = createTestError({ type: "generation_error" });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const query: ErrorQuery = {
        queryEmbedding: error1.embedding,
        type: "retrieval_failure",
        limit: 10,
      };

      const results = await knowledgeBase.searchSimilar(query);

      expect(results.every((r) => r.error.type === "retrieval_failure")).toBe(true);
    });

    it("should return empty results if no query provided", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const results = await knowledgeBase.searchSimilar({});

      expect(results).toEqual([]);
    });

    it("should include fixes in results", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const fix = createTestFix(error.id);
      await knowledgeBase.linkFix(error.id, fix);

      const results = await knowledgeBase.searchSimilar({
        queryEmbedding: error.embedding,
        limit: 10,
      });

      expect(results[0].fixes).toHaveLength(1);
      expect(results[0].fixes[0].id).toBe(fix.id);
    });
  });

  describe("queryErrors", () => {
    it("should filter by type", async () => {
      const error1 = createTestError({ type: "retrieval_failure" });
      const error2 = createTestError({ type: "generation_error" });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const results = await knowledgeBase.queryErrors({ type: "retrieval_failure" });

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("retrieval_failure");
    });

    it("should filter by component", async () => {
      const error1 = createTestError({ component: "retriever" });
      const error2 = createTestError({ component: "generator" });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const results = await knowledgeBase.queryErrors({ component: "retriever" });

      expect(results).toHaveLength(1);
      expect(results[0].component).toBe("retriever");
    });

    it("should filter by severity", async () => {
      const error1 = createTestError({ severity: "high" });
      const error2 = createTestError({ severity: "low" });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const results = await knowledgeBase.queryErrors({ severity: "high" });

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe("high");
    });

    it("should filter by date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const error1 = createTestError({ timestamp: now });
      const error2 = createTestError({ timestamp: twoDaysAgo });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const results = await knowledgeBase.queryErrors({
        startDate: yesterday,
        endDate: now,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(error1.id);
    });

    it("should combine multiple filters with AND logic", async () => {
      const error1 = createTestError({
        type: "retrieval_failure",
        component: "retriever",
        severity: "high",
      });
      const error2 = createTestError({
        type: "retrieval_failure",
        component: "retriever",
        severity: "low",
      });
      const error3 = createTestError({
        type: "generation_error",
        component: "retriever",
        severity: "high",
      });

      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);
      await knowledgeBase.storeError(error3);

      const results = await knowledgeBase.queryErrors({
        type: "retrieval_failure",
        component: "retriever",
        severity: "high",
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(error1.id);
    });

    it("should respect limit", async () => {
      for (let i = 0; i < 5; i++) {
        await knowledgeBase.storeError(createTestError());
      }

      const results = await knowledgeBase.queryErrors({ limit: 3 });

      expect(results).toHaveLength(3);
    });
  });

  describe("updateFixEffectiveness", () => {
    it("should update fix success rate when resolved", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const fix = createTestFix(error.id, { successRate: 0.5 });
      await knowledgeBase.linkFix(error.id, fix);

      await knowledgeBase.updateFixEffectiveness(fix.id, true);

      const retrieved = await knowledgeBase.getError(error.id);
      expect(retrieved.fixes[0].successRate).toBeGreaterThan(0.5);
      expect(retrieved.fixes[0].resolved).toBe(true);
    });

    it("should update fix success rate when not resolved", async () => {
      const error = createTestError();
      await knowledgeBase.storeError(error);

      const fix = createTestFix(error.id, { successRate: 0.5 });
      await knowledgeBase.linkFix(error.id, fix);

      await knowledgeBase.updateFixEffectiveness(fix.id, false);

      const retrieved = await knowledgeBase.getError(error.id);
      expect(retrieved.fixes[0].successRate).toBeLessThan(0.5);
      expect(retrieved.fixes[0].resolved).toBe(false);
    });

    it("should throw for non-existent fix", async () => {
      await expect(
        knowledgeBase.updateFixEffectiveness("non-existent", true)
      ).rejects.toThrow("not found");
    });
  });
});

describe("createErrorRecord", () => {
  it("should generate ID if not provided", () => {
    const error = createErrorRecord({
      timestamp: new Date(),
      type: "retrieval_failure",
      component: "retriever",
      severity: "medium",
      context: {
        query: "test",
        retrievedDocs: [],
        breadcrumbs: [],
      },
      embedding: [],
    });

    expect(error.id).toMatch(/^error-/);
  });

  it("should use provided ID", () => {
    const error = createErrorRecord({
      id: "custom-id",
      timestamp: new Date(),
      type: "retrieval_failure",
      component: "retriever",
      severity: "medium",
      context: {
        query: "test",
        retrievedDocs: [],
        breadcrumbs: [],
      },
      embedding: [],
    });

    expect(error.id).toBe("custom-id");
  });
});

describe("createFixRecord", () => {
  it("should generate ID if not provided", () => {
    const fix = createFixRecord({
      errorId: "error-123",
      description: "Test fix",
      codeChanges: [],
      appliedAt: new Date(),
      resolved: true,
      successRate: 0.8,
    });

    expect(fix.id).toMatch(/^fix-/);
  });

  it("should use provided ID", () => {
    const fix = createFixRecord({
      id: "custom-fix-id",
      errorId: "error-123",
      description: "Test fix",
      codeChanges: [],
      appliedAt: new Date(),
      resolved: true,
      successRate: 0.8,
    });

    expect(fix.id).toBe("custom-fix-id");
  });
});

describe("Property-Based Tests", () => {
  // Generator for valid error records
  const errorRecordArb = (embeddingDimension: number = 8): fc.Arbitrary<ErrorRecord> =>
    fc.record({
      id: fc.uuid().map(id => `error-${id}`),
      timestamp: dateArb,
      type: errorTypeArb,
      component: fc.string({ minLength: 1, maxLength: 50 }),
      severity: severityArb,
      context: errorContextArb,
      embedding: embeddingArb(embeddingDimension),
      fixes: fc.constant([]),
    });

  // Generator for valid fix records
  const fixRecordArb = (errorId: string): fc.Arbitrary<FixRecord> =>
    fc.record({
      id: fc.uuid().map(id => `fix-${id}`),
      errorId: fc.constant(errorId),
      description: fc.string({ minLength: 1, maxLength: 200 }),
      codeChanges: fc.array(codeChangeArb, { minLength: 0, maxLength: 5 }),
      appliedAt: dateArb,
      resolved: fc.boolean(),
      successRate: fc.double({ min: 0, max: 1, noNaN: true }),
    });

  describe("Property 9: Error Storage Integrity", () => {
    it("should store errors with all required metadata and valid embeddings", () => {
      /**
       * Feature: rag-observability-power, Property 9: Error Storage Integrity
       * Validates: Requirements 4.1, 4.3
       *
       * For any error that is stored in the Error Knowledge Base, the record SHALL
       * contain all required metadata fields (type, component, severity, context)
       * and SHALL have a valid embedding vector with correct dimensions.
       */
      const EMBEDDING_DIM = 8;

      fc.assert(
        fc.asyncProperty(errorRecordArb(EMBEDDING_DIM), async (error: ErrorRecord) => {
          const errorStore = new InMemoryErrorStore();
          const vectorDB = new InMemoryVectorDB();
          const knowledgeBase = new ErrorKnowledgeBaseImpl({
            errorStore,
            vectorDB,
            embeddingDimension: EMBEDDING_DIM,
          });

          // Store the error
          const storedId = await knowledgeBase.storeError(error);

          // Verify the ID matches
          expect(storedId).toBe(error.id);

          // Retrieve the stored error
          const storedError = await knowledgeBase.getError(error.id);

          // Verify all required metadata fields are present and correct
          expect(storedError.id).toBe(error.id);
          expect(storedError.id).toBeTruthy();
          expect(typeof storedError.id).toBe("string");

          expect(storedError.timestamp).toEqual(error.timestamp);
          expect(storedError.timestamp).toBeInstanceOf(Date);
          expect(storedError.timestamp.getTime()).not.toBeNaN();

          expect(storedError.type).toBe(error.type);
          expect([
            "retrieval_failure",
            "relevance_degradation",
            "generation_error",
            "context_overflow",
            "latency_spike",
            "embedding_error",
            "unknown",
          ]).toContain(storedError.type);

          expect(storedError.component).toBe(error.component);
          expect(typeof storedError.component).toBe("string");
          expect(storedError.component.length).toBeGreaterThan(0);

          expect(storedError.severity).toBe(error.severity);
          expect(["low", "medium", "high", "critical"]).toContain(storedError.severity);

          // Verify context is complete
          expect(storedError.context).toBeDefined();
          expect(storedError.context.query).toBe(error.context.query);
          expect(typeof storedError.context.query).toBe("string");
          expect(Array.isArray(storedError.context.retrievedDocs)).toBe(true);
          expect(Array.isArray(storedError.context.breadcrumbs)).toBe(true);

          // Verify embedding has correct dimensions
          expect(storedError.embedding).toBeDefined();
          expect(Array.isArray(storedError.embedding)).toBe(true);
          expect(storedError.embedding.length).toBe(EMBEDDING_DIM);

          // Verify all embedding values are valid numbers
          for (const value of storedError.embedding) {
            expect(typeof value).toBe("number");
            expect(isFinite(value)).toBe(true);
            expect(isNaN(value)).toBe(false);
          }

          // Verify embedding was stored in vector DB
          expect(vectorDB.size()).toBeGreaterThan(0);

          // Verify fixes array is initialized
          expect(Array.isArray(storedError.fixes)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 10: Error-Fix Linking Integrity", () => {
    it("should maintain bidirectional references between errors and fixes", () => {
      /**
       * Feature: rag-observability-power, Property 10: Error-Fix Linking Integrity
       * Validates: Requirements 4.2
       *
       * For any fix that is linked to an error, retrieving that error SHALL include
       * the linked fix in its fixes array, and the fix SHALL reference the correct error ID.
       */
      const EMBEDDING_DIM = 8;

      // Generator for fix data (without id and errorId)
      const fixDataListArb = fc.array(fc.record({
        description: fc.string({ minLength: 1, maxLength: 200 }),
        codeChanges: fc.array(codeChangeArb, { minLength: 0, maxLength: 3 }),
        appliedAt: dateArb,
        resolved: fc.boolean(),
        successRate: fc.double({ min: 0, max: 1, noNaN: true }),
      }), { minLength: 1, maxLength: 5 });

      fc.assert(
        fc.asyncProperty(
          errorRecordArb(EMBEDDING_DIM),
          fixDataListArb,
          async (baseError: ErrorRecord, fixDataList) => {
            const errorStore = new InMemoryErrorStore();
            const vectorDB = new InMemoryVectorDB();
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              errorStore,
              vectorDB,
              embeddingDimension: EMBEDDING_DIM,
            });

            // Create a fresh error without any pre-existing fixes
            const error = createErrorRecord({
              timestamp: baseError.timestamp,
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            // Store the error first
            await knowledgeBase.storeError(error);

            // Link multiple fixes to the error, each with a unique ID
            const linkedFixes: FixRecord[] = [];
            for (let i = 0; i < fixDataList.length; i++) {
              const fixData = fixDataList[i];
              const fix = createFixRecord({
                id: `fix-${error.id}-${i}`, // Ensure unique fix IDs
                errorId: error.id,
                ...fixData,
              });
              await knowledgeBase.linkFix(error.id, fix);
              linkedFixes.push(fix);
            }

            // Retrieve the error and verify all fixes are present
            const storedError = await knowledgeBase.getError(error.id);

            // Verify all fixes are in the error's fixes array
            expect(storedError.fixes.length).toBe(linkedFixes.length);

            for (const linkedFix of linkedFixes) {
              // Find the fix in the stored error
              const foundFix = storedError.fixes.find((f) => f.id === linkedFix.id);
              expect(foundFix).toBeDefined();

              if (foundFix) {
                // Verify the fix references the correct error ID
                expect(foundFix.errorId).toBe(error.id);

                // Verify fix data is preserved
                expect(foundFix.description).toBe(linkedFix.description);
                expect(foundFix.resolved).toBe(linkedFix.resolved);
                expect(foundFix.successRate).toBe(linkedFix.successRate);
                expect(foundFix.codeChanges).toEqual(linkedFix.codeChanges);
              }
            }

            // Verify all fixes in the array reference this error
            for (const fix of storedError.fixes) {
              expect(fix.errorId).toBe(error.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 11: Similarity Search Correctness", () => {
    it("should return errors ordered by descending similarity score", () => {
      /**
       * Feature: rag-observability-power, Property 11: Similarity Search Correctness
       * Validates: Requirements 4.5, 5.1
       *
       * For any error query, the returned similar errors SHALL be ordered by
       * descending similarity score, and errors with higher semantic similarity
       * to the query SHALL have higher similarity scores.
       */
      const EMBEDDING_DIM = 8;

      // Use non-zero embeddings to avoid edge cases with cosine similarity
      const nonZeroEmbeddingArb = fc.array(
        fc.double({ min: 0.1, max: 1, noNaN: true }),
        { minLength: EMBEDDING_DIM, maxLength: EMBEDDING_DIM }
      );

      const errorRecordWithNonZeroEmbeddingArb = fc.record({
        id: fc.uuid().map(id => `error-${id}`),
        timestamp: dateArb,
        type: errorTypeArb,
        component: fc.string({ minLength: 1, maxLength: 50 }),
        severity: severityArb,
        context: errorContextArb,
        embedding: nonZeroEmbeddingArb,
        fixes: fc.constant([]),
      });

      fc.assert(
        fc.asyncProperty(
          fc.array(errorRecordWithNonZeroEmbeddingArb, { minLength: 3, maxLength: 10 }),
          nonZeroEmbeddingArb,
          async (errors: ErrorRecord[], queryEmbedding: number[]) => {
            const errorStore = new InMemoryErrorStore();
            const vectorDB = new InMemoryVectorDB();
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              errorStore,
              vectorDB,
              embeddingDimension: EMBEDDING_DIM,
            });

            // Ensure unique error IDs
            const uniqueErrors = errors.map((e, i) => ({
              ...e,
              id: `error-${i}-${e.id}`,
            }));

            // Store all errors
            for (const error of uniqueErrors) {
              await knowledgeBase.storeError(error);
            }

            // Search for similar errors
            const results = await knowledgeBase.searchSimilar({
              queryEmbedding,
              limit: uniqueErrors.length,
            });

            // Verify results are ordered by descending similarity score
            if (results.length > 1) {
              for (let i = 0; i < results.length - 1; i++) {
                expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
              }
            }

            // Verify all similarity scores are valid numbers in [-1, 1] (cosine similarity range)
            for (const result of results) {
              expect(typeof result.similarity).toBe("number");
              expect(result.similarity).toBeGreaterThanOrEqual(-1);
              expect(result.similarity).toBeLessThanOrEqual(1);
              expect(isNaN(result.similarity)).toBe(false);
            }

            // Verify each result contains the error and its fixes
            for (const result of results) {
              expect(result.error).toBeDefined();
              expect(result.error.id).toBeTruthy();
              expect(result.fixes).toBeDefined();
              expect(Array.isArray(result.fixes)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return errors with higher similarity when embeddings are more similar", () => {
      /**
       * Additional test: errors with embeddings closer to the query should rank higher
       */
      const EMBEDDING_DIM = 8;

      fc.assert(
        fc.asyncProperty(
          errorContextArb,
          errorTypeArb,
          severityArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          async (context, type, severity, component) => {
            const errorStore = new InMemoryErrorStore();
            const vectorDB = new InMemoryVectorDB();
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              errorStore,
              vectorDB,
              embeddingDimension: EMBEDDING_DIM,
            });

            // Create query embedding (normalized unit vector)
            const queryEmbedding = [1, 0, 0, 0, 0, 0, 0, 0];

            // Create errors with known similarity to query
            const identicalError = createErrorRecord({
              timestamp: new Date(),
              type,
              component,
              severity,
              context,
              embedding: [1, 0, 0, 0, 0, 0, 0, 0], // Identical - similarity = 1
            });

            const similarError = createErrorRecord({
              timestamp: new Date(),
              type,
              component,
              severity,
              context,
              embedding: [0.9, 0.1, 0, 0, 0, 0, 0, 0], // Similar - high similarity
            });

            const orthogonalError = createErrorRecord({
              timestamp: new Date(),
              type,
              component,
              severity,
              context,
              embedding: [0, 1, 0, 0, 0, 0, 0, 0], // Orthogonal - low similarity
            });

            // Store in random order
            await knowledgeBase.storeError(orthogonalError);
            await knowledgeBase.storeError(identicalError);
            await knowledgeBase.storeError(similarError);

            // Search
            const results = await knowledgeBase.searchSimilar({
              queryEmbedding,
              limit: 3,
            });

            // Identical embedding should be first (highest similarity)
            expect(results[0].error.id).toBe(identicalError.id);
            expect(results[0].similarity).toBeCloseTo(1, 5);

            // Similar should be second
            expect(results[1].error.id).toBe(similarError.id);

            // Orthogonal should be last (lowest similarity)
            expect(results[2].error.id).toBe(orthogonalError.id);

            // Verify ordering
            expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
            expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Property 12: Filter Query Correctness", () => {
    it("should return only errors matching all specified filter criteria", () => {
      /**
       * Feature: rag-observability-power, Property 12: Filter Query Correctness
       * Validates: Requirements 4.4, 6.6
       *
       * For any query with filters (error type, component, time range, severity),
       * all returned results SHALL match every specified filter criterion,
       * and no matching results SHALL be omitted.
       */
      const EMBEDDING_DIM = 8;

      fc.assert(
        fc.asyncProperty(
          fc.array(errorRecordArb(EMBEDDING_DIM), { minLength: 5, maxLength: 20 }),
          errorTypeArb,
          severityArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          async (errors: ErrorRecord[], filterType, filterSeverity, filterComponent) => {
            const errorStore = new InMemoryErrorStore();
            const vectorDB = new InMemoryVectorDB();
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              errorStore,
              vectorDB,
              embeddingDimension: EMBEDDING_DIM,
            });

            // Ensure at least one error matches the filters
            const matchingError = createErrorRecord({
              timestamp: new Date(),
              type: filterType,
              component: filterComponent,
              severity: filterSeverity,
              context: errors[0].context,
              embedding: errors[0].embedding,
            });
            errors.push(matchingError);

            // Store all errors
            for (const error of errors) {
              await knowledgeBase.storeError(error);
            }

            // Test type filter
            const typeResults = await knowledgeBase.queryErrors({ type: filterType });
            for (const result of typeResults) {
              expect(result.type).toBe(filterType);
            }
            // Verify no matching errors were omitted
            const expectedTypeMatches = errors.filter((e) => e.type === filterType);
            expect(typeResults.length).toBe(expectedTypeMatches.length);

            // Test severity filter
            const severityResults = await knowledgeBase.queryErrors({ severity: filterSeverity });
            for (const result of severityResults) {
              expect(result.severity).toBe(filterSeverity);
            }
            const expectedSeverityMatches = errors.filter((e) => e.severity === filterSeverity);
            expect(severityResults.length).toBe(expectedSeverityMatches.length);

            // Test component filter
            const componentResults = await knowledgeBase.queryErrors({ component: filterComponent });
            for (const result of componentResults) {
              expect(result.component).toBe(filterComponent);
            }
            const expectedComponentMatches = errors.filter((e) => e.component === filterComponent);
            expect(componentResults.length).toBe(expectedComponentMatches.length);

            // Test combined filters (AND logic)
            const combinedResults = await knowledgeBase.queryErrors({
              type: filterType,
              severity: filterSeverity,
              component: filterComponent,
            });

            // All results must match ALL filters
            for (const result of combinedResults) {
              expect(result.type).toBe(filterType);
              expect(result.severity).toBe(filterSeverity);
              expect(result.component).toBe(filterComponent);
            }

            // Verify no matching errors were omitted with combined filters
            const expectedCombinedMatches = errors.filter(
              (e) =>
                e.type === filterType &&
                e.severity === filterSeverity &&
                e.component === filterComponent
            );
            expect(combinedResults.length).toBe(expectedCombinedMatches.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should correctly filter by date range", () => {
      /**
       * Additional test for date range filtering
       */
      const EMBEDDING_DIM = 8;

      fc.assert(
        fc.asyncProperty(
          errorContextArb,
          errorTypeArb,
          severityArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          embeddingArb(EMBEDDING_DIM),
          async (context, type, severity, component, embedding) => {
            const errorStore = new InMemoryErrorStore();
            const vectorDB = new InMemoryVectorDB();
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              errorStore,
              vectorDB,
              embeddingDimension: EMBEDDING_DIM,
            });

            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            // Create errors at different times
            const recentError = createErrorRecord({
              timestamp: now,
              type,
              component,
              severity,
              context,
              embedding,
            });

            const hourAgoError = createErrorRecord({
              timestamp: oneHourAgo,
              type,
              component,
              severity,
              context,
              embedding,
            });

            const oldError = createErrorRecord({
              timestamp: oneDayAgo,
              type,
              component,
              severity,
              context,
              embedding,
            });

            await knowledgeBase.storeError(recentError);
            await knowledgeBase.storeError(hourAgoError);
            await knowledgeBase.storeError(oldError);

            // Filter for errors in the last 2 hours
            const recentResults = await knowledgeBase.queryErrors({
              startDate: twoHoursAgo,
              endDate: new Date(now.getTime() + 1000), // slightly in future to include now
            });

            // Should include recent and hourAgo, but not old
            expect(recentResults.length).toBe(2);
            for (const result of recentResults) {
              expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(twoHoursAgo.getTime());
            }

            // The old error should not be in results
            const oldInResults = recentResults.some((r) => r.id === oldError.id);
            expect(oldInResults).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

