/**
 * Error Knowledge Base Implementation
 *
 * Implements the ErrorKnowledgeBase interface for storing errors with
 * structured metadata, generating embeddings for semantic search,
 * and linking fixes to errors.
 */

import { randomUUID } from "crypto";

import type {
  ErrorKnowledgeBase,
  ErrorQuery,
  ErrorRecord,
  FixRecord,
  SimilarError,
} from "../types/index.js";
import type { VectorDBClient, VectorRecord } from "../config/vector-db.js";
import { InMemoryVectorDB } from "../config/vector-db.js";

import type { ErrorStore } from "./error-store.js";
import { InMemoryErrorStore } from "./error-store.js";

/**
 * Configuration for ErrorKnowledgeBaseImpl
 */
export interface ErrorKnowledgeBaseConfig {
  /**
   * Store for persisting error records
   */
  errorStore?: ErrorStore;

  /**
   * Vector database client for embeddings
   */
  vectorDB?: VectorDBClient;

  /**
   * Function to generate embeddings for error context
   */
  generateEmbedding?: (text: string) => number[];

  /**
   * Expected embedding dimension
   */
  embeddingDimension?: number;
}

/**
 * Default embedding dimension (OpenAI standard)
 */
const DEFAULT_EMBEDDING_DIMENSION = 1536;

/**
 * Validates that an ErrorRecord has all required fields
 */
function validateErrorRecord(error: ErrorRecord): void {
  if (!error.id || typeof error.id !== "string") {
    throw new Error("ErrorRecord must have a valid id");
  }
  if (!(error.timestamp instanceof Date) || isNaN(error.timestamp.getTime())) {
    throw new Error("ErrorRecord must have a valid timestamp");
  }
  if (!error.type) {
    throw new Error("ErrorRecord must have a type");
  }
  if (!error.component || typeof error.component !== "string") {
    throw new Error("ErrorRecord must have a component");
  }
  if (!error.severity) {
    throw new Error("ErrorRecord must have a severity");
  }
  if (!error.context) {
    throw new Error("ErrorRecord must have a context");
  }
  if (!error.context.query || typeof error.context.query !== "string") {
    throw new Error("ErrorRecord context must have a query");
  }
  if (!Array.isArray(error.context.retrievedDocs)) {
    throw new Error("ErrorRecord context must have retrievedDocs array");
  }
  if (!Array.isArray(error.context.breadcrumbs)) {
    throw new Error("ErrorRecord context must have breadcrumbs array");
  }
}

/**
 * Validates that an embedding has the correct dimension
 */
