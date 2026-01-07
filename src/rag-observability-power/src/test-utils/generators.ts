/**
 * Test Utilities - fast-check Generators
 *
 * Provides generators for property-based testing of RAG Observability components.
 */

import * as fc from "fast-check";

import type {
  Breadcrumb,
  CodeChange,
  CodingContext,
  ErrorContext,
  ErrorType,
  FileChange,
  QualityMetrics,
  RAGQueryEvent,
  RetrievedDocument,
  Severity,
  TimeWindow,
} from "../types/index.js";

// Error type generator
export const errorTypeArb: fc.Arbitrary<ErrorType> = fc.constantFrom(
  "retrieval_failure",
  "relevance_degradation",
  "generation_error",
  "context_overflow",
  "latency_spike",
  "embedding_error",
  "unknown"
);

// Severity generator
export const severityArb: fc.Arbitrary<Severity> = fc.constantFrom(
  "low",
  "medium",
  "high",
  "critical"
);

// Time window granularity generator
export const granularityArb = fc.constantFrom(
  "minute" as const,
  "hour" as const,
  "day" as const,
  "week" as const
);

// Date generator (within reasonable range)
export const dateArb: fc.Arbitrary<Date> = fc
  .date({
    min: new Date("2020-01-01"),
    max: new Date("2030-12-31"),
  })
  .map((d) => new Date(d.getTime()));

// Time window generator
export const timeWindowArb: fc.Arbitrary<TimeWindow> = fc
  .tuple(dateArb, dateArb, granularityArb)
  .map(([date1, date2, granularity]) => ({
    start: date1 < date2 ? date1 : date2,
    end: date1 < date2 ? date2 : date1,
    granularity,
  }));

// File change generator
export const fileChangeArb: fc.Arbitrary<FileChange> = fc.record({
  path: fc.string({ minLength: 1, maxLength: 100 }),
  changeType: fc.constantFrom("added" as const, "modified" as const, "deleted" as const),
  diff: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
});

// Breadcrumb generator
export const breadcrumbArb: fc.Arbitrary<Breadcrumb> = fc.record({
  timestamp: dateArb,
  category: fc.string({ minLength: 1, maxLength: 50 }),
  message: fc.string({ minLength: 1, maxLength: 200 }),
  data: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
});

// Error context generator
export const errorContextArb: fc.Arbitrary<ErrorContext> = fc.record({
  query: fc.string({ minLength: 1, maxLength: 500 }),
  retrievedDocs: fc.array(fc.string({ minLength: 1, maxLength: 200 }), {
    minLength: 0,
    maxLength: 10,
  }),
  generationOutput: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined }),
  stackTrace: fc.option(fc.string({ maxLength: 2000 }), { nil: undefined }),
  breadcrumbs: fc.array(breadcrumbArb, { minLength: 0, maxLength: 20 }),
});

// Code change generator
export const codeChangeArb: fc.Arbitrary<CodeChange> = fc.record({
  filePath: fc.string({ minLength: 1, maxLength: 100 }),
  oldContent: fc.string({ maxLength: 500 }),
  newContent: fc.string({ maxLength: 500 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
});

// Coding context generator
export const codingContextArb: fc.Arbitrary<CodingContext> = fc.record({
  currentFile: fc.string({ minLength: 1, maxLength: 100 }),
  recentChanges: fc.array(fileChangeArb, { minLength: 0, maxLength: 10 }),
  ragRelatedFiles: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    minLength: 0,
    maxLength: 10,
  }),
  sessionId: fc.uuid(),
});

// Quality metrics generator (with valid ranges)
export const qualityMetricsArb: fc.Arbitrary<QualityMetrics> = fc.record({
  retrievalRelevanceScore: fc.double({ min: 0, max: 1, noNaN: true }),
  generationConfidence: fc.double({ min: 0, max: 1, noNaN: true }),
  latencyMs: fc.integer({ min: 1, max: 60000 }),
  tokenCount: fc.integer({ min: 1, max: 100000 }),
});

// Retrieved document generator
export const retrievedDocumentArb: fc.Arbitrary<RetrievedDocument> = fc.record({
  id: fc.uuid(),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  score: fc.double({ min: 0, max: 1, noNaN: true }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
});

// RAG query event generator
export const ragQueryEventArb: fc.Arbitrary<RAGQueryEvent> = fc.record({
  id: fc.uuid(),
  timestamp: dateArb,
  query: fc.string({ minLength: 1, maxLength: 500 }),
  retrievedDocuments: fc.array(retrievedDocumentArb, { minLength: 0, maxLength: 10 }),
  contextWindow: fc.string({ minLength: 0, maxLength: 5000 }),
  generationOutput: fc.string({ minLength: 0, maxLength: 2000 }),
  qualityMetrics: qualityMetricsArb,
  success: fc.boolean(),
  errorDetails: fc.option(
    fc.record({
      type: errorTypeArb,
      message: fc.string({ minLength: 1, maxLength: 500 }),
      stackTrace: fc.option(fc.string({ maxLength: 2000 }), { nil: undefined }),
    }),
    { nil: undefined }
  ),
});

// Embedding vector generator (fixed dimension)
export const embeddingArb = (dimension: number = 1536): fc.Arbitrary<number[]> =>
  fc.array(fc.double({ min: -1, max: 1, noNaN: true }), {
    minLength: dimension,
    maxLength: dimension,
  });

// UUID generator
export const uuidArb: fc.Arbitrary<string> = fc.uuid();

// Non-empty string generator
export const nonEmptyStringArb = (maxLength: number = 100): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength });
