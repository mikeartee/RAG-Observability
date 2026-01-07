/**
 * Self-Improvement Loop type definitions
 */

import type { CodingContext } from "./core.js";
import type { ErrorRecord, FixRecord } from "./error-knowledge-base.js";

// Relevant error surfaced during coding
export interface RelevantError {
  error: ErrorRecord;
  relevance: number; // 0-1
  suggestedFix?: FixRecord;
  warning: string; // Human-readable warning to show in context
}

// Fix pattern for steering rule generation
export interface FixPattern {
  patternId: string;
  errorType: string;
  fixDescription: string;
  successCount: number;
  errorIds: string[];
}

// Generated steering rule
export interface SteeringRule {
  id: string;
  pattern: string;
  rule: string;
  generatedFrom: string[]; // Error IDs that led to this rule
  confidence: number;
}

// Self-Improvement Loop interface
export interface SelfImprovementLoop {
  // Get relevant errors for current coding context
  getRelevantErrors(context: CodingContext): Promise<RelevantError[]>;

  // Generate steering rule from successful fix pattern
  generateSteeringRule(pattern: FixPattern): Promise<SteeringRule>;

  // Record whether surfaced error was helpful
  recordHelpfulness(errorId: string, helpful: boolean): Promise<void>;
}
