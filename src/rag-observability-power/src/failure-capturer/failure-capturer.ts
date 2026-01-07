/**
 * Failure Capturer Implementation
 *
 * Implements the FailureCapturer interface for capturing and replaying
 * RAG failures with full state snapshots.
 */

import { randomUUID } from "crypto";

import type {
  CapturedFailure,
  FailureCapturer,
  FailureFilters,
  RAGQueryEvent,
  ReplayResult,
  RetrievalState,
  SystemState,
} from "../types/index.js";

import type { FailureStore } from "./failure-store.js";
import { InMemoryFailureStore } from "./failure-store.js";

/**
 * Configuration for FailureCapturerImpl
 */
export interface FailureCapturerConfig {
  /**
   * Store for persisting captured failures
   */
  failureStore?: FailureStore;

  /**
   * Function to get current retrieval state
   */
  getRetrievalState?: () => RetrievalState;

  /**
   * Function to get current system state
   */
  getSystemState?: () => SystemState;

  /**
   * Function to generate embeddings for a query
   */
  generateEmbeddings?: (query: string, docs: string[]) => number[][];

  /**
   * Function to replay a query with captured state
   */
  replayFunction?: (failure: CapturedFailure) => Promise<string>;
}

/**
 * Default retrieval state when none provided
 */
const DEFAULT_RETRIEVAL_STATE: RetrievalState = {
  indexVersion: "unknown",
  embeddingModel: "unknown",
  searchParameters: {},
};

/**
 * Default system state when none provided
 */
const DEFAULT_SYSTEM_STATE: SystemState = {
  modelVersion: "unknown",
  configSnapshot: {},
  environmentVariables: {},
};

/**
 * Validates that a RAGQueryEvent represents a failure
 */
function validateFailureEvent(event: RAGQueryEvent): void {
  if (!event.id || typeof event.id !== "string") {
    throw new Error("RAGQueryEvent must have a valid id");
  }
  if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
    throw new Error("RAGQueryEvent must have a valid timestamp");
  }
  if (typeof event.query !== "string") {
    throw new Error("RAGQueryEvent must have a query string");
  }
  if (!Array.isArray(event.retrievedDocuments)) {
    throw new Error("RAGQueryEvent must have retrievedDocuments array");
  }
  if (typeof event.contextWindow !== "string") {
    throw new Error("RAGQueryEvent must have a contextWindow string");
  }
  if (typeof event.generationOutput !== "string") {
    throw new Error("RAGQueryEvent must have a generationOutput string");
  }
  if (!event.qualityMetrics) {
    throw new Error("RAGQueryEvent must have qualityMetrics");
  }
}

/**
 * Generates a unique failure ID
 */
function generateFailureId(): string {
  return `failure-${randomUUID()}`;
}

/**
 * Failure Capturer implementation
 */
export class FailureCapturerImpl implements FailureCapturer {
  private failureStore: FailureStore;
  private getRetrievalState: () => RetrievalState;
  private getSystemState: () => SystemState;
  private generateEmbeddings: (query: string, docs: string[]) => number[][];
  private replayFunction?: (failure: CapturedFailure) => Promise<string>;

  constructor(config: FailureCapturerConfig = {}) {
    this.failureStore = config.failureStore ?? new InMemoryFailureStore();
    this.getRetrievalState = config.getRetrievalState ?? (() => DEFAULT_RETRIEVAL_STATE);
    this.getSystemState = config.getSystemState ?? (() => DEFAULT_SYSTEM_STATE);
    this.generateEmbeddings = config.generateEmbeddings ?? this.defaultGenerateEmbeddings;
    this.replayFunction = config.replayFunction;
  }

  /**
   * Capture a failure with full state
   *
   * Snapshots all required state including query, embeddings, retrieved documents,
   * context window, and generation output. Generates a unique identifier for each capture.
   */
  async captureFailure(event: RAGQueryEvent): Promise<CapturedFailure> {
    validateFailureEvent(event);

    // Generate unique ID for this capture
    const id = generateFailureId();

    // Snapshot embeddings at time of failure
    const docContents = event.retrievedDocuments.map((doc) => doc.content);
    const embeddingSnapshot = this.generateEmbeddings(event.query, docContents);

    // Capture current retrieval and system state
    const retrievalState = this.getRetrievalState();
    const systemState = this.getSystemState();

    // Determine if this failure is replayable
    const replayable = this.replayFunction !== undefined;

    const capturedFailure: CapturedFailure = {
      id,
      timestamp: new Date(),
      queryEvent: event,
      embeddingSnapshot,
      retrievalState,
      systemState,
      replayable,
    };

    // Store the captured failure
    await this.failureStore.store(capturedFailure);

    return capturedFailure;
  }

