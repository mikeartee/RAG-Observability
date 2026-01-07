/**
 * Fix Suggester Implementation
 *
 * Implements the FixSuggester interface for querying the knowledge base
 * for similar errors and ranking fixes by relevance and success rate.
 */

import { randomUUID } from "crypto";

import type {
  ErrorKnowledgeBase,
  ErrorRecord,
  FixSuggester,
  FixSuggestion,
} from "../types/index.js";

/**
 * Configuration for FixSuggesterImpl
 */
export interface FixSuggesterConfig {
  /**
   * Error Knowledge Base for querying similar errors
   */
  knowledgeBase: ErrorKnowledgeBase;

  /**
   * Maximum number of similar errors to consider
   */
  maxSimilarErrors?: number;

  /**
   * Minimum similarity threshold for considering an error (0-1)
   */
  minSimilarityThreshold?: number;

  /**
   * Weight for similarity score in ranking (0-1)
   */
  similarityWeight?: number;

  /**
   * Weight for success rate in ranking (0-1)
   */
  successRateWeight?: number;

  /**
   * Callback for logging novel error patterns (when no similar errors exist)
   */
  onNovelErrorPattern?: (error: ErrorRecord) => void;
}

/**
 * Default configuration values
 */
const DEFAULT_MAX_SIMILAR_ERRORS = 10;
const DEFAULT_MIN_SIMILARITY_THRESHOLD = 0.3;
const DEFAULT_SIMILARITY_WEIGHT = 0.6;
const DEFAULT_SUCCESS_RATE_WEIGHT = 0.4;

/**
 * Store for tracking suggestion outcomes
 */
interface SuggestionRecord {
  id: string;
  fixId: string;
  errorId: string;
  timestamp: Date;
  resolved?: boolean;
}

/**
 * Fix Suggester implementation
 *
 * Queries the knowledge base for similar errors and ranks fixes
 * by a combination of relevance (similarity) and success rate.
 */
export class FixSuggesterImpl implements FixSuggester {
  private knowledgeBase: ErrorKnowledgeBase;
  private maxSimilarErrors: number;
  private minSimilarityThreshold: number;
  private similarityWeight: number;
  private successRateWeight: number;
  private suggestions: Map<string, SuggestionRecord> = new Map();
  private novelErrorPatterns: ErrorRecord[] = [];
  private onNovelErrorPattern?: (error: ErrorRecord) => void;

  constructor(config: FixSuggesterConfig) {
    this.knowledgeBase = config.knowledgeBase;
    this.maxSimilarErrors = config.maxSimilarErrors ?? DEFAULT_MAX_SIMILAR_ERRORS;
    this.minSimilarityThreshold = config.minSimilarityThreshold ?? DEFAULT_MIN_SIMILARITY_THRESHOLD;
    this.similarityWeight = config.similarityWeight ?? DEFAULT_SIMILARITY_WEIGHT;
    this.successRateWeight = config.successRateWeight ?? DEFAULT_SUCCESS_RATE_WEIGHT;
    this.onNovelErrorPattern = config.onNovelErrorPattern;

    // Normalize weights
    const totalWeight = this.similarityWeight + this.successRateWeight;
    this.similarityWeight = this.similarityWeight / totalWeight;
    this.successRateWeight = this.successRateWeight / totalWeight;
  }

  /**
   * Get fix suggestions for an error
   *
   * Queries the knowledge base for similar past errors and ranks
   * their fixes by relevance and success rate.
   *
   * If no similar errors exist, logs the novel error pattern and returns
   * an empty array (Requirements: 5.1, 5.2, 5.3, 5.4).
   */
  async suggestFixes(error: ErrorRecord): Promise<FixSuggestion[]> {
    // Query knowledge base for similar errors
    const similarErrors = await this.knowledgeBase.searchSimilar({
      queryText: this.buildQueryText(error),
      queryEmbedding: error.embedding,
      type: error.type,
      limit: this.maxSimilarErrors,
    });

    // Filter by minimum similarity threshold
    const relevantErrors = similarErrors.filter(
      (se) => se.similarity >= this.minSimilarityThreshold
    );

    // Collect all fixes from similar errors with their context
    const fixCandidates: Array<{
      fix: import("../types/index.js").FixRecord;
      originalError: ErrorRecord;
      similarity: number;
    }> = [];

    for (const similarError of relevantErrors) {
      for (const fix of similarError.fixes) {
        fixCandidates.push({
          fix,
          originalError: similarError.error,
          similarity: similarError.similarity,
        });
      }
    }

    // Handle no-similar-errors case (Requirement 5.4)
    if (fixCandidates.length === 0) {
      this.logNovelErrorPattern(error);
      return [];
    }

    // Rank fixes by combined score (similarity + success rate)
    const rankedFixes = this.rankFixes(fixCandidates);

    // Convert to FixSuggestion format with complete information (Requirement 5.3)
    const suggestions: FixSuggestion[] = rankedFixes.map((candidate) => {
      const suggestionId = `suggestion-${randomUUID()}`;

      // Store suggestion for outcome tracking
      this.suggestions.set(suggestionId, {
        id: suggestionId,
        fixId: candidate.fix.id,
        errorId: error.id,
        timestamp: new Date(),
      });

      return this.createCompleteSuggestion(suggestionId, candidate);
    });

    return suggestions;
  }

