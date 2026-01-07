# Installation Guide

This guide covers multiple ways to install and use the RAG Observability Power.

## 🚀 Quick Start

### Option 1: Install as NPM Package

```bash
npm install rag-observability-power
```

### Option 2: Install as Kiro Power

```bash
# Clone the repository
git clone https://github.com/mikeartee/RAG-Observability.git
cd RAG-Observability

# Run the setup script
node scripts/setup.js

# Install as Kiro Power (run from your Kiro workspace)
node scripts/install-power.js
```

### Option 3: Development Installation

```bash
# Clone and setup for development
git clone https://github.com/mikeartee/RAG-Observability.git
cd RAG-Observability
cd src/rag-observability-power
npm install
npm run build
npm test
```

## 📋 Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **TypeScript**: 5.0.0 or higher (for development)

### Vector Database

Choose one of the supported vector databases:

#### Pinecone (Recommended)

1. Sign up at [Pinecone](https://www.pinecone.io/)
2. Create a new index with dimension 1536 (for OpenAI embeddings)
3. Get your API key and environment

#### Chroma (Alternative)

1. Install Chroma: `pip install chromadb`
2. Run Chroma server: `chroma run --host localhost --port 8000`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=rag-observability

# Optional: OpenAI for embeddings
OPENAI_API_KEY=your_openai_api_key

# Optional: Database
DATABASE_URL=sqlite:./rag-observability.db
```

### Basic Configuration

```typescript
import { createRAGObservabilityPower } from 'rag-observability-power';

const power = await createRAGObservabilityPower({
  vectorDb: {
    type: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENVIRONMENT!,
    indexName: process.env.PINECONE_INDEX_NAME || 'rag-observability'
  },
  storage: {
    type: 'sqlite',
    connectionString: process.env.DATABASE_URL || 'sqlite:./rag-observability.db'
  },
  monitoring: {
    controlLimits: {
      successRateLower: 0.85,
      relevanceScoreLower: 0.7,
      latencyUpper: 5000,
      sigma: 2
    }
  }
});

await power.initialize();
```

## 🎯 Installation Methods

### Method 1: NPM Package Installation

Best for: Using as a library in your Node.js application

```bash
# Install the package
npm install rag-observability-power

# Install peer dependencies
npm install typescript@^5.0.0
```

**Usage:**

```typescript
import { createRAGObservabilityPower } from 'rag-observability-power';

// Initialize and use
const power = await createRAGObservabilityPower(config);
await power.logQuery(queryData);
```

### Method 2: Kiro Power Installation

Best for: Integration with Kiro IDE and MCP tools

```bash
# From your Kiro workspace root
git clone https://github.com/mikeartee/RAG-Observability.git temp-rag-power
cd temp-rag-power
node scripts/install-power.js
cd ..
rm -rf temp-rag-power
```

**What this does:**
- Copies power files to `powers/rag-observability-power/`
- Updates `.kiro/settings/mcp.json` with MCP server configuration
- Copies steering templates to `.kiro/steering/`
- Configures auto-approval for common MCP tools

### Method 3: Development Installation

Best for: Contributing to the project or customizing the power

```bash
# Clone the repository
git clone https://github.com/mikeartee/RAG-Observability.git
cd RAG-Observability

# Setup development environment
cd src/rag-observability-power
npm install
npm run build

# Run tests to verify installation
npm test

# Start development mode
npm run dev
```

## 🔌 Kiro Integration

### MCP Server Setup

The power includes an MCP server for Kiro integration. After installation:

1. **Restart Kiro** to load the new MCP server
2. **Verify connection** in Kiro's MCP panel
3. **Test tools** by using RAG observability commands in chat

### Available MCP Tools

- `rag_log_query` - Log RAG query events
- `rag_get_statistics` - Get performance statistics
- `rag_get_drift_alerts` - Check for performance drift
- `rag_get_recent_failures` - Get recent failures
- `rag_replay_failure` - Replay captured failures
- `rag_search_similar_errors` - Find similar past errors
- `rag_get_relevant_errors` - Get relevant errors for coding context
- `rag_suggest_fixes` - Get fix suggestions

### Steering Files

The power includes steering templates that are automatically copied to your Kiro workspace:

- `rag-error-handling.md` - Best practices for RAG error handling
- `rag-monitoring-best-practices.md` - Monitoring guidelines
- `rag-self-improvement.md` - Self-improvement loop configuration

## 🧪 Verification

### Test Your Installation

```bash
# Run the test suite
npm test

# Test specific components
npm test -- drift-detector
npm test -- rag-monitor

# Run with coverage
npm run test:coverage
```

### Verify MCP Integration (Kiro)

1. Open Kiro
2. Go to MCP Servers panel
3. Look for "rag-observability" server
4. Status should be "Connected"
5. Test with: "Show me RAG statistics for the last hour"

### Basic Functionality Test

```typescript
// Create a simple test
import { createRAGObservabilityPower } from 'rag-observability-power';

async function testInstallation() {
  const power = await createRAGObservabilityPower({
    vectorDb: { type: 'memory' }, // Use memory for testing
    storage: { type: 'memory' }
  });
  
  await power.initialize();
  
  // Log a test query
  await power.logQuery({
    id: 'test-query',
    timestamp: new Date(),
    query: 'test query',
    success: true,
    qualityMetrics: {
      retrievalRelevanceScore: 0.9,
      generationConfidence: 0.8,
      latencyMs: 1000,
      tokenCount: 100
    }
  });
  
  // Get statistics
  const stats = await power.getStatistics({
    start: new Date(Date.now() - 3600000),
    end: new Date()
  });
  
  console.log('✅ Installation verified!', stats);
}

testInstallation().catch(console.error);
```

## 🔧 Troubleshooting

### Common Issues

**Node.js Version Error**
```
Error: Node.js 18 or higher is required
```
Solution: Update Node.js to version 18 or higher

**Vector Database Connection Error**
```
Error: Failed to connect to Pinecone
```
Solutions:
- Verify API key and environment variables
- Check network connectivity
- Ensure index exists with correct dimensions

**MCP Server Not Loading**
```
MCP server "rag-observability" failed to start
```
Solutions:
- Restart Kiro
- Check MCP configuration in `.kiro/settings/mcp.json`
- Verify power files are built (`npm run build`)

**Permission Errors**
```
Error: EACCES permission denied
```
Solutions:
- Run with appropriate permissions
- Check file ownership
- Use `sudo` if necessary (not recommended for development)

### Debug Mode

Enable debug logging:

```typescript
const power = await createRAGObservabilityPower({
  // ... other config
  debug: true,
  logLevel: 'debug'
});
```

### Getting Help

1. **Check the logs**: Look for error messages in console output
2. **Verify configuration**: Double-check environment variables and config
3. **Test components**: Run individual component tests
4. **Check GitHub issues**: [RAG-Observability Issues](https://github.com/mikeartee/RAG-Observability/issues)
5. **Create an issue**: If you can't resolve the problem

## 🚀 Next Steps

After successful installation:

1. **Configure your vector database** with appropriate credentials
2. **Set up monitoring** for your RAG system
3. **Integrate logging** into your RAG pipeline
4. **Explore the dashboard** and visualization features
5. **Set up alerts** for performance drift
6. **Enable self-improvement** features

## 📚 Additional Resources

- [POWER.md](./src/rag-observability-power/POWER.md) - Complete documentation
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
- [Examples](./examples/) - Usage examples
- [GitHub Repository](https://github.com/mikeartee/RAG-Observability) - Source code and issues