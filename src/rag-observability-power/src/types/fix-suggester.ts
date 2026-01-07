/**
 * Fix Suggester type definitions
 */

import type { ErrorRecord, FixRecord } from "./error-knowledge-base.js";

// Fix suggestion with confidence
export interface FixSuggestion {
  id: string;
  originalError: ErrorRecord;
  suggestedFix: FixRecord;
  confidence: number; // 0-1
  reasoning: string;
}

// Fix Suggester interface
export interface FixSuggester {
  // Get fix suggestions for an error
  suggestFixes(error: ErrorRecord): Promise<FixSuggestion[]>;

  // Record whether a suggested fix worked
  recordOutcome(suggestionId: string, resolved: boolean): Promise<void>;
}
