# RAG Observability Power

A comprehensive Kiro POWER for RAG (Retrieval-Augmented Generation) system observability and self-improvement. This power answers three critical questions when RAG failures occur: **Where did it break?** **Why did it break?** **How do we fix it?**

## 🚀 Quick Start

### Installation

```bash
npm install rag-observability-power
```

### Basic Setup

```typescript
import { createRAGObservabilityPower } from 'rag-observability-power';

const power = await createRAGObservabilityPower({
  vectorDb: {
    type: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: 'rag-observability'
  },
  storage: {
    type: 'memory'
  }
});

await power.initialize();
```

## ✨ Key Features

- **📊 Statistical Process Control**: Monitor RAG performance over populations of queries
- **🔍 Drift Detection**: Automatically detect performance degradation beyond acceptable bounds
- **🔗 Code Correlation**: Link performance changes to specific code commits
- **🎯 Failure Capture & Replay**: Make probabilistic RAG failures deterministically reproducible
- **🧠 Error Knowledge Base**: RAG-enabled storage of errors, fixes, and patterns with semantic search
- **🔄 Self-Improvement Loop**: Surface relevant past errors during coding to prevent repeating mistakes
- **💡 Fix Suggestions**: Automatically suggest solutions based on similar past errors

## 🏗️ Architecture

The power follows a layered architecture inspired by Sentry's approach to error monitoring, adapted for probabilistic RAG systems:

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                        │
│  Self-Improvement Loop • Steering Rules • Coding Context   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                        │
│           Dashboard • Alerts • Visualizations              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Layer                          │
│  Error Knowledge Base • Fix Suggester • Vector Search      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Analysis Layer                          │
│    Drift Detector • Failure Capturer • Code Correlator    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  Data Collection Layer                      │
│        RAG Monitor • Query Interceptor • Git Hooks         │
└─────────────────────────────────────────────────────────────┘
```

## 📖 Documentation

For detailed documentation, examples, and API reference, see [POWER.md](./src/rag-observability-power/POWER.md).

## 🛠️ Development

### Prerequisites

- Node.js 18+
- TypeScript 5.0+

### Setup

```bash
git clone https://github.com/mikeartee/RAG-Observability.git
cd RAG-Observability
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

## 🔧 Configuration

### Vector Database

```typescript
// Pinecone
const vectorDbConfig = {
  type: 'pinecone',
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
  indexName: 'rag-observability'
};

// Chroma (alternative)
const chromaConfig = {
  type: 'chroma',
  host: 'localhost',
  port: 8000,
  collection: 'rag-errors'
};
```

### Control Limits

```typescript
const controlLimits = {
  successRateLower: 0.85,      // Alert if success rate drops below 85%
  relevanceScoreLower: 0.7,    // Alert if relevance drops below 0.7
  latencyUpper: 5000,          // Alert if latency exceeds 5 seconds
  sigma: 2                     // 2-sigma control limits (95% confidence)
};
```

## 🎯 Use Cases

### 1. RAG Performance Monitoring

```typescript
const stats = await power.getStatistics({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date(),
  granularity: 'hour'
});
```

### 2. Debugging RAG Failures

```typescript
const failures = await power.getRecentFailures({ limit: 10 });
const replayResult = await power.replayFailure(failures[0].id);
```

### 3. Learning from Past Errors

```typescript
const similarErrors = await power.searchSimilarErrors({
  query: 'embedding generation timeout',
  limit: 5
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for your changes
5. Run tests: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 [Documentation](./src/rag-observability-power/POWER.md)
- 🐛 [Issue Tracker](https://github.com/mikeartee/RAG-Observability/issues)
- 💬 [Discussions](https://github.com/mikeartee/RAG-Observability/discussions)

## 🙏 Acknowledgments

- Inspired by Sentry's approach to error monitoring
- Built for the Kiro ecosystem
- Designed for production RAG systems

---

**Made with ❤️ for the RAG community**