function validateEmbedding(embedding: number[], expectedDimension: number): void {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }
  if (embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`
    );
  }
  for (const value of embedding) {
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error("Embedding must contain only valid numbers");
    }
  }
}

/**
 * Validates that a FixRecord has all required fields
 */
function validateFixRecord(fix: FixRecord): void {
  if (!fix.id || typeof fix.id !== "string") {
    throw new Error("FixRecord must have a valid id");
  }
  if (!fix.errorId || typeof fix.errorId !== "string") {
    throw new Error("FixRecord must have a valid errorId");
  }
  if (!fix.description || typeof fix.description !== "string") {
    throw new Error("FixRecord must have a description");
  }
  if (!Array.isArray(fix.codeChanges)) {
    throw new Error("FixRecord must have codeChanges array");
  }
  if (!(fix.appliedAt instanceof Date) || isNaN(fix.appliedAt.getTime())) {
    throw new Error("FixRecord must have a valid appliedAt date");
  }
  if (typeof fix.resolved !== "boolean") {
    throw new Error("FixRecord must have a resolved boolean");
  }
  if (typeof fix.successRate !== "number" || isNaN(fix.successRate)) {
    throw new Error("FixRecord must have a valid successRate");
  }
}

/**
 * Generates a unique error ID
 */
function generateErrorId(): string {
  return `error-${randomUUID()}`;
}

/**
 * Error Knowledge Base implementation
 */
export class ErrorKnowledgeBaseImpl implements ErrorKnowledgeBase {
  private errorStore: ErrorStore;
  private vectorDB: VectorDBClient;
  private generateEmbedding: (text: string) => number[];
  private embeddingDimension: number;

  constructor(config: ErrorKnowledgeBaseConfig = {}) {
    this.errorStore = config.errorStore ?? new InMemoryErrorStore();
    this.vectorDB = config.vectorDB ?? new InMemoryVectorDB();
    this.embeddingDimension = config.embeddingDimension ?? DEFAULT_EMBEDDING_DIMENSION;
    this.generateEmbedding = config.generateEmbedding ?? this.defaultGenerateEmbedding.bind(this);
  }

  /**
   * Store an error with metadata
   *
   * Stores the error with structured metadata and generates embeddings
   * for semantic search. Returns the error ID.
   */
  async storeError(error: ErrorRecord): Promise<string> {
    // Validate the error record
    validateErrorRecord(error);

    // Generate embedding if not provided
    if (!error.embedding || error.embedding.length === 0) {
      const textForEmbedding = this.buildEmbeddingText(error);
      error.embedding = this.generateEmbedding(textForEmbedding);
    }

    // Validate embedding dimension
    validateEmbedding(error.embedding, this.embeddingDimension);

    // Ensure fixes array exists
    if (!error.fixes) {
      error.fixes = [];
    }

    // Store in error store
    await this.errorStore.store(error);

    // Store embedding in vector DB
    const vectorRecord: VectorRecord = {
      id: error.id,
      values: error.embedding,
      metadata: {
        type: error.type,
        component: error.component,
        severity: error.severity,
        timestamp: error.timestamp.toISOString(),
      },
    };
    await this.vectorDB.upsert([vectorRecord]);

    return error.id;
  }

  /**
   * Link a fix to an error
   *
   * Maintains bidirectional references between errors and fixes.
   */
  async linkFix(errorId: string, fix: FixRecord): Promise<void> {
    // Validate fix record
    validateFixRecord(fix);

    // Ensure fix references the correct error
    if (fix.errorId !== errorId) {
      throw new Error(`Fix errorId '${fix.errorId}' does not match provided errorId '${errorId}'`);
    }

    // Get the error
    const error = await this.errorStore.get(errorId);
    if (!error) {
      throw new Error(`Error with id '${errorId}' not found`);
    }

    // Check if fix already exists
    const existingFixIndex = error.fixes.findIndex((f) => f.id === fix.id);
    if (existingFixIndex >= 0) {
      // Update existing fix
      error.fixes[existingFixIndex] = fix;
    } else {
      // Add new fix
      error.fixes.push(fix);
    }

    // Update the error record
    await this.errorStore.update(error);
  }

  /**
   * Search for similar errors
   *
   * Uses vector similarity to find errors similar to the query.
   * Returns results ordered by similarity score.
   */
  async searchSimilar(query: ErrorQuery): Promise<SimilarError[]> {
    const limit = query.limit ?? 10;

    // Build filter for vector search
    const filter: Record<string, string | number | boolean> = {};
    if (query.type) {
      filter.type = query.type;
    }
    if (query.component) {
      filter.component = query.component;
    }
    if (query.severity) {
      filter.severity = query.severity;
    }

    // Get query embedding
    let queryEmbedding: number[];
    if (query.queryEmbedding && query.queryEmbedding.length > 0) {
      queryEmbedding = query.queryEmbedding;
    } else if (query.queryText) {
      queryEmbedding = this.generateEmbedding(query.queryText);
    } else {
      // No query provided, return empty results
      return [];
    }

    // Search vector DB
    const vectorResults = await this.vectorDB.search(
      queryEmbedding,
      limit * 2, // Fetch more to account for date filtering
      Object.keys(filter).length > 0 ? filter : undefined
    );

    // Get full error records and apply date filters
    const results: SimilarError[] = [];
    for (const vectorResult of vectorResults) {
      const error = await this.errorStore.get(vectorResult.id);
      if (!error) continue;

      // Apply date filters
      if (query.startDate && error.timestamp < query.startDate) continue;
      if (query.endDate && error.timestamp > query.endDate) continue;

      results.push({
        error,
        similarity: vectorResult.score,
        fixes: error.fixes,
      });

      if (results.length >= limit) break;
    }

    // Results are already sorted by similarity from vector DB
    return results;
  }

  /**
   * Get error by ID
   */
  async getError(id: string): Promise<ErrorRecord> {
    const error = await this.errorStore.get(id);
    if (!error) {
      throw new Error(`Error with id '${id}' not found`);
    }
    return error;
  }

  /**
   * Update fix effectiveness
   *
   * Updates the fix's success rate based on whether it resolved the issue.
   */
  async updateFixEffectiveness(fixId: string, resolved: boolean): Promise<void> {
    // Find the error containing this fix
    const allErrors = await this.errorStore.getAll();
    let targetError: ErrorRecord | null = null;
    let targetFixIndex = -1;

    for (const error of allErrors) {
      const fixIndex = error.fixes.findIndex((f) => f.id === fixId);
      if (fixIndex >= 0) {
        targetError = error;
        targetFixIndex = fixIndex;
        break;
      }
    }

    if (!targetError || targetFixIndex < 0) {
      throw new Error(`Fix with id '${fixId}' not found`);
    }

    // Update the fix's success rate
    const fix = targetError.fixes[targetFixIndex];
    const totalAttempts = Math.round(1 / (fix.successRate || 0.5)) || 1;
    const successCount = Math.round(totalAttempts * (fix.successRate || 0.5));
    const newSuccessCount = resolved ? successCount + 1 : successCount;
    const newTotalAttempts = totalAttempts + 1;
    fix.successRate = newSuccessCount / newTotalAttempts;
    fix.resolved = resolved;

    // Update the error record
    await this.errorStore.update(targetError);
  }

  /**
   * Query errors with filters (for filter queries requirement)
   *
   * Supports filtering by type, component, time range, severity.
   * Combines filters with AND logic.
   */
  async queryErrors(filters: ErrorQuery): Promise<ErrorRecord[]> {
    return this.errorStore.query(filters);
  }

  /**
   * Get the underlying error store (for testing)
   */
  getErrorStore(): ErrorStore {
    return this.errorStore;
  }

  /**
   * Get the underlying vector DB (for testing)
   */
  getVectorDB(): VectorDBClient {
    return this.vectorDB;
  }

  /**
   * Build text for embedding generation from error record
   */
  private buildEmbeddingText(error: ErrorRecord): string {
    const parts: string[] = [
      `Error type: ${error.type}`,
      `Component: ${error.component}`,
      `Severity: ${error.severity}`,
      `Query: ${error.context.query}`,
    ];

    if (error.context.generationOutput) {
      parts.push(`Output: ${error.context.generationOutput}`);
    }

    if (error.context.stackTrace) {
      parts.push(`Stack: ${error.context.stackTrace}`);
    }

    if (error.context.retrievedDocs.length > 0) {
      parts.push(`Docs: ${error.context.retrievedDocs.join(", ")}`);
    }

    return parts.join("\n");
  }

  /**
   * Default embedding generation (placeholder)
   * In production, this would call an actual embedding model
   */
  private defaultGenerateEmbedding(text: string): number[] {
    const embedding: number[] = [];

    // Use text characteristics to generate deterministic placeholder
    for (let i = 0; i < this.embeddingDimension; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      embedding.push((charCode / 255) * 2 - 1); // Normalize to [-1, 1]
    }

    return embedding;
  }
}

/**
 * Create an ErrorRecord with a generated ID
 */
export function createErrorRecord(
  partial: Omit<ErrorRecord, "id" | "fixes"> & { id?: string; fixes?: FixRecord[] }
): ErrorRecord {
  return {
    id: partial.id ?? generateErrorId(),
    timestamp: partial.timestamp,
    type: partial.type,
    component: partial.component,
    severity: partial.severity,
    context: partial.context,
    embedding: partial.embedding,
    fixes: partial.fixes ?? [],
  };
}

/**
 * Create a FixRecord with a generated ID
 */
export function createFixRecord(
  partial: Omit<FixRecord, "id"> & { id?: string }
): FixRecord {
  return {
    id: partial.id ?? `fix-${randomUUID()}`,
    errorId: partial.errorId,
    description: partial.description,
    codeChanges: partial.codeChanges,
    appliedAt: partial.appliedAt,
    resolved: partial.resolved,
    successRate: partial.successRate,
  };
}

