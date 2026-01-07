#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Installing RAG Observability Power as Kiro Power...\n');

// Check if we're in a Kiro workspace
const kiroDir = path.join(process.cwd(), '.kiro');
if (!fs.existsSync(kiroDir)) {
  console.error('❌ This doesn\'t appear to be a Kiro workspace (.kiro directory not found)');
  console.log('💡 Please run this script from your Kiro workspace root directory');
  process.exit(1);
}

console.log('✅ Kiro workspace detected');

// Create powers directory if it doesn't exist
const powersDir = path.join(process.cwd(), 'powers');
if (!fs.existsSync(powersDir)) {
  fs.mkdirSync(powersDir, { recursive: true });
  console.log('📁 Created powers directory');
}

// Copy power files
const sourcePowerDir = path.join(__dirname, '..', 'powers', 'rag-observability-power');
const targetPowerDir = path.join(powersDir, 'rag-observability-power');

if (fs.existsSync(targetPowerDir)) {
  console.log('⚠️  RAG Observability Power already exists, updating...');
} else {
  console.log('📦 Installing RAG Observability Power...');
}

// Copy power files
try {
  execSync(`cp -r "${sourcePowerDir}" "${targetPowerDir}"`, { stdio: 'inherit' });
  console.log('✅ Power files copied successfully');
} catch (error) {
  console.error('❌ Failed to copy power files:', error.message);
  process.exit(1);
}

// Install MCP server if needed
const mcpConfigPath = path.join(kiroDir, 'settings', 'mcp.json');
let mcpConfig = {};

if (fs.existsSync(mcpConfigPath)) {
  try {
    mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  } catch (error) {
    console.warn('⚠️  Could not parse existing MCP config, creating new one');
  }
}

// Add RAG Observability MCP server
if (!mcpConfig.mcpServers) {
  mcpConfig.mcpServers = {};
}

mcpConfig.mcpServers['rag-observability'] = {
  command: 'node',
  args: [path.join(targetPowerDir, 'dist', 'mcp-server.js')],
  env: {},
  disabled: false,
  autoApprove: [
    'rag_log_query',
    'rag_get_statistics',
    'rag_get_drift_alerts',
    'rag_get_recent_failures',
    'rag_get_relevant_errors'
  ]
};

// Ensure settings directory exists
const settingsDir = path.dirname(mcpConfigPath);
if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true });
}

// Write updated MCP config
fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
console.log('✅ MCP server configuration updated');

// Copy steering templates to workspace
const steeringDir = path.join(kiroDir, 'steering');
const steeringTemplatesDir = path.join(__dirname, '..', 'src', 'rag-observability-power', 'steering-templates');

if (fs.existsSync(steeringTemplatesDir)) {
  if (!fs.existsSync(steeringDir)) {
    fs.mkdirSync(steeringDir, { recursive: true });
  }
  
  try {
    execSync(`cp "${steeringTemplatesDir}"/*.md "${steeringDir}/"`, { stdio: 'inherit' });
    console.log('✅ Steering templates copied to workspace');
  } catch (error) {
    console.warn('⚠️  Could not copy steering templates:', error.message);
  }
}

console.log('\n🎉 RAG Observability Power installed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Restart Kiro to load the new MCP server');
console.log('2. Configure your vector database credentials');
console.log('3. Start using RAG observability tools in your chats');
console.log('\n🔧 Configuration:');
console.log(`  MCP Config: ${mcpConfigPath}`);
console.log(`  Power Files: ${targetPowerDir}`);
console.log(`  Steering Files: ${steeringDir}`);
console.log('\n📚 Documentation: powers/rag-observability-power/POWER.md');