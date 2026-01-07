/**
 * Self-Improvement Loop Implementation
 *
 * Implements the SelfImprovementLoop interface for surfacing relevant errors
 * during coding sessions, generating steering rules from successful fix patterns,
 * and tracking helpfulness feedback.
 */

import { randomUUID } from "crypto";

import type {
  CodingContext,
  ErrorKnowledgeBase,
  ErrorRecord,
  FixRecord,
  FixPattern,
  RelevantError,
  SelfImprovementLoop,
  SteeringRule,
} from "../types/index.js";

/**
 * Configuration for SelfImprovementLoopImpl
 */
export interface SelfImprovementLoopConfig {
  /**
   * Error Knowledge Base for querying errors
   */
  knowledgeBase: ErrorKnowledgeBase;

  /**
   * Minimum success count to trigger steering rule generation
   */
  steeringRuleThreshold?: number;

  /**
   * Maximum number of relevant errors to return
   */
  maxRelevantErrors?: number;

  /**
   * Minimum relevance score to include an error (0-1)
   */
  minRelevanceThreshold?: number;

  /**
   * RAG-related file patterns for identifying relevant files
   */
  ragFilePatterns?: string[];
}

/**
 * Default configuration values
 */
const DEFAULT_STEERING_RULE_THRESHOLD = 3;
const DEFAULT_MAX_RELEVANT_ERRORS = 5;
const DEFAULT_MIN_RELEVANCE_THRESHOLD = 0.3;
const DEFAULT_RAG_FILE_PATTERNS = [
  "retrieval",
  "embedding",
  "chunk",
  "vector",
  "rag",
  "llm",
  "generation",
  "prompt",
  "context",
  "index",
];

/**
 * Helpfulness record for tracking feedback
 */
interface HelpfulnessRecord {
  errorId: string;
  helpful: boolean;
  timestamp: Date;
  sessionId?: string;
}

/**
 * Steering rule store entry
 */
interface SteeringRuleEntry extends SteeringRule {
  createdAt: Date;
  active: boolean;
}

/**
 * Self-Improvement Loop implementation
 *
 * Integrates with coding sessions to surface relevant errors and
 * auto-generate steering rules from successful fix patterns.
 */
export class SelfImprovementLoopImpl implements SelfImprovementLoop {
  private knowledgeBase: ErrorKnowledgeBase;
  private steeringRuleThreshold: number;
  private maxRelevantErrors: number;
  private minRelevanceThreshold: number;
  private ragFilePatterns: string[];
  private helpfulnessRecords: Map<string, HelpfulnessRecord> = new Map();
  private steeringRules: Map<string, SteeringRuleEntry> = new Map();
  private fixPatternSuccessCounts: Map<string, number> = new Map();

  constructor(config: SelfImprovementLoopConfig) {
    this.knowledgeBase = config.knowledgeBase;
    this.steeringRuleThreshold = config.steeringRuleThreshold ?? DEFAULT_STEERING_RULE_THRESHOLD;
    this.maxRelevantErrors = config.maxRelevantErrors ?? DEFAULT_MAX_RELEVANT_ERRORS;
    this.minRelevanceThreshold = config.minRelevanceThreshold ?? DEFAULT_MIN_RELEVANCE_THRESHOLD;
    this.ragFilePatterns = config.ragFilePatterns ?? DEFAULT_RAG_FILE_PATTERNS;
  }

