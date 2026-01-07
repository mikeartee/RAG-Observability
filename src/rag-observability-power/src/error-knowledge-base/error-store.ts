/**
 * Error Store - Storage abstraction for error records
 *
 * Provides an interface for storing and retrieving error records.
 */

import type { ErrorRecord, ErrorQuery, FixRecord } from "../types/index.js";

/**
 * Interface for error storage
 */
export interface ErrorStore {
  /**
   * Store an error record
   */
  store(error: ErrorRecord): Promise<void>;

  /**
   * Retrieve an error by ID
   */
  get(id: string): Promise<ErrorRecord | null>;

  /**
   * Get all stored errors
   */
  getAll(): Promise<ErrorRecord[]>;

  /**
   * Check if an error exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Update an error record
   */
  update(error: ErrorRecord): Promise<void>;

  /**
   * Query errors with filters
   */
  query(filters: ErrorQuery): Promise<ErrorRecord[]>;

  /**
   * Clear all stored errors (for testing)
   */
  clear(): void;
}

/**
 * In-memory implementation of ErrorStore for testing and development
 */
export class InMemoryErrorStore implements ErrorStore {
  private errors: Map<string, ErrorRecord> = new Map();

  async store(error: ErrorRecord): Promise<void> {
    this.errors.set(error.id, error);
  }

  async get(id: string): Promise<ErrorRecord | null> {
    return this.errors.get(id) ?? null;
  }

  async getAll(): Promise<ErrorRecord[]> {
    return Array.from(this.errors.values());
  }

  async exists(id: string): Promise<boolean> {
    return this.errors.has(id);
  }

  async update(error: ErrorRecord): Promise<void> {
    if (!this.errors.has(error.id)) {
      throw new Error(`Error with id '${error.id}' not found`);
    }
    this.errors.set(error.id, error);
  }

  async query(filters: ErrorQuery): Promise<ErrorRecord[]> {
    let results = Array.from(this.errors.values());

    // Filter by type
    if (filters.type) {
      results = results.filter((e) => e.type === filters.type);
    }

    // Filter by component
    if (filters.component) {
      results = results.filter((e) => e.component === filters.component);
    }

    // Filter by severity
    if (filters.severity) {
      results = results.filter((e) => e.severity === filters.severity);
    }

    // Filter by start date
    if (filters.startDate) {
      results = results.filter((e) => e.timestamp >= filters.startDate!);
    }

    // Filter by end date
    if (filters.endDate) {
      results = results.filter((e) => e.timestamp <= filters.endDate!);
    }

    // Sort by timestamp descending (most recent first)
    results = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  clear(): void {
    this.errors.clear();
  }

  /**
   * Get the count of stored errors
   */
  size(): number {
    return this.errors.size;
  }
}

