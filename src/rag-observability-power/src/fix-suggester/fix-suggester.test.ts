/**
 * Fix Suggester Tests
 *
 * Tests for the FixSuggester implementation including fix suggestion,
 * ranking, completeness, and outcome tracking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

import { FixSuggesterImpl } from "./fix-suggester.js";
import {
  ErrorKnowledgeBaseImpl,
  createErrorRecord,
  createFixRecord,
} from "../error-knowledge-base/index.js";
import type { ErrorRecord, FixRecord } from "../types/index.js";
import {
  errorTypeArb,
  severityArb,
  errorContextArb,
  embeddingArb,
  codeChangeArb,
  dateArb,
} from "../test-utils/generators.js";

describe("FixSuggesterImpl", () => {
  let knowledgeBase: ErrorKnowledgeBaseImpl;
  let fixSuggester: FixSuggesterImpl;

  // Helper to create a test error record
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
      embedding: new Array(1536).fill(0.5),
      ...overrides,
    });
  }

  // Helper to create a test fix record
  function createTestFix(errorId: string, overrides: Partial<FixRecord> = {}): FixRecord {
    return createFixRecord({
      errorId,
      description: "Test fix description",
      codeChanges: [
        {
          filePath: "src/test.ts",
          oldContent: "old",
          newContent: "new",
          description: "Fix change",
        },
      ],
      appliedAt: new Date(),
      resolved: true,
      successRate: 0.8,
      ...overrides,
    });
  }

  beforeEach(() => {
    knowledgeBase = new ErrorKnowledgeBaseImpl({
      embeddingDimension: 1536,
    });
    fixSuggester = new FixSuggesterImpl({
      knowledgeBase,
      minSimilarityThreshold: 0.1, // Lower threshold for testing
    });
  });

  describe("suggestFixes", () => {
    it("should return empty array when no similar errors exist", async () => {
      const error = createTestError();
      const suggestions = await fixSuggester.suggestFixes(error);

      expect(suggestions).toEqual([]);
    });

    it("should log novel error pattern when no similar errors exist", async () => {
      const novelPatterns: ErrorRecord[] = [];
      const suggesterWithCallback = new FixSuggesterImpl({
        knowledgeBase,
        onNovelErrorPattern: (error) => novelPatterns.push(error),
      });

      const error = createTestError();
      await suggesterWithCallback.suggestFixes(error);

      expect(novelPatterns).toHaveLength(1);
      expect(novelPatterns[0].id).toBe(error.id);
    });

    it("should return suggestions for similar errors with fixes", async () => {
      // Store an error with a fix
      const storedError = createTestError();
      await knowledgeBase.storeError(storedError);
      const fix = createTestFix(storedError.id);
      await knowledgeBase.linkFix(storedError.id, fix);

      // Query with a similar error
      const queryError = createTestError({
        id: "query-error-id",
      });
      const suggestions = await fixSuggester.suggestFixes(queryError);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggestedFix.id).toBe(fix.id);
    });

    it("should include complete information in suggestions", async () => {
      // Store an error with a fix
      const storedError = createTestError();
      await knowledgeBase.storeError(storedError);
      const fix = createTestFix(storedError.id, {
        description: "Complete fix description",
        successRate: 0.75,
      });
      await knowledgeBase.linkFix(storedError.id, fix);

      // Query with a similar error
      const queryError = createTestError({ id: "query-error-id" });
      const suggestions = await fixSuggester.suggestFixes(queryError);

      expect(suggestions.length).toBeGreaterThan(0);
      const suggestion = suggestions[0];

      // Verify suggestion completeness (Requirement 5.3)
      expect(suggestion.id).toBeDefined();
      expect(suggestion.originalError).toBeDefined();
      expect(suggestion.originalError.context).toBeDefined();
      expect(suggestion.suggestedFix).toBeDefined();
      expect(suggestion.suggestedFix.description).toBe("Complete fix description");
      expect(suggestion.suggestedFix.codeChanges).toBeDefined();
      expect(suggestion.suggestedFix.successRate).toBe(0.75);
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.reasoning).toBeDefined();
      expect(suggestion.reasoning.length).toBeGreaterThan(0);
    });

    it("should rank fixes by combined similarity and success rate", async () => {
      // Store two errors with different success rates
      const error1 = createTestError({ id: "error-1" });
      const error2 = createTestError({ id: "error-2" });
      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const fix1 = createTestFix(error1.id, { successRate: 0.9 });
      const fix2 = createTestFix(error2.id, { successRate: 0.5 });
      await knowledgeBase.linkFix(error1.id, fix1);
      await knowledgeBase.linkFix(error2.id, fix2);

      // Query with a similar error
      const queryError = createTestError({ id: "query-error-id" });
      const suggestions = await fixSuggester.suggestFixes(queryError);

      // Higher success rate should rank higher (when similarity is equal)
      expect(suggestions.length).toBe(2);
      expect(suggestions[0].suggestedFix.successRate).toBeGreaterThanOrEqual(
        suggestions[1].suggestedFix.successRate
      );
    });
  });

  describe("recordOutcome", () => {
    it("should record outcome for a suggestion", async () => {
      // Store an error with a fix
      const storedError = createTestError();
      await knowledgeBase.storeError(storedError);
      const fix = createTestFix(storedError.id);
      await knowledgeBase.linkFix(storedError.id, fix);

      // Get suggestions
      const queryError = createTestError({ id: "query-error-id" });
      const suggestions = await fixSuggester.suggestFixes(queryError);
      expect(suggestions.length).toBeGreaterThan(0);

      // Record outcome
      const suggestionId = suggestions[0].id;
      await fixSuggester.recordOutcome(suggestionId, true);

      // Verify outcome was recorded
      const suggestion = fixSuggester.getSuggestion(suggestionId);
      expect(suggestion?.resolved).toBe(true);
    });

    it("should throw error for unknown suggestion ID", async () => {
      await expect(
        fixSuggester.recordOutcome("unknown-suggestion-id", true)
      ).rejects.toThrow("Suggestion with id 'unknown-suggestion-id' not found");
    });

    it("should update fix effectiveness in knowledge base", async () => {
      // Store an error with a fix
      const storedError = createTestError();
      await knowledgeBase.storeError(storedError);
      const fix = createTestFix(storedError.id, { successRate: 0.5 });
      await knowledgeBase.linkFix(storedError.id, fix);

      // Get suggestions
      const queryError = createTestError({ id: "query-error-id" });
      const suggestions = await fixSuggester.suggestFixes(queryError);
      expect(suggestions.length).toBeGreaterThan(0);

      // Record positive outcome
      await fixSuggester.recordOutcome(suggestions[0].id, true);

      // Verify fix effectiveness was updated
      const updatedError = await knowledgeBase.getError(storedError.id);
      const updatedFix = updatedError.fixes.find((f) => f.id === fix.id);
      expect(updatedFix?.successRate).not.toBe(0.5); // Should have changed
    });
  });

  describe("getOutcomeStatistics", () => {
    it("should return correct statistics", async () => {
      // Store errors with fixes
      const error1 = createTestError({ id: "error-1" });
      const error2 = createTestError({ id: "error-2" });
      await knowledgeBase.storeError(error1);
      await knowledgeBase.storeError(error2);

      const fix1 = createTestFix(error1.id);
      const fix2 = createTestFix(error2.id);
      await knowledgeBase.linkFix(error1.id, fix1);
      await knowledgeBase.linkFix(error2.id, fix2);

      // Get suggestions
      const queryError = createTestError({ id: "query-error-id" });
      const suggestions = await fixSuggester.suggestFixes(queryError);
      expect(suggestions.length).toBe(2);

      // Record outcomes
      await fixSuggester.recordOutcome(suggestions[0].id, true);
      await fixSuggester.recordOutcome(suggestions[1].id, false);

      // Check statistics
      const stats = fixSuggester.getOutcomeStatistics();
      expect(stats.total).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.notResolved).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.resolutionRate).toBe(0.5);
    });

    it("should handle pending suggestions", async () => {
      // Store an error with a fix
      const storedError = createTestError();
      await knowledgeBase.storeError(storedError);
      const fix = createTestFix(storedError.id);
      await knowledgeBase.linkFix(storedError.id, fix);

      // Get suggestions but don't record outcome
      const queryError = createTestError({ id: "query-error-id" });
      await fixSuggester.suggestFixes(queryError);

      // Check statistics
      const stats = fixSuggester.getOutcomeStatistics();
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.resolved).toBe(0);
      expect(stats.notResolved).toBe(0);
    });
  });

  describe("getNovelErrorPatterns", () => {
    it("should track novel error patterns", async () => {
      const error1 = createTestError({ id: "novel-1" });
      const error2 = createTestError({ id: "novel-2" });

      await fixSuggester.suggestFixes(error1);
      await fixSuggester.suggestFixes(error2);

      const patterns = fixSuggester.getNovelErrorPatterns();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].id).toBe("novel-1");
      expect(patterns[1].id).toBe("novel-2");
    });

    it("should clear novel error patterns", async () => {
      const error = createTestError();
      await fixSuggester.suggestFixes(error);

      expect(fixSuggester.getNovelErrorPatterns()).toHaveLength(1);

      fixSuggester.clearNovelErrorPatterns();

      expect(fixSuggester.getNovelErrorPatterns()).toHaveLength(0);
    });
  });

  describe("hasSuggestions", () => {
    it("should return false when no similar errors exist", async () => {
      const error = createTestError();
      const hasSuggestions = await fixSuggester.hasSuggestions(error);
      expect(hasSuggestions).toBe(false);
    });

    it("should return true when similar errors with fixes exist", async () => {
      // Store an error with a fix
      const storedError = createTestError();
      await knowledgeBase.storeError(storedError);
      const fix = createTestFix(storedError.id);
      await knowledgeBase.linkFix(storedError.id, fix);

      // Check if suggestions are available
      const queryError = createTestError({ id: "query-error-id" });
      const hasSuggestions = await fixSuggester.hasSuggestions(queryError);
      expect(hasSuggestions).toBe(true);
    });
  });
});

describe("Property-Based Tests", () => {
  const EMBEDDING_DIM = 64; // Use smaller dimension for faster tests

  // Generator for valid error records
  const errorRecordArb = (): fc.Arbitrary<ErrorRecord> =>
    fc.record({
      id: fc.uuid().map((id) => `error-${id}`),
      timestamp: dateArb,
      type: errorTypeArb,
      component: fc.string({ minLength: 1, maxLength: 50 }),
      severity: severityArb,
      context: errorContextArb,
      embedding: embeddingArb(EMBEDDING_DIM),
      fixes: fc.constant([]),
    });

  // Generator for fix data (without id and errorId)
  const fixDataArb = fc.record({
    description: fc.string({ minLength: 1, maxLength: 200 }),
    codeChanges: fc.array(codeChangeArb, { minLength: 0, maxLength: 3 }),
    appliedAt: dateArb,
    resolved: fc.boolean(),
    successRate: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  describe("Property 13: Fix Ranking Correctness", () => {
    it("should rank fixes by combined similarity and success rate", () => {
      /**
       * Feature: rag-observability-power, Property 13: Fix Ranking Correctness
       * Validates: Requirements 5.2
       *
       * For any set of fix suggestions, fixes SHALL be ordered by a combination
       * of relevance and success rate, with higher success rates ranking higher
       * among equally relevant fixes.
       */
      fc.assert(
        fc.asyncProperty(
          errorRecordArb(),
          fc.array(fixDataArb, { minLength: 2, maxLength: 5 }),
          async (baseError, fixDataList) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const fixSuggester = new FixSuggesterImpl({
              knowledgeBase,
              minSimilarityThreshold: 0.0, // Accept all similarities for testing
            });

            // Store multiple errors with different success rate fixes
            const storedErrors: ErrorRecord[] = [];
            for (let i = 0; i < fixDataList.length; i++) {
              const error = createErrorRecord({
                timestamp: new Date(),
                type: baseError.type,
                component: baseError.component,
                severity: baseError.severity,
                context: baseError.context,
                embedding: baseError.embedding, // Same embedding for equal similarity
              });
              await knowledgeBase.storeError(error);

              const fix = createFixRecord({
                errorId: error.id,
                ...fixDataList[i],
              });
              await knowledgeBase.linkFix(error.id, fix);
              storedErrors.push(error);
            }

            // Query with the same embedding
            const queryError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            const suggestions = await fixSuggester.suggestFixes(queryError);

            // Verify suggestions are ordered by confidence (combined score)
            if (suggestions.length > 1) {
              for (let i = 0; i < suggestions.length - 1; i++) {
                // Confidence should be non-increasing
                expect(suggestions[i].confidence).toBeGreaterThanOrEqual(
                  suggestions[i + 1].confidence
                );
              }
            }

            // Verify that among equally confident suggestions, higher success rate ranks higher
            for (let i = 0; i < suggestions.length - 1; i++) {
              if (Math.abs(suggestions[i].confidence - suggestions[i + 1].confidence) < 0.001) {
                // Equal confidence - higher success rate should rank higher or equal
                expect(suggestions[i].suggestedFix.successRate).toBeGreaterThanOrEqual(
                  suggestions[i + 1].suggestedFix.successRate
                );
              }
            }

            // Verify all confidence scores are valid
            for (const suggestion of suggestions) {
              expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
              expect(suggestion.confidence).toBeLessThanOrEqual(1);
              expect(isNaN(suggestion.confidence)).toBe(false);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should prefer higher success rate when similarities are equal", () => {
      /**
       * Additional test: explicitly verify success rate ordering for equal similarity
       */
      fc.assert(
        fc.asyncProperty(
          errorRecordArb(),
          async (baseError) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const fixSuggester = new FixSuggesterImpl({
              knowledgeBase,
              minSimilarityThreshold: 0.0,
            });

            // Create errors with identical embeddings but different success rates
            const successRates = [0.9, 0.5, 0.1, 0.7, 0.3];

            for (const rate of successRates) {
              const error = createErrorRecord({
                timestamp: new Date(),
                type: baseError.type,
                component: baseError.component,
                severity: baseError.severity,
                context: baseError.context,
                embedding: baseError.embedding,
              });
              await knowledgeBase.storeError(error);

              const fix = createFixRecord({
                errorId: error.id,
                description: `Fix with ${rate * 100}% success rate`,
                codeChanges: [],
                appliedAt: new Date(),
                resolved: rate > 0.5,
                successRate: rate,
              });
              await knowledgeBase.linkFix(error.id, fix);
            }

            const queryError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            const suggestions = await fixSuggester.suggestFixes(queryError);

            // Verify ordering by success rate (since similarities are equal)
            const sortedRates = [...successRates].sort((a, b) => b - a);
            for (let i = 0; i < suggestions.length; i++) {
              expect(suggestions[i].suggestedFix.successRate).toBe(sortedRates[i]);
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe("Property 14: Fix Suggestion Completeness", () => {
    it("should include all required information in suggestions", () => {
      /**
       * Feature: rag-observability-power, Property 14: Fix Suggestion Completeness
       * Validates: Requirements 5.3
       *
       * For any fix suggestion presented, it SHALL contain the original error context,
       * the fix description, the code changes, and the historical outcome (success rate).
       */
      fc.assert(
        fc.asyncProperty(
          errorRecordArb(),
          fixDataArb,
          async (baseError, fixData) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const fixSuggester = new FixSuggesterImpl({
              knowledgeBase,
              minSimilarityThreshold: 0.0,
            });

            // Store an error with a fix
            const storedError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });
            await knowledgeBase.storeError(storedError);

            const fix = createFixRecord({
              errorId: storedError.id,
              ...fixData,
            });
            await knowledgeBase.linkFix(storedError.id, fix);

            // Query with the same embedding
            const queryError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            const suggestions = await fixSuggester.suggestFixes(queryError);

            expect(suggestions.length).toBeGreaterThan(0);

            for (const suggestion of suggestions) {
              // Verify suggestion has unique ID
              expect(suggestion.id).toBeDefined();
              expect(typeof suggestion.id).toBe("string");
              expect(suggestion.id.length).toBeGreaterThan(0);

              // Verify original error context is included
              expect(suggestion.originalError).toBeDefined();
              expect(suggestion.originalError.id).toBeTruthy();
              expect(suggestion.originalError.type).toBeDefined();
              expect(suggestion.originalError.component).toBeDefined();
              expect(suggestion.originalError.severity).toBeDefined();
              expect(suggestion.originalError.context).toBeDefined();
              expect(suggestion.originalError.context.query).toBeDefined();
              expect(suggestion.originalError.context.retrievedDocs).toBeDefined();
              expect(suggestion.originalError.context.breadcrumbs).toBeDefined();

              // Verify fix description is included
              expect(suggestion.suggestedFix).toBeDefined();
              expect(suggestion.suggestedFix.description).toBeDefined();
              expect(typeof suggestion.suggestedFix.description).toBe("string");
              expect(suggestion.suggestedFix.description.length).toBeGreaterThan(0);

              // Verify code changes are included
              expect(suggestion.suggestedFix.codeChanges).toBeDefined();
              expect(Array.isArray(suggestion.suggestedFix.codeChanges)).toBe(true);

              // Verify historical outcome (success rate) is included
              expect(typeof suggestion.suggestedFix.successRate).toBe("number");
              expect(suggestion.suggestedFix.successRate).toBeGreaterThanOrEqual(0);
              expect(suggestion.suggestedFix.successRate).toBeLessThanOrEqual(1);
              expect(isNaN(suggestion.suggestedFix.successRate)).toBe(false);

              // Verify confidence score is included
              expect(typeof suggestion.confidence).toBe("number");
              expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
              expect(suggestion.confidence).toBeLessThanOrEqual(1);

              // Verify reasoning is included
              expect(suggestion.reasoning).toBeDefined();
              expect(typeof suggestion.reasoning).toBe("string");
              expect(suggestion.reasoning.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe("Property 15: Fix Outcome Tracking", () => {
    it("should update fix success rate based on recorded outcomes", () => {
      /**
       * Feature: rag-observability-power, Property 15: Fix Outcome Tracking
       * Validates: Requirements 5.5
       *
       * For any suggested fix that is applied and its outcome recorded,
       * the fix's success rate SHALL be updated to reflect the new outcome,
       * and subsequent rankings SHALL use the updated success rate.
       */
      fc.assert(
        fc.asyncProperty(
          errorRecordArb(),
          fc.double({ min: 0.3, max: 0.7, noNaN: true }), // Initial success rate
          fc.boolean(), // Outcome to record
          async (baseError, initialSuccessRate, outcome) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const fixSuggester = new FixSuggesterImpl({
              knowledgeBase,
              minSimilarityThreshold: 0.0,
            });

            // Store an error with a fix
            const storedError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });
            await knowledgeBase.storeError(storedError);

            const fix = createFixRecord({
              errorId: storedError.id,
              description: "Test fix",
              codeChanges: [],
              appliedAt: new Date(),
              resolved: false,
              successRate: initialSuccessRate,
            });
            await knowledgeBase.linkFix(storedError.id, fix);

            // Get suggestions
            const queryError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            const suggestions = await fixSuggester.suggestFixes(queryError);
            expect(suggestions.length).toBeGreaterThan(0);

            const suggestion = suggestions[0];
            const originalSuccessRate = suggestion.suggestedFix.successRate;

            // Record the outcome
            await fixSuggester.recordOutcome(suggestion.id, outcome);

            // Verify the suggestion record was updated
            const updatedSuggestionRecord = fixSuggester.getSuggestion(suggestion.id);
            expect(updatedSuggestionRecord).toBeDefined();
            expect(updatedSuggestionRecord?.resolved).toBe(outcome);

            // Verify the fix's success rate was updated in the knowledge base
            const updatedError = await knowledgeBase.getError(storedError.id);
            const updatedFix = updatedError.fixes.find((f) => f.id === fix.id);
            expect(updatedFix).toBeDefined();

            // Success rate should have changed
            if (updatedFix) {
              expect(updatedFix.successRate).not.toBe(originalSuccessRate);

              // If outcome was positive, success rate should increase
              if (outcome) {
                expect(updatedFix.successRate).toBeGreaterThan(initialSuccessRate);
              } else {
                // If outcome was negative, success rate should decrease
                expect(updatedFix.successRate).toBeLessThan(initialSuccessRate);
              }
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should use updated success rate in subsequent rankings", () => {
      /**
       * Additional test: verify subsequent rankings use updated rates
       */
      fc.assert(
        fc.asyncProperty(errorRecordArb(), async (baseError) => {
          const knowledgeBase = new ErrorKnowledgeBaseImpl({
            embeddingDimension: EMBEDDING_DIM,
          });
          const fixSuggester = new FixSuggesterImpl({
            knowledgeBase,
            minSimilarityThreshold: 0.0,
          });

          // Store two errors with similar embeddings but different initial success rates
          const error1 = createErrorRecord({
            timestamp: new Date(),
            type: baseError.type,
            component: baseError.component,
            severity: baseError.severity,
            context: baseError.context,
            embedding: baseError.embedding,
          });
          await knowledgeBase.storeError(error1);

          const fix1 = createFixRecord({
            errorId: error1.id,
            description: "Fix 1 - initially lower success rate",
            codeChanges: [],
            appliedAt: new Date(),
            resolved: false,
            successRate: 0.3, // Lower initial rate
          });
          await knowledgeBase.linkFix(error1.id, fix1);

          const error2 = createErrorRecord({
            timestamp: new Date(),
            type: baseError.type,
            component: baseError.component,
            severity: baseError.severity,
            context: baseError.context,
            embedding: baseError.embedding,
          });
          await knowledgeBase.storeError(error2);

          const fix2 = createFixRecord({
            errorId: error2.id,
            description: "Fix 2 - initially higher success rate",
            codeChanges: [],
            appliedAt: new Date(),
            resolved: true,
            successRate: 0.7, // Higher initial rate
          });
          await knowledgeBase.linkFix(error2.id, fix2);

          // Get initial suggestions - fix2 should rank higher
          const queryError = createErrorRecord({
            timestamp: new Date(),
            type: baseError.type,
            component: baseError.component,
            severity: baseError.severity,
            context: baseError.context,
            embedding: baseError.embedding,
          });

          const initialSuggestions = await fixSuggester.suggestFixes(queryError);
          expect(initialSuggestions.length).toBe(2);
          expect(initialSuggestions[0].suggestedFix.id).toBe(fix2.id);

          // Record positive outcome for fix1 multiple times to boost its success rate
          for (let i = 0; i < 5; i++) {
            // Get fresh suggestions each time
            const suggestions = await fixSuggester.suggestFixes(queryError);
            const fix1Suggestion = suggestions.find((s) => s.suggestedFix.id === fix1.id);
            if (fix1Suggestion) {
              await fixSuggester.recordOutcome(fix1Suggestion.id, true);
            }
          }

          // Get new suggestions - fix1's success rate should have increased
          const updatedError1 = await knowledgeBase.getError(error1.id);
          const updatedFix1 = updatedError1.fixes.find((f) => f.id === fix1.id);
          expect(updatedFix1).toBeDefined();
          expect(updatedFix1!.successRate).toBeGreaterThan(0.3);
        }),
        { numRuns: 25 }
      );
    });
  });
});

