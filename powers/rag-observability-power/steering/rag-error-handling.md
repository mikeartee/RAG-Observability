---
title: "RAG Error Handling Patterns"
description: "Best practices for handling and learning from RAG system errors"
category: "error-handling"
---

# RAG Error Handling Patterns

This steering template provides patterns for effective error handling in RAG systems using the RAG Observability Power.

## Error Classification

### Primary Error Types

Always classify errors using the standard taxonomy:

```typescript
type ErrorType = 
  | 'retrieval_failure'      // Vector search or document retrieval failed
  | 'relevance_degradation'  // Retrieved documents not relevant
  | 'generation_error'       // LLM generation failed or produced poor output
  | 'context_overflow'       // Context window exceeded
  | 'latency_spike'         // Response time exceeded acceptable limits
  | 'embedding_error'       // Embedding generation failed
  | 'unknown';              // Unclassified error
```

### Error Context Capture

Always capture comprehensive context for debugging:

```typescript
const errorContext = {
  query: originalQuery,
  retrievedDocs: documents.map(d => d.id), // Don't store full content
  generationOutput: truncatedOutput,       // Truncate if very long
  stackTrace: error.stack,
  breadcrumbs: [
    {
      timestamp: new Date(),
      category: 'retrieval',
      message: 'Starting document retrieval',
      data: { queryLength: query.length }
    },
    {
      timestamp: new Date(),
      category: 'generation',
      message: 'LLM generation failed',
      data: { modelName: 'gpt-4', tokenCount: 150 }
    }
  ]
};
```

## Error Handling Patterns

### 1. Graceful Degradation

```typescript
async function processRAGQuery(query: string): Promise<RAGResponse> {
  try {
    // Primary RAG pipeline
    const documents = await retrieveDocuments(query);
    const response = await generateResponse(query, documents);
    
    // Log successful query
    await ragObservabilityPower.logQuery({
      // ... success event
    });
    
    return response;
    
  } catch (error) {
    // Capture failure for learning
    const capturedFailure = await ragObservabilityPower.captureFailure({
      query,
      error,
      timestamp: new Date()
    });
    
    // Try to get fix suggestions immediately
    const suggestions = await ragObservabilityPower.suggestFixes(
      capturedFailure.id
    );
    
    if (suggestions.length > 0) {
      // Apply automatic fix if confidence is high
      const bestSuggestion = suggestions[0];
      if (bestSuggestion.confidence > 0.8) {
        try {
          return await applyFixAndRetry(query, bestSuggestion);
        } catch (retryError) {
          // Log that automatic fix failed
          await ragObservabilityPower.recordFixOutcome(
            bestSuggestion.id,
            false
          );
        }
      }
    }
    
    // Fallback to simpler response
    return {
      response: "I'm having trouble processing your request. Please try rephrasing your question.",
      confidence: 0.1,
      sources: [],
      metadata: {
        fallbackUsed: true,
        originalError: error.message
      }
    };
  }
}
```

### 2. Proactive Error Prevention

```typescript
// Check for known error patterns before processing
async function preprocessQuery(query: string, context: CodingContext): Promise<string> {
  // Get relevant past errors for this context
  const relevantErrors = await ragObservabilityPower.getRelevantErrors(context);
  
  // Check if query matches known problematic patterns
  for (const relevantError of relevantErrors) {
    if (relevantError.relevance > 0.8 && relevantError.suggestedFix) {
      // Warn about potential issue
      console.warn(`⚠️  ${relevantError.warning}`);
      console.log(`💡 Suggested prevention: ${relevantError.suggestedFix.description}`);
      
      // Optionally modify query to prevent known issue
      if (relevantError.suggestedFix.successRate > 0.9) {
        query = applyPreventiveFix(query, relevantError.suggestedFix);
      }
    }
  }
  
  return query;
}
```

### 3. Error Recovery Strategies

```typescript
class RAGErrorRecovery {
  async handleRetrievalFailure(query: string, error: Error): Promise<Document[]> {
    // Strategy 1: Retry with modified query
    try {
      const modifiedQuery = await this.simplifyQuery(query);
      return await retrieveDocuments(modifiedQuery);
    } catch (retryError) {
      // Strategy 2: Use cached similar queries
      const similarQueries = await this.findSimilarCachedQueries(query);
      if (similarQueries.length > 0) {
        return similarQueries[0].documents;
      }
      
      // Strategy 3: Return empty results with explanation
      return [];
    }
  }
  
  async handleGenerationFailure(query: string, documents: Document[], error: Error): Promise<string> {
    // Strategy 1: Reduce context size
    try {
      const reducedDocs = documents.slice(0, Math.floor(documents.length / 2));
      return await generateResponse(query, reducedDocs);
    } catch (retryError) {
      // Strategy 2: Use template-based response
      return this.generateTemplateResponse(query, documents);
    }
  }
  
  async handleContextOverflow(query: string, documents: Document[]): Promise<string> {
    // Strategy 1: Summarize documents first
    const summaries = await Promise.all(
      documents.map(doc => this.summarizeDocument(doc))
    );
    
    return await generateResponse(query, summaries);
  }
}
```

## Learning from Errors

### 1. Error Pattern Recognition

```typescript
// Automatically detect recurring error patterns
async function analyzeErrorPatterns(): Promise<void> {
  const recentErrors = await ragObservabilityPower.getRecentErrors({
    timeWindow: { hours: 24 },
    limit: 100
  });
  
  // Group errors by similarity
  const errorGroups = await groupSimilarErrors(recentErrors);
  
  for (const group of errorGroups) {
    if (group.errors.length >= 3) { // Pattern threshold
      // Check if we have successful fixes for this pattern
      const fixes = group.errors
        .flatMap(e => e.fixes)
        .filter(f => f.resolved);
      
      if (fixes.length > 0) {
        // Generate steering rule for this pattern
        await ragObservabilityPower.generateSteeringRule({
          pattern: group.commonPattern,
          fixes: fixes,
          confidence: fixes.length / group.errors.length
        });
      }
    }
  }
}
```