  /**
   * Get relevant errors for current coding context
   *
   * Identifies RAG-related files in the coding context and retrieves
   * relevant past errors from the Error Knowledge Base.
   *
   * Requirements: 7.1, 7.2
   */
  async getRelevantErrors(context: CodingContext): Promise<RelevantError[]> {
    // Identify RAG-related files in the context
    const ragFiles = this.identifyRagRelatedFiles(context);

    // If no RAG-related files, return empty
    if (ragFiles.length === 0) {
      return [];
    }

    // Build query text from context
    const queryText = this.buildContextQueryText(context, ragFiles);

    // Search for similar errors
    const similarErrors = await this.knowledgeBase.searchSimilar({
      queryText,
      limit: this.maxRelevantErrors * 2, // Fetch more to filter
    });

    // Filter by relevance threshold and convert to RelevantError
    const relevantErrors: RelevantError[] = [];

    for (const similarError of similarErrors) {
      if (similarError.similarity < this.minRelevanceThreshold) {
        continue;
      }

      // Check if error is related to the RAG files in context
      const errorRelevance = this.calculateErrorRelevance(
        similarError.error,
        ragFiles,
        similarError.similarity
      );

      if (errorRelevance < this.minRelevanceThreshold) {
        continue;
      }

      // Find the best fix for this error
      const suggestedFix = this.selectBestFix(similarError.error.fixes);

      // Generate warning message
      const warning = this.generateWarningMessage(similarError.error, suggestedFix);

      relevantErrors.push({
        error: similarError.error,
        relevance: errorRelevance,
        suggestedFix,
        warning,
      });

      if (relevantErrors.length >= this.maxRelevantErrors) {
        break;
      }
    }

    // Sort by relevance (descending)
    relevantErrors.sort((a, b) => b.relevance - a.relevance);

    return relevantErrors;
  }

  /**
   * Generate steering rule from successful fix pattern
   *
   * Triggers when a fix pattern has been successful at least N times.
   * Generates a rule referencing the contributing errors.
   *
   * Requirements: 7.3
   */
  async generateSteeringRule(pattern: FixPattern): Promise<SteeringRule> {
    // Validate pattern has enough successes
    if (pattern.successCount < this.steeringRuleThreshold) {
      throw new Error(
        `Fix pattern has ${pattern.successCount} successes, ` +
          `but threshold is ${this.steeringRuleThreshold}`
      );
    }

    // Generate rule ID
    const ruleId = `rule-${randomUUID()}`;

    // Generate rule content based on pattern
    const ruleContent = this.generateRuleContent(pattern);

    // Calculate confidence based on success count
    const confidence = Math.min(0.95, 0.5 + pattern.successCount * 0.1);

    const steeringRule: SteeringRule = {
      id: ruleId,
      pattern: pattern.fixDescription,
      rule: ruleContent,
      generatedFrom: pattern.errorIds,
      confidence,
    };

    // Store the rule
    this.steeringRules.set(ruleId, {
      ...steeringRule,
      createdAt: new Date(),
      active: true,
    });

    return steeringRule;
  }

  /**
   * Record whether surfaced error was helpful
   *
   * Tracks which surfaced errors were helpful to influence
   * future retrieval relevance.
   *
   * Requirements: 7.4
   */
  async recordHelpfulness(errorId: string, helpful: boolean): Promise<void> {
    const record: HelpfulnessRecord = {
      errorId,
      helpful,
      timestamp: new Date(),
    };

    this.helpfulnessRecords.set(errorId, record);

    // Update internal relevance scoring based on feedback
    // Helpful errors should be surfaced more often
    // Not helpful errors should be surfaced less often
    this.updateRelevanceScoring(errorId, helpful);
  }

  /**
   * Get proactive fix suggestion for a new error
   *
   * Detects when new errors match known patterns and suggests
   * established fixes immediately.
   *
   * Requirements: 7.5
   */
  async getProactiveSuggestion(error: ErrorRecord): Promise<RelevantError | null> {
    // Search for similar errors with successful fixes
    const similarErrors = await this.knowledgeBase.searchSimilar({
      queryText: this.buildErrorQueryText(error),
      queryEmbedding: error.embedding,
      type: error.type,
      limit: 5,
    });

    // Find errors with successful fixes
    for (const similarError of similarErrors) {
      if (similarError.similarity < 0.7) {
        continue; // Require high similarity for proactive suggestions
      }

      // Find successful fixes
      const successfulFixes = similarError.error.fixes.filter(
        (fix) => fix.resolved && fix.successRate >= 0.7
      );

      if (successfulFixes.length > 0) {
        const bestFix = this.selectBestFix(successfulFixes);
        const warning = this.generateProactiveWarning(similarError.error, bestFix);

        return {
          error: similarError.error,
          relevance: similarError.similarity,
          suggestedFix: bestFix,
          warning,
        };
      }
    }

    return null;
  }

