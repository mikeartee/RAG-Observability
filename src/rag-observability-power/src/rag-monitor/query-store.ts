/**
 * Query Store - Storage interface for RAG query events
 *
 * Provides an abstraction for storing and retrieving RAG query events.
 */

import type { RAGQueryEvent, TimeWindow } from "../types/index.js";

/**
 * Interface for storing and retrieving RAG query events
 */
export interface QueryStore {
  /**
   * Store a RAG query event
   */
  store(event: RAGQueryEvent): Promise<void>;

  /**
   * Retrieve all events within a time window
   */
  getEventsInWindow(window: TimeWindow): Promise<RAGQueryEvent[]>;

  /**
   * Get a specific event by ID
   */
  getById(id: string): Promise<RAGQueryEvent | null>;

  /**
   * Get all stored events
   */
  getAll(): Promise<RAGQueryEvent[]>;

  /**
   * Clear all stored events
   */
  clear(): Promise<void>;

  /**
   * Get the count of stored events
   */
  count(): Promise<number>;
}

/**
 * In-memory implementation of QueryStore for testing and development
 */
export class InMemoryQueryStore implements QueryStore {
  private events: Map<string, RAGQueryEvent> = new Map();

  async store(event: RAGQueryEvent): Promise<void> {
    this.events.set(event.id, event);
  }

  async getEventsInWindow(window: TimeWindow): Promise<RAGQueryEvent[]> {
    const results: RAGQueryEvent[] = [];

    for (const event of this.events.values()) {
      const eventTime = event.timestamp.getTime();
      if (eventTime >= window.start.getTime() && eventTime <= window.end.getTime()) {
        results.push(event);
      }
    }

    // Sort by timestamp ascending
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getById(id: string): Promise<RAGQueryEvent | null> {
    return this.events.get(id) ?? null;
  }

  async getAll(): Promise<RAGQueryEvent[]> {
    return Array.from(this.events.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  async clear(): Promise<void> {
    this.events.clear();
  }

  async count(): Promise<number> {
    return this.events.size;
  }
}