### 2. Fix Effectiveness Tracking

```typescript
async function applyFixWithTracking(
  errorId: string,
  fix: FixRecord
): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    // Apply the fix
    await applyFix(fix);
    
    // Test if fix resolves the issue
    const testResult = await testFixEffectiveness(errorId, fix);
    
    // Record outcome
    await ragObservabilityPower.recordFixOutcome(fix.id, testResult.success);
    
    if (testResult.success) {
      console.log(`✅ Fix applied successfully in ${Date.now() - startTime}ms`);
      return true;
    } else {
      console.log(`❌ Fix did not resolve the issue: ${testResult.reason}`);
      return false;
    }
    
  } catch (error) {
    // Record failed application
    await ragObservabilityPower.recordFixOutcome(fix.id, false);
    console.error(`❌ Fix application failed: ${error.message}`);
    return false;
  }
}
```

## Error Prevention Strategies

### 1. Input Validation

```typescript
function validateRAGInput(query: string): ValidationResult {
  const issues: string[] = [];
  
  // Check query length
  if (query.length === 0) {
    issues.push("Empty query provided");
  } else if (query.length > 10000) {
    issues.push("Query too long, may cause context overflow");
  }
  
  // Check for problematic patterns
  if (query.includes('```') && query.split('```').length > 10) {
    issues.push("Too many code blocks, may cause parsing issues");
  }
  
  // Check for known problematic terms
  const problematicTerms = ['undefined', 'null', 'NaN'];
  const foundTerms = problematicTerms.filter(term => 
    query.toLowerCase().includes(term)
  );
  
  if (foundTerms.length > 0) {
    issues.push(`Query contains potentially problematic terms: ${foundTerms.join(', ')}`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    sanitizedQuery: sanitizeQuery(query)
  };
}
```

### 2. Circuit Breaker Pattern

```typescript
class RAGCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async executeRAGQuery(query: string): Promise<RAGResponse> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) { // 1 minute timeout
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - RAG service unavailable');
      }
    }
    
    try {
      const result = await processRAGQuery(query);
      
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
      
    } catch (error) {
      this.recordFailure();
      
      // Log failure for analysis
      await ragObservabilityPower.logQuery({
        query,
        success: false,
        errorDetails: {
          type: 'circuit_breaker_failure',
          message: error.message,
          circuitState: this.state
        }
      });
      
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= 5) { // Failure threshold
      this.state = 'open';
    }
  }
  
  private reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
}
```

## Monitoring Error Health

### 1. Error Rate Tracking

```typescript
// Monitor error rates by type
async function monitorErrorRates(): Promise<void> {
  const stats = await ragObservabilityPower.getStatistics({
    start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    end: new Date(),
    granularity: 'minute'
  });
  
  // Check overall error rate
  if (stats.successRate < 0.95) { // 95% success rate threshold
    await alertHighErrorRate(stats);
  }
  
  // Check specific error types
  for (const [errorType, count] of Object.entries(stats.errorBreakdown)) {
    const errorRate = count / stats.queryCount;
    
    if (errorRate > getErrorThreshold(errorType)) {
      await alertSpecificErrorType(errorType, errorRate, count);
    }
  }
}

function getErrorThreshold(errorType: string): number {
  const thresholds = {
    'retrieval_failure': 0.02,      // 2%
    'relevance_degradation': 0.05,  // 5%
    'generation_error': 0.01,       // 1%
    'context_overflow': 0.03,       // 3%
    'latency_spike': 0.10,          // 10%
    'embedding_error': 0.01,        // 1%
    'unknown': 0.01                 // 1%
  };
  
  return thresholds[errorType] || 0.01;
}
```

### 2. Error Recovery Metrics

```typescript
// Track how well error recovery strategies work
async function trackRecoveryMetrics(): Promise<void> {
  const recentFailures = await ragObservabilityPower.getRecentFailures({
    limit: 100,
    timeWindow: { hours: 24 }
  });
  
  const recoveryStats = {
    totalFailures: recentFailures.length,
    automaticRecoveries: 0,
    manualFixes: 0,
    unresolved: 0
  };
  
  for (const failure of recentFailures) {
    if (failure.automaticRecovery) {
      recoveryStats.automaticRecoveries++;
    } else if (failure.fixes.some(f => f.resolved)) {
      recoveryStats.manualFixes++;
    } else {
      recoveryStats.unresolved++;
    }
  }
  
  const recoveryRate = (recoveryStats.automaticRecoveries + recoveryStats.manualFixes) / 
                      recoveryStats.totalFailures;
  
  if (recoveryRate < 0.8) { // 80% recovery rate threshold
    await alertLowRecoveryRate(recoveryStats);
  }
}
```

## Best Practices Summary

### Do's ✅

- Always capture comprehensive error context
- Classify errors using standard taxonomy
- Implement graceful degradation strategies
- Track fix effectiveness over time
- Use circuit breakers for resilience
- Monitor error patterns and trends
- Generate steering rules from successful fixes

### Don'ts ❌

- Don't ignore "minor" errors - they often indicate larger issues
- Don't apply fixes without tracking their effectiveness
- Don't let errors fail silently
- Don't use generic error messages - be specific
- Don't forget to validate inputs before processing
- Don't skip logging successful queries
- Don't ignore error recovery metrics