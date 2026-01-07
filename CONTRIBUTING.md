# Contributing to RAG Observability Power

Thank you for your interest in contributing to the RAG Observability Power! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- TypeScript knowledge

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/yourusername/rag-observability-power.git
   cd rag-observability-power
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run tests to ensure everything works:
   ```bash
   npm test
   ```

## 🏗️ Project Structure

```
src/rag-observability-power/
├── src/
│   ├── code-correlator/     # Links performance to code changes
│   ├── dashboard/           # Data visualization and reporting
│   ├── drift-detector/      # Statistical process control
│   ├── error-knowledge-base/ # RAG-enabled error storage
│   ├── failure-capturer/    # Deterministic failure replay
│   ├── fix-suggester/       # AI-powered fix recommendations
│   ├── rag-monitor/         # Core monitoring functionality
│   ├── self-improvement/    # Learning and adaptation
│   ├── types/              # TypeScript type definitions
│   └── test-utils/         # Testing utilities
├── steering-templates/      # Kiro steering file templates
└── tests/                  # Test files
```

## 🧪 Testing

We use Vitest for testing with both unit tests and property-based tests using fast-check.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- code-correlator.test.ts
```

### Writing Tests

- **Unit Tests**: Test specific functionality with concrete examples
- **Property Tests**: Test universal properties across many generated inputs
- Both types are required for comprehensive coverage

Example unit test:
```typescript
import { describe, it, expect } from 'vitest';
import { RAGMonitor } from './rag-monitor';

describe('RAGMonitor', () => {
  it('should log queries successfully', async () => {
    const monitor = new RAGMonitor();
    const result = await monitor.logQuery({
      id: 'test-query',
      query: 'test',
      success: true
    });
    expect(result.success).toBe(true);
  });
});
```

Example property test:
```typescript
import { fc, test } from 'fast-check';

test('RAG queries should always have valid timestamps', () => {
  fc.assert(fc.property(
    fc.record({
      id: fc.string(),
      query: fc.string(),
      timestamp: fc.date()
    }),
    (queryData) => {
      const result = validateQuery(queryData);
      expect(result.timestamp).toBeInstanceOf(Date);
    }
  ));
});
```

## 📝 Code Style

We follow TypeScript best practices:

- Use explicit type annotations
- Define interfaces for all object structures
- Organize imports logically
- Use meaningful names for generics
- Avoid `any` type unless absolutely necessary

### Formatting

The project uses built-in TypeScript formatting. Key points:

- 2-space indentation
- Single quotes for strings
- Trailing commas in objects/arrays
- Semicolons required

## 🔄 Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(monitor): add query batching support
fix(drift-detector): handle edge case with empty datasets
docs(readme): update installation instructions
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation if needed
6. Submit a pull request

#### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Property tests added/updated
- [ ] All tests pass

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

## 🎯 Areas for Contribution

### High Priority

- **Vector Database Integrations**: Add support for more vector databases (Weaviate, Qdrant, etc.)
- **Storage Backends**: Implement PostgreSQL, MongoDB storage options
- **Dashboard Enhancements**: Improve visualization and real-time updates
- **Alert Channels**: Add Slack, Discord, email notification support

### Medium Priority

- **Performance Optimizations**: Improve query performance and memory usage
- **Configuration Management**: Better configuration validation and defaults
- **Documentation**: More examples and tutorials
- **CLI Tools**: Command-line interface for common operations

### Low Priority

- **Integrations**: Connect with popular monitoring tools (Grafana, Datadog)
- **Export Features**: Data export in various formats
- **Advanced Analytics**: More sophisticated drift detection algorithms

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment**: Node.js version, OS, package version
2. **Steps to Reproduce**: Clear, minimal reproduction steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Error Messages**: Full error messages and stack traces
6. **Configuration**: Relevant configuration (sanitized)

Use the bug report template:

```markdown
**Environment**
- Node.js version:
- Package version:
- OS:

**Steps to Reproduce**
1. 
2. 
3. 

**Expected Behavior**


**Actual Behavior**


**Error Messages**
```

## 💡 Feature Requests

For feature requests, please:

1. Check existing issues first
2. Describe the problem you're trying to solve
3. Propose a solution
4. Consider implementation complexity
5. Think about backward compatibility

## 📚 Documentation

Documentation improvements are always welcome:

- Fix typos and grammar
- Add examples and use cases
- Improve API documentation
- Create tutorials and guides
- Update outdated information

## 🤝 Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Provide constructive feedback
- Follow the code of conduct
- Ask questions when unsure

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check existing docs first

## 🏆 Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- GitHub contributor graphs

Thank you for contributing to RAG Observability Power! 🎉