  /**
   * Track fix pattern success
   *
   * Called when a fix is successfully applied to track patterns
   * for steering rule generation.
   */
  trackFixSuccess(pattern: FixPattern): void {
    const currentCount = this.fixPatternSuccessCounts.get(pattern.patternId) ?? 0;
    this.fixPatternSuccessCounts.set(pattern.patternId, currentCount + 1);
  }

  /**
   * Check if a fix pattern should trigger steering rule generation
   */
  shouldGenerateSteeringRule(patternId: string): boolean {
    const count = this.fixPatternSuccessCounts.get(patternId) ?? 0;
    return count >= this.steeringRuleThreshold;
  }

  /**
   * Get all generated steering rules
   */
  getSteeringRules(): SteeringRule[] {
    return Array.from(this.steeringRules.values()).map((entry) => ({
      id: entry.id,
      pattern: entry.pattern,
      rule: entry.rule,
      generatedFrom: entry.generatedFrom,
      confidence: entry.confidence,
    }));
  }

  /**
   * Get active steering rules
   */
  getActiveSteeringRules(): SteeringRule[] {
    return Array.from(this.steeringRules.values())
      .filter((entry) => entry.active)
      .map((entry) => ({
        id: entry.id,
        pattern: entry.pattern,
        rule: entry.rule,
        generatedFrom: entry.generatedFrom,
        confidence: entry.confidence,
      }));
  }

  /**
   * Deactivate a steering rule
   */
  deactivateRule(ruleId: string): void {
    const rule = this.steeringRules.get(ruleId);
    if (rule) {
      rule.active = false;
    }
  }

  /**
   * Get helpfulness statistics
   */
  getHelpfulnessStats(): {
    total: number;
    helpful: number;
    notHelpful: number;
    helpfulnessRate: number;
  } {
    let helpful = 0;
    let notHelpful = 0;

    for (const record of this.helpfulnessRecords.values()) {
      if (record.helpful) {
        helpful++;
      } else {
        notHelpful++;
      }
    }

    const total = helpful + notHelpful;
    const helpfulnessRate = total > 0 ? helpful / total : 0;

    return { total, helpful, notHelpful, helpfulnessRate };
  }

  /**
   * Get helpfulness record for an error
   */
  getHelpfulnessRecord(errorId: string): HelpfulnessRecord | undefined {
    return this.helpfulnessRecords.get(errorId);
  }

  /**
   * Clear all helpfulness records (for testing)
   */
  clearHelpfulnessRecords(): void {
    this.helpfulnessRecords.clear();
  }

  /**
   * Clear all steering rules (for testing)
   */
  clearSteeringRules(): void {
    this.steeringRules.clear();
  }

  /**
   * Identify RAG-related files in the coding context
   */
  private identifyRagRelatedFiles(context: CodingContext): string[] {
    const ragFiles: string[] = [];

    // Check current file
    if (this.isRagRelatedFile(context.currentFile)) {
      ragFiles.push(context.currentFile);
    }

    // Check explicitly marked RAG-related files
    for (const file of context.ragRelatedFiles) {
      if (!ragFiles.includes(file)) {
        ragFiles.push(file);
      }
    }

    // Check recent changes for RAG-related files
    for (const change of context.recentChanges) {
      if (this.isRagRelatedFile(change.path) && !ragFiles.includes(change.path)) {
        ragFiles.push(change.path);
      }
    }

    return ragFiles;
  }