  /**
   * Retrieve a captured failure by ID
   */
  async getFailure(id: string): Promise<CapturedFailure> {
    const failure = await this.failureStore.get(id);
    if (!failure) {
      throw new Error(`Failure with id '${id}' not found`);
    }
    return failure;
  }

  /**
   * Replay a failure with captured state
   *
   * Reconstructs the exact failure state from the snapshot and executes
   * the replay function to determine if the failure reproduces.
   */
  async replayFailure(id: string): Promise<ReplayResult> {
    const failure = await this.getFailure(id);

    if (!failure.replayable || !this.replayFunction) {
      return {
        failureId: id,
        reproduced: false,
        originalOutput: failure.queryEvent.generationOutput,
        replayOutput: "",
        differences: ["Failure is not replayable - no replay function configured"],
      };
    }

    try {
      // Execute replay with captured state
      const replayOutput = await this.replayFunction(failure);

      // Compare outputs to determine if failure reproduced
      const originalOutput = failure.queryEvent.generationOutput;
      const reproduced = this.compareOutputs(originalOutput, replayOutput);
      const differences = this.findDifferences(originalOutput, replayOutput);

      return {
        failureId: id,
        reproduced,
        originalOutput,
        replayOutput,
        differences,
      };
    } catch (error) {
      // If replay throws an error, the failure reproduced (it failed again)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        failureId: id,
        reproduced: true,
        originalOutput: failure.queryEvent.generationOutput,
        replayOutput: `Error during replay: ${errorMessage}`,
        differences: [`Replay threw error: ${errorMessage}`],
      };
    }
  }

  /**
   * List captured failures with filters
   */
  async listFailures(filters: FailureFilters): Promise<CapturedFailure[]> {
    return this.failureStore.list(filters);
  }

  /**
   * Get the underlying failure store (for testing)
   */
  getFailureStore(): FailureStore {
    return this.failureStore;
  }

  /**
   * Default embedding generation (placeholder)
   * In production, this would call an actual embedding model
   */
  private defaultGenerateEmbeddings(query: string, docs: string[]): number[][] {
    // Generate placeholder embeddings based on content length
    // In production, this would use an actual embedding model
    const embeddings: number[][] = [];

    // Query embedding
    embeddings.push(this.generatePlaceholderEmbedding(query));

    // Document embeddings
    for (const doc of docs) {
      embeddings.push(this.generatePlaceholderEmbedding(doc));
    }

    return embeddings;
  }

  /**
   * Generate a placeholder embedding vector
   */
  private generatePlaceholderEmbedding(text: string): number[] {
    const dimension = 1536; // Standard embedding dimension
    const embedding: number[] = [];

    // Use text characteristics to generate deterministic placeholder
    for (let i = 0; i < dimension; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      embedding.push((charCode / 255) * 2 - 1); // Normalize to [-1, 1]
    }

    return embedding;
  }

  /**
   * Compare two outputs to determine if they match
   */
  private compareOutputs(original: string, replay: string): boolean {
    // Exact match indicates the failure reproduced
    return original === replay;
  }

  /**
   * Find differences between original and replay outputs
   */
  private findDifferences(original: string, replay: string): string[] {
    const differences: string[] = [];

    if (original === replay) {
      return differences;
    }

    // Always add a general "Output differs" message first
    differences.push("Output differs");

    if (original.length !== replay.length) {
      differences.push(`Length differs: original=${original.length}, replay=${replay.length}`);
    }

    // Find first differing position
    let firstDiff = -1;
    for (let i = 0; i < Math.min(original.length, replay.length); i++) {
      if (original[i] !== replay[i]) {
        firstDiff = i;
        break;
      }
    }

    if (firstDiff >= 0) {
      const context = 20;
      const start = Math.max(0, firstDiff - context);
      const end = Math.min(Math.max(original.length, replay.length), firstDiff + context);
      differences.push(
        `First difference at position ${firstDiff}: ` +
          `original='${original.slice(start, end)}', ` +
          `replay='${replay.slice(start, end)}'`
      );
    }

    return differences;
  }
}

