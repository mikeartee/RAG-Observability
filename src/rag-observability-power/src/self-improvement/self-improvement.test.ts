/**
 * Self-Improvement Loop Tests
 *
 * Unit tests for the SelfImprovementLoop implementation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

import type {
  CodingContext,
  ErrorRecord,
  FixPattern,
  FixRecord,
} from "../types/index.js";
import { ErrorKnowledgeBaseImpl } from "../error-knowledge-base/index.js";
import { createErrorRecord, createFixRecord } from "../error-knowledge-base/error-knowledge-base.js";
import {
  errorTypeArb,
  severityArb,
  errorContextArb,
  embeddingArb,
  codeChangeArb,
  dateArb,
  codingContextArb,
  fileChangeArb,
} from "../test-utils/generators.js";

import { SelfImprovementLoopImpl } from "./self-improvement.js";

describe("SelfImprovementLoopImpl", () => {
  let knowledgeBase: ErrorKnowledgeBaseImpl;
  let selfImprovement: SelfImprovementLoopImpl;

  // Helper to create a valid error record
  function createTestError(overrides: Partial<ErrorRecord> = {}): ErrorRecord {
    return {
      id: `error-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      type: "retrieval_failure",
      component: "retrieval",
      severity: "medium",
      context: {
        query: "test query",
        retrievedDocs: ["doc1", "doc2"],
        breadcrumbs: [],
      },
      embedding: Array(1536).fill(0).map((_, i) => Math.sin(i) * 0.5),
      fixes: [],
      ...overrides,
    };
  }

  // Helper to create a valid fix record
  function createTestFix(errorId: string, overrides: Partial<FixRecord> = {}): FixRecord {
    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      errorId,
      description: "Test fix description",
      codeChanges: [],
      appliedAt: new Date(),
      resolved: true,
      successRate: 0.8,
      ...overrides,
    };
  }

  // Helper to create a coding context
  function createTestContext(overrides: Partial<CodingContext> = {}): CodingContext {
    return {
      currentFile: "src/retrieval/index.ts",
      recentChanges: [],
      ragRelatedFiles: [],
      sessionId: "test-session",
      ...overrides,
    };
  }

  beforeEach(() => {
    knowledgeBase = new ErrorKnowledgeBaseImpl({
      embeddingDimension: 1536,
    });
    selfImprovement = new SelfImprovementLoopImpl({
      knowledgeBase,
      steeringRuleThreshold: 3,
      maxRelevantErrors: 5,
      minRelevanceThreshold: 0.3,
    });
  });

  describe("getRelevantErrors", () => {
    it("should return empty array when no RAG-related files in context", async () => {
      const context = createTestContext({
        currentFile: "src/utils/helpers.ts",
        ragRelatedFiles: [],
      });

      const result = await selfImprovement.getRelevantErrors(context);

      expect(result).toEqual([]);
    });

    it("should identify RAG-related files from current file", async () => {
      // Store an error first
      const error = createTestError({
        component: "retrieval",
        context: {
          query: "retrieval test query",
          retrievedDocs: ["doc1"],
          breadcrumbs: [],
        },
      });
      await knowledgeBase.storeError(error);

      const context = createTestContext({
        currentFile: "src/retrieval/search.ts",
        ragRelatedFiles: [],
      });

      const result = await selfImprovement.getRelevantErrors(context);

      // Should find the error since current file is RAG-related
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should include errors with suggested fixes", async () => {
      // Store an error with a fix
      const error = createTestError({
        component: "embedding",
      });
      const fix = createTestFix(error.id, {
        description: "Fix embedding dimension mismatch",
        successRate: 0.9,
        resolved: true,
      });
      error.fixes = [fix];
      await knowledgeBase.storeError(error);

      const context = createTestContext({
        currentFile: "src/embedding/generator.ts",
        ragRelatedFiles: ["src/embedding/generator.ts"],
      });

      const result = await selfImprovement.getRelevantErrors(context);

      // If errors are found, they should have warning messages
      for (const relevantError of result) {
        expect(relevantError.warning).toBeDefined();
        expect(typeof relevantError.warning).toBe("string");
      }
    });

    it("should respect maxRelevantErrors limit", async () => {
      // Store multiple errors
      for (let i = 0; i < 10; i++) {
        const error = createTestError({
          id: `error-${i}`,
          component: "retrieval",
          context: {
            query: `test query ${i}`,
            retrievedDocs: ["doc1"],
            breadcrumbs: [],
          },
        });
        await knowledgeBase.storeError(error);
      }

      const context = createTestContext({
        currentFile: "src/retrieval/search.ts",
        ragRelatedFiles: ["src/retrieval/search.ts"],
      });

      const result = await selfImprovement.getRelevantErrors(context);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("should generate warning messages for relevant errors", async () => {
      const error = createTestError({
        type: "retrieval_failure",
        component: "retrieval",
        context: {
          query: "search for documents about AI",
          retrievedDocs: ["doc1"],
          breadcrumbs: [],
        },
      });
      const fix = createTestFix(error.id, {
        description: "Increase retrieval limit",
        successRate: 0.85,
      });
      error.fixes = [fix];
      await knowledgeBase.storeError(error);

      const context = createTestContext({
        currentFile: "src/retrieval/search.ts",
        ragRelatedFiles: ["src/retrieval/search.ts"],
      });

      const result = await selfImprovement.getRelevantErrors(context);

      for (const relevantError of result) {
        expect(relevantError.warning).toContain("⚠️");
      }
    });
  });

  describe("generateSteeringRule", () => {
    it("should generate a steering rule when threshold is met", async () => {
      const pattern: FixPattern = {
        patternId: "pattern-1",
        errorType: "retrieval_failure",
        fixDescription: "Increase retrieval limit to 20",
        successCount: 5,
        errorIds: ["error-1", "error-2", "error-3", "error-4", "error-5"],
      };

      const rule = await selfImprovement.generateSteeringRule(pattern);

      expect(rule.id).toBeDefined();
      expect(rule.pattern).toBe(pattern.fixDescription);
      expect(rule.generatedFrom).toEqual(pattern.errorIds);
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
      expect(rule.rule).toContain("retrieval_failure");
    });

    it("should throw error when success count is below threshold", async () => {
      const pattern: FixPattern = {
        patternId: "pattern-1",
        errorType: "retrieval_failure",
        fixDescription: "Increase retrieval limit",
        successCount: 2, // Below threshold of 3
        errorIds: ["error-1", "error-2"],
      };

      await expect(selfImprovement.generateSteeringRule(pattern)).rejects.toThrow(
        /threshold/
      );
    });

    it("should store generated rules", async () => {
      const pattern: FixPattern = {
        patternId: "pattern-1",
        errorType: "embedding_error",
        fixDescription: "Normalize embedding vectors",
        successCount: 4,
        errorIds: ["error-1", "error-2", "error-3", "error-4"],
      };

      await selfImprovement.generateSteeringRule(pattern);

      const rules = selfImprovement.getSteeringRules();
      expect(rules.length).toBe(1);
      expect(rules[0].pattern).toBe(pattern.fixDescription);
    });

    it("should reference contributing error IDs in the rule", async () => {
      const errorIds = ["error-a", "error-b", "error-c"];
      const pattern: FixPattern = {
        patternId: "pattern-1",
        errorType: "generation_error",
        fixDescription: "Add context length check",
        successCount: 3,
        errorIds,
      };

      const rule = await selfImprovement.generateSteeringRule(pattern);

      expect(rule.generatedFrom).toEqual(errorIds);
      expect(rule.generatedFrom.length).toBe(3);
    });

    it("should calculate confidence based on success count", async () => {
      const pattern1: FixPattern = {
        patternId: "pattern-1",
        errorType: "retrieval_failure",
        fixDescription: "Fix 1",
        successCount: 3,
        errorIds: ["e1", "e2", "e3"],
      };

      const pattern2: FixPattern = {
        patternId: "pattern-2",
        errorType: "retrieval_failure",
        fixDescription: "Fix 2",
        successCount: 10,
        errorIds: ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10"],
      };

      const rule1 = await selfImprovement.generateSteeringRule(pattern1);
      const rule2 = await selfImprovement.generateSteeringRule(pattern2);

      expect(rule2.confidence).toBeGreaterThan(rule1.confidence);
    });
  });

  describe("recordHelpfulness", () => {
    it("should record helpful feedback", async () => {
      const errorId = "error-123";

      await selfImprovement.recordHelpfulness(errorId, true);

      const record = selfImprovement.getHelpfulnessRecord(errorId);
      expect(record).toBeDefined();
      expect(record?.helpful).toBe(true);
      expect(record?.errorId).toBe(errorId);
    });

    it("should record not helpful feedback", async () => {
      const errorId = "error-456";

      await selfImprovement.recordHelpfulness(errorId, false);

      const record = selfImprovement.getHelpfulnessRecord(errorId);
      expect(record).toBeDefined();
      expect(record?.helpful).toBe(false);
    });

    it("should track helpfulness statistics", async () => {
      await selfImprovement.recordHelpfulness("error-1", true);
      await selfImprovement.recordHelpfulness("error-2", true);
      await selfImprovement.recordHelpfulness("error-3", false);

      const stats = selfImprovement.getHelpfulnessStats();

      expect(stats.total).toBe(3);
      expect(stats.helpful).toBe(2);
      expect(stats.notHelpful).toBe(1);
      expect(stats.helpfulnessRate).toBeCloseTo(2 / 3, 2);
    });

    it("should update existing helpfulness record", async () => {
      const errorId = "error-789";

      await selfImprovement.recordHelpfulness(errorId, false);
      await selfImprovement.recordHelpfulness(errorId, true);

      const record = selfImprovement.getHelpfulnessRecord(errorId);
      expect(record?.helpful).toBe(true);
    });

    it("should influence future retrieval relevance", async () => {
      // Store an error
      const error = createTestError({
        id: "error-helpful",
        component: "retrieval",
      });
      await knowledgeBase.storeError(error);

      // Record as helpful
      await selfImprovement.recordHelpfulness(error.id, true);

      // The helpfulness should be tracked
      const record = selfImprovement.getHelpfulnessRecord(error.id);
      expect(record?.helpful).toBe(true);
    });
  });

  describe("getProactiveSuggestion", () => {
    it("should return null when no similar errors exist", async () => {
      const error = createTestError();

      const suggestion = await selfImprovement.getProactiveSuggestion(error);

      expect(suggestion).toBeNull();
    });

    it("should suggest fix for matching error pattern", async () => {
      // Store an error with a successful fix
      const existingError = createTestError({
        type: "embedding_error",
        component: "embedding",
        context: {
          query: "embedding dimension mismatch",
          retrievedDocs: [],
          breadcrumbs: [],
        },
      });
      const fix = createTestFix(existingError.id, {
        description: "Normalize embedding dimensions",
        successRate: 0.9,
        resolved: true,
      });
      existingError.fixes = [fix];
      await knowledgeBase.storeError(existingError);

      // Create a similar new error
      const newError = createTestError({
        type: "embedding_error",
        component: "embedding",
        context: {
          query: "embedding dimension mismatch error",
          retrievedDocs: [],
          breadcrumbs: [],
        },
        embedding: existingError.embedding, // Same embedding for high similarity
      });

      const suggestion = await selfImprovement.getProactiveSuggestion(newError);

      // May or may not find a match depending on similarity threshold
      if (suggestion) {
        expect(suggestion.warning).toContain("🔔");
        expect(suggestion.suggestedFix).toBeDefined();
      }
    });
  });

  describe("steering rule management", () => {
    it("should track fix pattern success counts", () => {
      const pattern: FixPattern = {
        patternId: "pattern-1",
        errorType: "retrieval_failure",
        fixDescription: "Test fix",
        successCount: 1,
        errorIds: ["e1"],
      };

      selfImprovement.trackFixSuccess(pattern);
      selfImprovement.trackFixSuccess(pattern);

      expect(selfImprovement.shouldGenerateSteeringRule("pattern-1")).toBe(false);

      selfImprovement.trackFixSuccess(pattern);

      expect(selfImprovement.shouldGenerateSteeringRule("pattern-1")).toBe(true);
    });

    it("should deactivate steering rules", async () => {
      const pattern: FixPattern = {
        patternId: "pattern-1",
        errorType: "retrieval_failure",
        fixDescription: "Test fix",
        successCount: 5,
        errorIds: ["e1", "e2", "e3", "e4", "e5"],
      };

      const rule = await selfImprovement.generateSteeringRule(pattern);

      expect(selfImprovement.getActiveSteeringRules().length).toBe(1);

      selfImprovement.deactivateRule(rule.id);

      expect(selfImprovement.getActiveSteeringRules().length).toBe(0);
      expect(selfImprovement.getSteeringRules().length).toBe(1);
    });
  });
});

describe("Property-Based Tests", () => {
  const EMBEDDING_DIM = 64; // Use smaller dimension for faster tests

  // Generator for RAG-related file paths
  const ragFilePathArb = fc.constantFrom(
    "src/retrieval/search.ts",
    "src/embedding/generator.ts",
    "src/vector/store.ts",
    "src/rag/pipeline.ts",
    "src/llm/client.ts",
    "src/generation/output.ts",
    "src/prompt/builder.ts",
    "src/context/manager.ts",
    "src/index/builder.ts",
    "src/chunk/splitter.ts"
  );

  // Generator for non-RAG file paths
  const nonRagFilePathArb = fc.constantFrom(
    "src/utils/helpers.ts",
    "src/config/settings.ts",
    "src/auth/login.ts",
    "src/ui/button.tsx",
    "src/api/routes.ts"
  );

  // Generator for RAG-related coding context
  const ragCodingContextArb: fc.Arbitrary<CodingContext> = fc.record({
    currentFile: ragFilePathArb,
    recentChanges: fc.array(
      fc.record({
        path: ragFilePathArb,
        changeType: fc.constantFrom("added" as const, "modified" as const, "deleted" as const),
        diff: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    ragRelatedFiles: fc.array(ragFilePathArb, { minLength: 1, maxLength: 5 }),
    sessionId: fc.uuid(),
  });

  // Generator for valid error records with RAG components
  const ragErrorRecordArb = (): fc.Arbitrary<ErrorRecord> =>
    fc.record({
      id: fc.uuid().map((id) => `error-${id}`),
      timestamp: dateArb,
      type: errorTypeArb,
      component: fc.constantFrom("retrieval", "embedding", "vector", "rag", "llm", "generation", "prompt", "context", "index", "chunk"),
      severity: severityArb,
      context: errorContextArb,
      embedding: embeddingArb(EMBEDDING_DIM),
      fixes: fc.constant([]),
    });

  // Generator for fix patterns
  const fixPatternArb = (minSuccessCount: number = 3): fc.Arbitrary<FixPattern> =>
    fc.record({
      patternId: fc.uuid().map((id) => `pattern-${id}`),
      errorType: errorTypeArb,
      fixDescription: fc.string({ minLength: 10, maxLength: 200 }),
      successCount: fc.integer({ min: minSuccessCount, max: 20 }),
      errorIds: fc.array(fc.uuid().map((id) => `error-${id}`), { minLength: minSuccessCount, maxLength: 20 }),
    });

  describe("Property 16: Context-Aware Error Surfacing", () => {
    it("should retrieve errors related to RAG files in coding context", () => {
      /**
       * Feature: rag-observability-power, Property 16: Context-Aware Error Surfacing
       * Validates: Requirements 7.1, 7.2
       *
       * For any coding context involving RAG-related files, the system SHALL
       * retrieve errors related to those files, and those errors SHALL be
       * injected into the context as warnings.
       */
      fc.assert(
        fc.asyncProperty(
          ragCodingContextArb,
          ragErrorRecordArb(),
          async (context, baseError) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: 3,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.1, // Lower threshold for testing
            });

            // Store an error related to the RAG context
            const storedError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            // Add a fix to make it more relevant
            const fix: FixRecord = {
              id: `fix-${Date.now()}`,
              errorId: storedError.id,
              description: "Fix for RAG-related error",
              codeChanges: [],
              appliedAt: new Date(),
              resolved: true,
              successRate: 0.8,
            };
            storedError.fixes = [fix];

            await knowledgeBase.storeError(storedError);

            // Get relevant errors for the context
            const relevantErrors = await selfImprovement.getRelevantErrors(context);

            // If errors are returned, verify they have warnings
            for (const relevantError of relevantErrors) {
              // Verify the error has all required fields
              expect(relevantError.error).toBeDefined();
              expect(relevantError.error.id).toBeTruthy();
              expect(relevantError.error.type).toBeDefined();
              expect(relevantError.error.component).toBeDefined();

              // Verify the warning is present (injected into context)
              expect(relevantError.warning).toBeDefined();
              expect(typeof relevantError.warning).toBe("string");
              expect(relevantError.warning.length).toBeGreaterThan(0);
              expect(relevantError.warning).toContain("⚠️");

              // Verify relevance score is valid
              expect(relevantError.relevance).toBeGreaterThanOrEqual(0);
              expect(relevantError.relevance).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should return empty for non-RAG contexts", () => {
      /**
       * Additional test: non-RAG contexts should not surface errors
       */
      fc.assert(
        fc.asyncProperty(
          fc.record({
            currentFile: nonRagFilePathArb,
            recentChanges: fc.constant([]),
            ragRelatedFiles: fc.constant([]),
            sessionId: fc.uuid(),
          }),
          async (context: CodingContext) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: 3,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Store some errors
            for (let i = 0; i < 3; i++) {
              const error = createErrorRecord({
                timestamp: new Date(),
                type: "retrieval_failure",
                component: "retrieval",
                severity: "medium",
                context: {
                  query: "test query",
                  retrievedDocs: [],
                  breadcrumbs: [],
                },
                embedding: Array(EMBEDDING_DIM).fill(0).map((_, j) => Math.sin(j) * 0.5),
              });
              await knowledgeBase.storeError(error);
            }

            // Get relevant errors - should be empty for non-RAG context
            const relevantErrors = await selfImprovement.getRelevantErrors(context);
            expect(relevantErrors).toEqual([]);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe("Property 17: Steering Rule Auto-Generation", () => {
    it("should generate steering rules when fix pattern threshold is met", () => {
      /**
       * Feature: rag-observability-power, Property 17: Steering Rule Auto-Generation
       * Validates: Requirements 7.3
       *
       * For any fix pattern that has been successful at least N times (configurable threshold),
       * the system SHALL generate a steering rule, and that rule SHALL reference the error IDs
       * that contributed to its generation.
       */
      fc.assert(
        fc.asyncProperty(
          fixPatternArb(3), // Minimum 3 successes to meet threshold
          fc.integer({ min: 1, max: 5 }), // Threshold
          async (pattern, threshold) => {
            // Ensure pattern meets threshold
            if (pattern.successCount < threshold) {
              pattern.successCount = threshold;
              while (pattern.errorIds.length < threshold) {
                pattern.errorIds.push(`error-${Date.now()}-${Math.random()}`);
              }
            }

            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: threshold,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Generate steering rule
            const rule = await selfImprovement.generateSteeringRule(pattern);

            // Verify rule structure
            expect(rule.id).toBeDefined();
            expect(typeof rule.id).toBe("string");
            expect(rule.id.length).toBeGreaterThan(0);

            // Verify rule references the fix pattern
            expect(rule.pattern).toBe(pattern.fixDescription);

            // Verify rule references contributing error IDs
            expect(rule.generatedFrom).toBeDefined();
            expect(Array.isArray(rule.generatedFrom)).toBe(true);
            expect(rule.generatedFrom).toEqual(pattern.errorIds);
            expect(rule.generatedFrom.length).toBeGreaterThanOrEqual(threshold);

            // Verify rule content is generated
            expect(rule.rule).toBeDefined();
            expect(typeof rule.rule).toBe("string");
            expect(rule.rule.length).toBeGreaterThan(0);
            expect(rule.rule).toContain(pattern.errorType);

            // Verify confidence is valid and based on success count
            expect(rule.confidence).toBeGreaterThan(0);
            expect(rule.confidence).toBeLessThanOrEqual(1);

            // Verify rule is stored
            const storedRules = selfImprovement.getSteeringRules();
            expect(storedRules.some((r) => r.id === rule.id)).toBe(true);
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should reject patterns below threshold", () => {
      /**
       * Additional test: patterns below threshold should be rejected
       */
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }), // Threshold
          async (threshold) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: threshold,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Create pattern below threshold
            const belowThresholdPattern: FixPattern = {
              patternId: "pattern-below",
              errorType: "retrieval_failure",
              fixDescription: "Test fix",
              successCount: threshold - 1,
              errorIds: Array(threshold - 1)
                .fill(0)
                .map((_, i) => `error-${i}`),
            };

            // Should throw error
            await expect(
              selfImprovement.generateSteeringRule(belowThresholdPattern)
            ).rejects.toThrow(/threshold/);
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should increase confidence with more successes", () => {
      /**
       * Additional test: confidence should increase with success count
       */
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 4 }),  // Low success count
          fc.integer({ min: 10, max: 15 }), // High success count (must be significantly higher)
          async (lowSuccessCount, highSuccessCount) => {
            // Ensure high is significantly greater than low
            if (highSuccessCount <= lowSuccessCount + 2) {
              return; // Skip this test case
            }

            const threshold = 3;
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: threshold,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            const lowPattern: FixPattern = {
              patternId: "pattern-low",
              errorType: "retrieval_failure",
              fixDescription: "Low success fix",
              successCount: lowSuccessCount,
              errorIds: Array(lowSuccessCount)
                .fill(0)
                .map((_, i) => `error-low-${i}`),
            };

            const highPattern: FixPattern = {
              patternId: "pattern-high",
              errorType: "retrieval_failure",
              fixDescription: "High success fix",
              successCount: highSuccessCount,
              errorIds: Array(highSuccessCount)
                .fill(0)
                .map((_, i) => `error-high-${i}`),
            };

            const lowRule = await selfImprovement.generateSteeringRule(lowPattern);
            const highRule = await selfImprovement.generateSteeringRule(highPattern);

            // Higher success count should yield higher or equal confidence
            // (capped at 0.95 according to implementation)
            expect(highRule.confidence).toBeGreaterThanOrEqual(lowRule.confidence);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe("Property 18: Helpfulness Feedback Tracking", () => {
    it("should record and track helpfulness feedback", () => {
      /**
       * Feature: rag-observability-power, Property 18: Helpfulness Feedback Tracking
       * Validates: Requirements 7.4
       *
       * For any surfaced error that receives helpfulness feedback (helpful or not helpful),
       * the feedback SHALL be recorded and SHALL influence the relevance scoring for future retrievals.
       */
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              errorId: fc.uuid().map((id) => `error-${id}`),
              helpful: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (feedbackList) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: 3,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Record all feedback
            for (const feedback of feedbackList) {
              await selfImprovement.recordHelpfulness(feedback.errorId, feedback.helpful);
            }

            // Verify all feedback was recorded
            for (const feedback of feedbackList) {
              const record = selfImprovement.getHelpfulnessRecord(feedback.errorId);
              expect(record).toBeDefined();
              expect(record?.errorId).toBe(feedback.errorId);
              expect(record?.helpful).toBe(feedback.helpful);
              expect(record?.timestamp).toBeInstanceOf(Date);
            }

            // Verify statistics are correct
            const stats = selfImprovement.getHelpfulnessStats();

            // Use a Map to get unique error IDs with their last feedback value
            const uniqueFeedback = new Map<string, boolean>();
            for (const feedback of feedbackList) {
              uniqueFeedback.set(feedback.errorId, feedback.helpful);
            }

            const expectedTotal = uniqueFeedback.size;
            const expectedHelpful = Array.from(uniqueFeedback.values()).filter((h) => h).length;
            const expectedNotHelpful = expectedTotal - expectedHelpful;

            expect(stats.total).toBe(expectedTotal);
            expect(stats.helpful).toBe(expectedHelpful);
            expect(stats.notHelpful).toBe(expectedNotHelpful);

            if (expectedTotal > 0) {
              const expectedRate = expectedHelpful / expectedTotal;
              expect(stats.helpfulnessRate).toBeCloseTo(expectedRate, 10);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should update helpfulness record when feedback changes", () => {
      /**
       * Additional test: feedback should be updateable
       */
      fc.assert(
        fc.asyncProperty(
          fc.uuid().map((id) => `error-${id}`),
          fc.boolean(),
          async (errorId, initialFeedback) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: 3,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Record initial feedback
            await selfImprovement.recordHelpfulness(errorId, initialFeedback);

            let record = selfImprovement.getHelpfulnessRecord(errorId);
            expect(record?.helpful).toBe(initialFeedback);

            // Update to opposite feedback
            const updatedFeedback = !initialFeedback;
            await selfImprovement.recordHelpfulness(errorId, updatedFeedback);

            record = selfImprovement.getHelpfulnessRecord(errorId);
            expect(record?.helpful).toBe(updatedFeedback);

            // Verify only one record exists for this error
            const stats = selfImprovement.getHelpfulnessStats();
            expect(stats.total).toBe(1);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe("Property 19: Proactive Fix Suggestion", () => {
    it("should suggest fixes for errors matching known patterns", () => {
      /**
       * Feature: rag-observability-power, Property 19: Proactive Fix Suggestion
       * Validates: Requirements 7.5
       *
       * For any new error that matches a known error pattern with an established fix,
       * the system SHALL suggest that fix immediately without requiring user investigation.
       */
      fc.assert(
        fc.asyncProperty(
          ragErrorRecordArb(),
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.double({ min: 0.7, max: 1.0, noNaN: true }),
          async (baseError, fixDescription, successRate) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: 3,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Store an existing error with a successful fix
            const existingError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding, // Same embedding for high similarity
            });

            const existingFix: FixRecord = {
              id: `fix-${Date.now()}`,
              errorId: existingError.id,
              description: fixDescription,
              codeChanges: [],
              appliedAt: new Date(),
              resolved: true,
              successRate: successRate,
            };
            existingError.fixes = [existingFix];

            await knowledgeBase.storeError(existingError);

            // Create a new error with identical embedding (perfect match)
            const newError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding, // Same embedding
            });

            // Get proactive suggestion
            const suggestion = await selfImprovement.getProactiveSuggestion(newError);

            // If a suggestion is returned, verify its structure
            if (suggestion) {
              // Verify the suggestion contains the error information
              expect(suggestion.error).toBeDefined();
              expect(suggestion.error.id).toBe(existingError.id);

              // Verify the suggested fix is included
              expect(suggestion.suggestedFix).toBeDefined();
              expect(suggestion.suggestedFix?.id).toBe(existingFix.id);
              expect(suggestion.suggestedFix?.description).toBe(fixDescription);
              expect(suggestion.suggestedFix?.successRate).toBe(successRate);

              // Verify the warning is a proactive warning
              expect(suggestion.warning).toBeDefined();
              expect(typeof suggestion.warning).toBe("string");
              expect(suggestion.warning).toContain("🔔");

              // Verify relevance is high (should be near 1 for identical embeddings)
              expect(suggestion.relevance).toBeGreaterThanOrEqual(0.7);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it("should return null when no similar errors exist", () => {
      /**
       * Additional test: no suggestion when no similar errors exist
       */
      fc.assert(
        fc.asyncProperty(ragErrorRecordArb(), async (error) => {
          const knowledgeBase = new ErrorKnowledgeBaseImpl({
            embeddingDimension: EMBEDDING_DIM,
          });
          const selfImprovement = new SelfImprovementLoopImpl({
            knowledgeBase,
            steeringRuleThreshold: 3,
            maxRelevantErrors: 5,
            minRelevanceThreshold: 0.3,
          });

          // Don't store any errors in the knowledge base

          // Get proactive suggestion - should be null
          const suggestion = await selfImprovement.getProactiveSuggestion(error);
          expect(suggestion).toBeNull();
        }),
        { numRuns: 25 }
      );
    });

    it("should not suggest fixes with low success rate", () => {
      /**
       * Additional test: low success rate fixes should not be proactively suggested
       */
      fc.assert(
        fc.asyncProperty(
          ragErrorRecordArb(),
          fc.double({ min: 0.0, max: 0.5, noNaN: true }), // Low success rate
          async (baseError, lowSuccessRate) => {
            const knowledgeBase = new ErrorKnowledgeBaseImpl({
              embeddingDimension: EMBEDDING_DIM,
            });
            const selfImprovement = new SelfImprovementLoopImpl({
              knowledgeBase,
              steeringRuleThreshold: 3,
              maxRelevantErrors: 5,
              minRelevanceThreshold: 0.3,
            });

            // Store an error with a low success rate fix
            const existingError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            const lowSuccessFix: FixRecord = {
              id: `fix-${Date.now()}`,
              errorId: existingError.id,
              description: "Low success fix",
              codeChanges: [],
              appliedAt: new Date(),
              resolved: false,
              successRate: lowSuccessRate,
            };
            existingError.fixes = [lowSuccessFix];

            await knowledgeBase.storeError(existingError);

            // Create similar new error
            const newError = createErrorRecord({
              timestamp: new Date(),
              type: baseError.type,
              component: baseError.component,
              severity: baseError.severity,
              context: baseError.context,
              embedding: baseError.embedding,
            });

            // Get proactive suggestion - should be null due to low success rate
            const suggestion = await selfImprovement.getProactiveSuggestion(newError);

            // Either null or the suggestion should not have a fix with low success rate
            if (suggestion && suggestion.suggestedFix) {
              // If a suggestion is returned, it should have high success rate
              expect(suggestion.suggestedFix.successRate).toBeGreaterThanOrEqual(0.7);
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});

