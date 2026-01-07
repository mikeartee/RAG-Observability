#!/bin/bash

echo "🚀 Deploying RAG Observability Power to GitHub..."

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "src/rag-observability-power" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    echo "✅ Git repository initialized"
fi

# Add remote if it doesn't exist
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Adding GitHub remote..."
    git remote add origin https://github.com/mikeartee/RAG-Observability.git
    echo "✅ Remote added"
else
    echo "✅ GitHub remote already configured"
fi

# Stage all files
echo "📁 Staging files..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit"
else
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "Initial commit: RAG Observability Power

- Complete power implementation with TypeScript
- Comprehensive monitoring and observability features
- MCP integration for Kiro IDE
- Property-based testing with fast-check
- CI/CD workflows and GitHub templates
- Installation scripts and documentation
- Vector database support (Pinecone, Chroma)
- Self-improvement and error learning capabilities"
    echo "✅ Changes committed"
fi

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "🎉 Successfully deployed to GitHub!"
echo ""
echo "📋 Next steps:"
echo "1. Visit: https://github.com/mikeartee/RAG-Observability"
echo "2. Set up GitHub secrets for CI/CD:"
echo "   - NPM_TOKEN (for publishing to npm)"
echo "3. Enable GitHub Pages (optional)"
echo "4. Configure branch protection rules"
echo "5. Set up issue labels and milestones"
echo ""
echo "🔧 Repository features enabled:"
echo "✅ Automated CI/CD with GitHub Actions"
echo "✅ Issue and PR templates"
echo "✅ Comprehensive documentation"
echo "✅ NPM publishing workflow"
echo "✅ Code quality checks"
echo ""
echo "📚 Documentation available at:"
echo "   - README.md - Project overview"
echo "   - INSTALLATION.md - Setup guide"
echo "   - CONTRIBUTING.md - Development guide"
echo "   - src/rag-observability-power/POWER.md - Complete API docs"