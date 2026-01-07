---
title: "RAG Monitoring Best Practices"
description: "Guidelines for effective RAG system monitoring and observability"
category: "monitoring"
---

# RAG Monitoring Best Practices

This steering template provides guidelines for implementing effective RAG system monitoring using the RAG Observability Power.

## Core Monitoring Principles

### 1. Monitor Populations, Not Just Individual Queries

Focus on statistical trends across many queries rather than debugging individual failures:

```typescript
// Good: Monitor success rates over time windows
const stats = await ragMonitor.getStatistics({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date(),
  granularity: 'hour'
});

if (stats.successRate < baseline.successRate - controlLimits.threshold) {
  // Investigate population-level degradation
}

// Avoid: Only looking at individual query failures
```

### 2. Capture Comprehensive Quality Metrics

Always log quality metrics, not just success/failure:

```typescript
// Essential metrics to capture
const qualityMetrics = {
  retrievalRelevanceScore: calculateRelevanceScore(query, documents),
  generationConfidence: model.getConfidenceScore(),
  latencyMs: endTime - startTime,
  tokenCount: countTokens(output)
};

await ragObservabilityPower.logQuery({
  // ... other fields
  qualityMetrics,
  success: true // Log successful queries too!
});
```

### 3. Use Statistical Process Control

Set appropriate control limits based on your system's baseline performance:

```typescript
const controlLimits = {
  successRateLower: 0.85,      // Alert if success rate drops below 85%
  relevanceScoreLower: 0.7,    // Alert if relevance drops below 0.7
  latencyUpper: 5000,          // Alert if latency exceeds 5 seconds
  sigma: 2                     // 2-sigma control limits (95% confidence)
};
```

## Common Anti-Patterns to Avoid

### ❌ Only Monitoring Failures

```typescript
// Don't do this - only logging failures
if (!success) {
  await ragObservabilityPower.logQuery(event);
}
```

### ✅ Monitor All Queries

```typescript
// Do this - log all queries for complete visibility
await ragObservabilityPower.logQuery(event); // Always log
```

### ❌ Ignoring Quality Metrics

```typescript
// Don't do this - missing quality context
await ragObservabilityPower.logQuery({
  query,
  success: true,
  // Missing quality metrics!
});
```

### ✅ Comprehensive Quality Tracking

```typescript
// Do this - capture quality metrics
await ragObservabilityPower.logQuery({
  query,
  success: true,
  qualityMetrics: {
    retrievalRelevanceScore: 0.89,
    generationConfidence: 0.91,
    latencyMs: 1200,
    tokenCount: 150
  }
});
```

## Alerting Strategy

### 1. Drift-Based Alerts

Focus on statistical drift rather than absolute thresholds:

```typescript
// Good: Detect drift from baseline
const driftResult = await driftDetector.checkForDrift(currentStats, baseline);
if (driftResult.hasDrift && driftResult.severity === 'critical') {
  alert(`RAG performance drift detected: ${driftResult.message}`);
}

// Avoid: Hard-coded absolute thresholds that don't adapt
```

### 2. Contextual Alerts

Include context about what might have caused the issue:

```typescript
// When drift is detected, correlate with code changes
const commits = await codeCorrelator.getCommitsInWindow(
  driftResult.detectedAt,
  new Date()
);

const rankedCommits = await codeCorrelator.rankCommits(
  commits,
  driftResult.primaryMetric
);

// Alert includes potential causes
alert(`RAG drift detected. Likely cause: ${rankedCommits[0].reasoning}`);
```

## Performance Optimization

### 1. Batch Quality Metric Calculations

```typescript
// Efficient: Calculate metrics in batches
const batchMetrics = await Promise.all(
  queryBatch.map(query => calculateQualityMetrics(query))
);

// Inefficient: Calculate metrics one by one
```

### 2. Use Appropriate Time Windows

```typescript
// Good: Match window to your system's characteristics
const stats = await ragMonitor.getStatistics({
  start: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours
  end: new Date(),
  granularity: 'minute' // Fine-grained for recent data
});

// Avoid: Very large windows that are slow to compute
```

## Integration Patterns

### 1. Middleware Integration

```typescript
// Express middleware example
app.use('/api/rag', async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const result = await processRAGQuery(req.body.query);
    
    // Log successful query
    await ragObservabilityPower.logQuery({
      id: generateId(),
      timestamp: new Date(),
      query: req.body.query,
      retrievedDocuments: result.documents,
      generationOutput: result.output,
      qualityMetrics: {
        retrievalRelevanceScore: result.relevanceScore,
        generationConfidence: result.confidence,
        latencyMs: Date.now() - startTime,
        tokenCount: result.tokenCount
      },
      success: true
    });
    
    res.json(result);
  } catch (error) {
    // Log failed query
    await ragObservabilityPower.logQuery({
      id: generateId(),
      timestamp: new Date(),
      query: req.body.query,
      retrievedDocuments: [],
      generationOutput: '',
      qualityMetrics: {
        retrievalRelevanceScore: 0,
        generationConfidence: 0,
        latencyMs: Date.now() - startTime,
        tokenCount: 0
      },
      success: false,
      errorDetails: {
        type: 'generation_error',
        message: error.message,
        stackTrace: error.stack
      }
    });
    
    next(error);
  }
});
```

### 2. Background Monitoring

```typescript
// Set up periodic drift checking
setInterval(async () => {
  const currentStats = await ragMonitor.getStatistics({
    start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    end: new Date(),
    granularity: 'minute'
  });
  
  const baseline = await ragMonitor.getBaseline();
  const driftResult = await driftDetector.checkForDrift(currentStats, baseline);
  
  if (driftResult.hasDrift) {
    await handleDriftAlert(driftResult);
  }
}, 5 * 60 * 1000); // Check every 5 minutes
```

## Troubleshooting Guide

### High Latency Issues

1. Check if latency drift is detected
2. Correlate with recent code changes
3. Look for similar past issues in knowledge base
4. Check vector database performance

### Low Relevance Scores

1. Examine query patterns in recent failures
2. Check if embedding model has changed
3. Verify document corpus hasn't been corrupted
4. Review retrieval parameter changes

### Increasing Failure Rates

1. Check error breakdown by type
2. Look for patterns in failed queries
3. Correlate with deployment timeline
4. Review similar past incidents

## Maintenance Tasks

### Weekly

- Review and update baseline metrics
- Check for new error patterns
- Validate alert thresholds
- Clean up old captured failures

### Monthly

- Analyze long-term trends
- Update control limits if system has evolved
- Review and consolidate steering rules
- Audit fix suggestion accuracy

### Quarterly

- Full system health review
- Update monitoring strategy based on learnings
- Review and update error classification
- Optimize storage and performance