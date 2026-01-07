#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up RAG Observability Power...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version check passed:', nodeVersion);

// Navigate to the power directory
const powerDir = path.join(__dirname, '..', 'src', 'rag-observability-power');
process.chdir(powerDir);

console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

console.log('🔨 Building the project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Project built successfully');
} catch (error) {
  console.error('❌ Failed to build project:', error.message);
  process.exit(1);
}

console.log('🧪 Running tests...');
try {
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ All tests passed');
} catch (error) {
  console.error('❌ Tests failed:', error.message);
  process.exit(1);
}

// Create example configuration
const exampleConfig = `// Example configuration for RAG Observability Power
import { createRAGObservabilityPower } from 'rag-observability-power';

const power = await createRAGObservabilityPower({
  vectorDb: {
    type: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: 'rag-observability'
  },
  storage: {
    type: 'memory' // or 'sqlite', 'postgres'
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
console.log('RAG Observability Power initialized successfully!');
`;

const examplePath = path.join(powerDir, 'example.js');
fs.writeFileSync(examplePath, exampleConfig);

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Set up your vector database (Pinecone recommended)');
console.log('2. Configure environment variables');
console.log('3. Check out example.js for usage examples');
console.log('4. Read the documentation in POWER.md');
console.log('\n🔗 Useful commands:');
console.log('  npm test          - Run tests');
console.log('  npm run build     - Build the project');
console.log('  npm run dev       - Watch mode for development');
console.log('\n📚 Documentation: ./POWER.md');
console.log('🐛 Issues: https://github.com/yourusername/rag-observability-power/issues');