/**
 * Error Knowledge Base type definitions
 */

import type { CodeChange, ErrorContext, ErrorType, Severity } from "./core.js";

// Error record stored in knowledge base
export interface ErrorRecord {
  id: string;
  timestamp: Date;
  type: ErrorType;
  component: string;
  severity: Severity;
  context: ErrorContext;
  embedding: number[];
  fixes: FixRecord[];
}

// Fix record linked to an error
export interface FixRecord {
  id: string;
  errorId: string;
  description: string;
  codeChanges: CodeChange[];
  appliedAt: Date;
  resolved: boolean;
  successRate: number; // Historical success rate of this fix pattern
}

// Similar error result from search
export interface SimilarError {
  error: ErrorRecord;
  similarity: number; // 0-1
  fixes: FixRecord[];
}

// Query for searching errors
export interface ErrorQuery {
  queryText?: string;
  queryEmbedding?: number[];
  type?: ErrorType;
  component?: string;
  severity?: Severity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// Error Knowledge Base interface
export interface ErrorKnowledgeBase {
  // Store an error with metadata
  storeError(error: ErrorRecord): Promise<string>;

  // Link a fix to an error
  linkFix(errorId: string, fix: FixRecord): Promise<void>;

  // Search for similar errors
  searchSimilar(query: ErrorQuery): Promise<SimilarError[]>;

  // Get error by ID
  getError(id: string): Promise<ErrorRecord>;

  // Update fix effectiveness
  updateFixEffectiveness(fixId: string, resolved: boolean): Promise<void>;
}