  /**
   * Check if a file path is RAG-related
   */
  private isRagRelatedFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return this.ragFilePatterns.some((pattern) => lowerPath.includes(pattern.toLowerCase()));
  }

  /**
   * Build query text from coding context
   */
  private buildContextQueryText(context: CodingContext, ragFiles: string[]): string {
    const parts: string[] = [`Current file: ${context.currentFile}`, `RAG files: ${ragFiles.join(", ")}`];

    if (context.recentChanges.length > 0) {
      const changeDescriptions = context.recentChanges
        .slice(0, 5)
        .map((c) => `${c.changeType}: ${c.path}`)
        .join(", ");
      parts.push(`Recent changes: ${changeDescriptions}`);
    }

    return parts.join("\n");
  }

  /**
   * Build query text from error record
   */
  private buildErrorQueryText(error: ErrorRecord): string {
    const parts: string[] = [
      `Error type: ${error.type}`,
      `Component: ${error.component}`,
      `Query: ${error.context.query}`,
    ];

    if (error.context.generationOutput) {
      parts.push(`Output: ${error.context.generationOutput}`);
    }

    return parts.join("\n");
  }

  /**
   * Calculate error relevance to the current context
   */
  private calculateErrorRelevance(
    error: ErrorRecord,
    ragFiles: string[],
    baseSimilarity: number
  ): number {
    let relevance = baseSimilarity;

    // Boost relevance if error component matches any RAG file
    const componentLower = error.component.toLowerCase();
    for (const file of ragFiles) {
      const fileLower = file.toLowerCase();
      if (fileLower.includes(componentLower) || componentLower.includes(fileLower.split("/").pop() ?? "")) {
        relevance = Math.min(1, relevance * 1.2);
        break;
      }
    }

    // Adjust based on helpfulness feedback
    const helpfulnessRecord = this.helpfulnessRecords.get(error.id);
    if (helpfulnessRecord) {
      if (helpfulnessRecord.helpful) {
        relevance = Math.min(1, relevance * 1.1);
      } else {
        relevance = relevance * 0.8;
      }
    }

    return relevance;
  }

  /**
   * Select the best fix from a list of fixes
   */
  private selectBestFix(fixes: FixRecord[]): FixRecord | undefined {
    if (fixes.length === 0) {
      return undefined;
    }

    // Sort by success rate (descending), then by resolved status
    const sortedFixes = [...fixes].sort((a, b) => {
      if (a.resolved !== b.resolved) {
        return a.resolved ? -1 : 1;
      }
      return b.successRate - a.successRate;
    });

    return sortedFixes[0];
  }

  /**
   * Generate warning message for a relevant error
   */
  private generateWarningMessage(error: ErrorRecord, fix?: FixRecord): string {
    let warning = `⚠️ Similar ${error.type} error occurred in ${error.component}`;

    if (error.context.query) {
      warning += ` for query: "${error.context.query.substring(0, 50)}..."`;
    }

    if (fix) {
      warning += `. Suggested fix: ${fix.description}`;
      if (fix.successRate > 0.7) {
        warning += ` (${Math.round(fix.successRate * 100)}% success rate)`;
      }
    }

    return warning;
  }

  /**
   * Generate proactive warning message
   */
  private generateProactiveWarning(error: ErrorRecord, fix?: FixRecord): string {
    let warning = `🔔 This error matches a known pattern: ${error.type} in ${error.component}`;

    if (fix) {
      warning += `. Established fix: ${fix.description}`;
      warning += ` (${Math.round(fix.successRate * 100)}% success rate)`;
    }

    return warning;
  }

  /**
   * Generate rule content from fix pattern
   */
  private generateRuleContent(pattern: FixPattern): string {
    return (
      `When working with ${pattern.errorType} errors, apply the following fix pattern: ` +
      `${pattern.fixDescription}. This pattern has been successful ${pattern.successCount} times ` +
      `across ${pattern.errorIds.length} similar errors.`
    );
  }

  /**
   * Update relevance scoring based on helpfulness feedback
   */
  private updateRelevanceScoring(errorId: string, helpful: boolean): void {
    // This method updates internal state that affects future relevance calculations
    // The actual adjustment happens in calculateErrorRelevance
    // Here we just ensure the record is stored (already done in recordHelpfulness)
  }
}

