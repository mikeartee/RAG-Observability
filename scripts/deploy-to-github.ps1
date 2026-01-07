#!/usr/bin/env pwsh

Write-Host "🚀 Deploying RAG Observability Power to GitHub..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "README.md") -or -not (Test-Path "src/rag-observability-power")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "📦 Initializing git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
}

# Add remote if it doesn't exist
try {
    git remote get-url origin | Out-Null
    Write-Host "✅ GitHub remote already configured" -ForegroundColor Green
} catch {
    Write-Host "🔗 Adding GitHub remote..." -ForegroundColor Yellow
    git remote add origin https://github.com/mikeartee/RAG-Observability.git
    Write-Host "✅ Remote added" -ForegroundColor Green
}

# Stage all files
Write-Host "📁 Staging files..." -ForegroundColor Yellow
git add .

# Check if there are changes to commit
$stagedChanges = git diff --staged --name-only
if (-not $stagedChanges) {
    Write-Host "ℹ️  No changes to commit" -ForegroundColor Blue
} else {
    # Commit changes
    Write-Host "💾 Committing changes..." -ForegroundColor Yellow
    git commit -m "Initial commit: RAG Observability Power

- Complete power implementation with TypeScript
- Comprehensive monitoring and observability features
- MCP integration for Kiro IDE
- Property-based testing with fast-check
- CI/CD workflows and GitHub templates
- Installation scripts and documentation
- Vector database support (Pinecone, Chroma)
- Self-improvement and error learning capabilities"
    Write-Host "✅ Changes committed" -ForegroundColor Green
}

# Push to GitHub
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Yellow
git branch -M main
git push -u origin main

Write-Host ""
Write-Host "🎉 Successfully deployed to GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Visit: https://github.com/mikeartee/RAG-Observability"
Write-Host "2. Set up GitHub secrets for CI/CD:"
Write-Host "   - NPM_TOKEN (for publishing to npm)"
Write-Host "3. Enable GitHub Pages (optional)"
Write-Host "4. Configure branch protection rules"
Write-Host "5. Set up issue labels and milestones"
Write-Host ""
Write-Host "🔧 Repository features enabled:" -ForegroundColor Cyan
Write-Host "✅ Automated CI/CD with GitHub Actions"
Write-Host "✅ Issue and PR templates"
Write-Host "✅ Comprehensive documentation"
Write-Host "✅ NPM publishing workflow"
Write-Host "✅ Code quality checks"
Write-Host ""
Write-Host "📚 Documentation available at:" -ForegroundColor Cyan
Write-Host "   - README.md - Project overview"
Write-Host "   - INSTALLATION.md - Setup guide"
Write-Host "   - CONTRIBUTING.md - Development guide"
Write-Host "   - src/rag-observability-power/POWER.md - Complete API docs"