  /**
   * Create a complete fix suggestion with all required information
   *
   * Ensures suggestions include error context, fix, and outcome (Requirement 5.3)
   */
  private createCompleteSuggestion(
    suggestionId: string,
    candidate: {
      fix: import("../types/index.js").FixRecord;
      originalError: ErrorRecord;
      similarity: number;
      score: number;
    }
  ): FixSuggestion {
    return {
      id: suggestionId,
      originalError: candidate.originalError,
      suggestedFix: candidate.fix,
      confidence: candidate.score,
      reasoning: this.generateReasoning(candidate),
    };
  }

  /**
   * Log a novel error pattern when no similar errors exist
   *
   * Requirement 5.4: IF no similar errors exist, THEN THE Fix_Suggester
   * SHALL indicate no suggestions available and log the novel error pattern.
   */
  private logNovelErrorPattern(error: ErrorRecord): void {
    this.novelErrorPatterns.push(error);

    // Call the callback if provided
    if (this.onNovelErrorPattern) {
      this.onNovelErrorPattern(error);
    }
  }

  /**
   * Check if suggestions are available for an error
   *
   * Returns true if there are similar errors with fixes in the knowledge base.
   */
  async hasSuggestions(error: ErrorRecord): Promise<boolean> {
    const suggestions = await this.suggestFixes(error);
    return suggestions.length > 0;
  }

  /**
   * Get logged novel error patterns (for testing and monitoring)
   */
  getNovelErrorPatterns(): ErrorRecord[] {
    return [...this.novelErrorPatterns];
  }

  /**
   * Clear logged novel error patterns (for testing)
   */
  clearNovelErrorPatterns(): void {
    this.novelErrorPatterns = [];
  }

  /**
   * Record whether a suggested fix worked
   *
   * Updates the fix's success rate based on the outcome.
   *
   * Requirements: 5.5
   */
  async recordOutcome(suggestionId: string, resolved: boolean): Promise<void> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion with id '${suggestionId}' not found`);
    }

    // Update the suggestion record
    suggestion.resolved = resolved;

    // Update fix effectiveness in knowledge base
    await this.knowledgeBase.updateFixEffectiveness(suggestion.fixId, resolved);
  }

  /**
   * Build query text from error record for similarity search
   */
  private buildQueryText(error: ErrorRecord): string {
    const parts: string[] = [
      `Error type: ${error.type}`,
      `Component: ${error.component}`,
      `Query: ${error.context.query}`,
    ];

    if (error.context.generationOutput) {
      parts.push(`Output: ${error.context.generationOutput}`);
    }

    if (error.context.stackTrace) {
      parts.push(`Stack: ${error.context.stackTrace}`);
    }

    return parts.join("\n");
  }

  /**
   * Rank fixes by combined similarity and success rate score
   *
   * Fixes are ordered by a weighted combination of:
   * - Similarity score (how similar the original error is)
   * - Success rate (historical effectiveness of the fix)
   *
   * Among equally relevant fixes, higher success rates rank higher.
   */
  private rankFixes(
    candidates: Array<{
      fix: import("../types/index.js").FixRecord;
      originalError: ErrorRecord;
      similarity: number;
    }>
  ): Array<{
    fix: import("../types/index.js").FixRecord;
    originalError: ErrorRecord;
    similarity: number;
    score: number;
  }> {
    // Calculate combined score for each candidate
    const scored = candidates.map((candidate) => ({
      ...candidate,
      score:
        this.similarityWeight * candidate.similarity +
        this.successRateWeight * candidate.fix.successRate,
    }));

    // Sort by combined score (descending)
    // For equal scores, prefer higher success rate
    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 0.001) {
        return b.fix.successRate - a.fix.successRate;
      }
      return scoreDiff;
    });

    return scored;
  }

  /**
   * Generate human-readable reasoning for a fix suggestion
   */
  private generateReasoning(candidate: {
    fix: import("../types/index.js").FixRecord;
    originalError: ErrorRecord;
    similarity: number;
    score: number;
  }): string {
    const similarityPercent = Math.round(candidate.similarity * 100);
    const successPercent = Math.round(candidate.fix.successRate * 100);

    return (
      `This fix was applied to a similar ${candidate.originalError.type} error ` +
      `(${similarityPercent}% similarity) in the ${candidate.originalError.component} component. ` +
      `It has a ${successPercent}% historical success rate.`
    );
  }

  /**
   * Get a suggestion record by ID (for testing)
   */
  getSuggestion(suggestionId: string): SuggestionRecord | undefined {
    return this.suggestions.get(suggestionId);
  }

  /**
   * Clear all suggestion records (for testing)
   */
  clearSuggestions(): void {
    this.suggestions.clear();
  }

  /**
   * Get outcome statistics for all recorded suggestions
   *
   * Returns statistics about how many suggestions were resolved vs not resolved.
   */
  getOutcomeStatistics(): {
    total: number;
    resolved: number;
    notResolved: number;
    pending: number;
    resolutionRate: number;
  } {
    let resolved = 0;
    let notResolved = 0;
    let pending = 0;

    for (const suggestion of this.suggestions.values()) {
      if (suggestion.resolved === undefined) {
        pending++;
      } else if (suggestion.resolved) {
        resolved++;
      } else {
        notResolved++;
      }
    }

    const total = this.suggestions.size;
    const completedTotal = resolved + notResolved;
    const resolutionRate = completedTotal > 0 ? resolved / completedTotal : 0;

    return {
      total,
      resolved,
      notResolved,
      pending,
      resolutionRate,
    };
  }

  /**
   * Get all suggestions with their outcomes (for testing and monitoring)
   */
  getAllSuggestions(): SuggestionRecord[] {
    return Array.from(this.suggestions.values());
  }
}

