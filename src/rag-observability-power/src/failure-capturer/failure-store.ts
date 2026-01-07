/**
 * Failure Store - Storage abstraction for captured failures
 *
 * Provides an interface for storing and retrieving captured failures.
 */

import type { CapturedFailure, FailureFilters } from "../types/index.js";

/**
 * Interface for failure storage
 */
export interface FailureStore {
  /**
   * Store a captured failure
   */
  store(failure: CapturedFailure): Promise<void>;

  /**
   * Retrieve a failure by ID
   */
  get(id: string): Promise<CapturedFailure | null>;

  /**
   * List failures matching filters
   */
  list(filters: FailureFilters): Promise<CapturedFailure[]>;

  /**
   * Get all stored failures
   */
  getAll(): Promise<CapturedFailure[]>;

  /**
   * Check if a failure exists
   */
  exists(id: string): Promise<boolean>;
}

/**
 * In-memory implementation of FailureStore for testing and development
 */
export class InMemoryFailureStore implements FailureStore {
  private failures: Map<string, CapturedFailure> = new Map();

  async store(failure: CapturedFailure): Promise<void> {
    this.failures.set(failure.id, failure);
  }

  async get(id: string): Promise<CapturedFailure | null> {
    return this.failures.get(id) ?? null;
  }

  async list(filters: FailureFilters): Promise<CapturedFailure[]> {
    let results = Array.from(this.failures.values());

    if (filters.startDate) {
      results = results.filter((f) => f.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      results = results.filter((f) => f.timestamp <= filters.endDate!);
    }

    if (filters.errorType) {
      results = results.filter(
        (f) => f.queryEvent.errorDetails?.type === filters.errorType
      );
    }

    if (filters.replayable !== undefined) {
      results = results.filter((f) => f.replayable === filters.replayable);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAll(): Promise<CapturedFailure[]> {
    return Array.from(this.failures.values());
  }

  async exists(id: string): Promise<boolean> {
    return this.failures.has(id);
  }

  /**
   * Clear all stored failures (for testing)
   */
  clear(): void {
    this.failures.clear();
  }
}

