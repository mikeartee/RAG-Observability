#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying RAG Observability Power setup...\n');

const checks = [
  {
    name: 'README.md exists',
    check: () => fs.existsSync('README.md'),
    required: true
  },
  {
    name: 'LICENSE file exists',
    check: () => fs.existsSync('LICENSE'),
    required: true
  },
  {
    name: 'CONTRIBUTING.md exists',
    check: () => fs.existsSync('CONTRIBUTING.md'),
    required: true
  },
  {
    name: 'INSTALLATION.md exists',
    check: () => fs.existsSync('INSTALLATION.md'),
    required: true
  },
  {
    name: 'CHANGELOG.md exists',
    check: () => fs.existsSync('CHANGELOG.md'),
    required: true
  },
  {
    name: '.gitignore configured',
    check: () => {
      if (!fs.existsSync('.gitignore')) return false;
      const content = fs.readFileSync('.gitignore', 'utf8');
      return content.includes('node_modules/') && content.includes('dist/');
    },
    required: true
  },
  {
    name: 'GitHub workflows exist',
    check: () => fs.existsSync('.github/workflows/ci.yml') && fs.existsSync('.github/workflows/release.yml'),
    required: true
  },
  {
    name: 'Issue templates exist',
    check: () => fs.existsSync('.github/ISSUE_TEMPLATE/bug_report.md') && fs.existsSync('.github/ISSUE_TEMPLATE/feature_request.md'),
    required: true
  },
  {
    name: 'PR template exists',
    check: () => fs.existsSync('.github/pull_request_template.md'),
    required: true
  },
  {
    name: 'Power source code exists',
    check: () => fs.existsSync('src/rag-observability-power/src/index.ts'),
    required: true
  },
  {
    name: 'Package.json configured',
    check: () => {
      if (!fs.existsSync('src/rag-observability-power/package.json')) return false;
      const pkg = JSON.parse(fs.readFileSync('src/rag-observability-power/package.json', 'utf8'));
      return pkg.repository && pkg.repository.url.includes('mikeartee/RAG-Observability');
    },
    required: true
  },
  {
    name: 'TypeScript config exists',
    check: () => fs.existsSync('src/rag-observability-power/tsconfig.json'),
    required: true
  },
  {
    name: 'ESLint config exists',
    check: () => fs.existsSync('src/rag-observability-power/.eslintrc.js'),
    required: true
  },
  {
    name: 'Vitest config exists',
    check: () => fs.existsSync('src/rag-observability-power/vitest.config.ts'),
    required: true
  },
  {
    name: 'Power documentation exists',
    check: () => fs.existsSync('src/rag-observability-power/POWER.md'),
    required: true
  },
  {
    name: 'MCP configuration exists',
    check: () => fs.existsSync('powers/rag-observability-power/mcp.json'),
    required: true
  },
  {
    name: 'Steering templates exist',
    check: () => fs.existsSync('src/rag-observability-power/steering-templates/README.md'),
    required: true
  },
  {
    name: 'Installation scripts exist',
    check: () => fs.existsSync('scripts/setup.js') && fs.existsSync('scripts/install-power.js'),
    required: true
  },
  {
    name: 'Deployment scripts exist',
    check: () => fs.existsSync('scripts/deploy-to-github.sh') && fs.existsSync('scripts/deploy-to-github.ps1'),
    required: true
  }
];

let passed = 0;
let failed = 0;

console.log('Running checks...\n');

checks.forEach(check => {
  const result = check.check();
  const status = result ? '✅' : (check.required ? '❌' : '⚠️');
  const label = check.required ? '' : ' (optional)';
  
  console.log(`${status} ${check.name}${label}`);
  
  if (result) {
    passed++;
  } else {
    failed++;
    if (check.required) {
      console.log(`   → This is required for proper setup`);
    }
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 All checks passed! Your RAG Observability Power is ready for GitHub.');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm install (in src/rag-observability-power/)');
  console.log('2. Run: npm run build (in src/rag-observability-power/)');
  console.log('3. Run: npm test (in src/rag-observability-power/)');
  console.log('4. Run: scripts/deploy-to-github.ps1 (Windows) or scripts/deploy-to-github.sh (Unix)');
  console.log('\n🔗 Repository: https://github.com/mikeartee/RAG-Observability');
} else {
  console.log('⚠️  Some checks failed. Please address the issues above before deploying.');
  process.exit(1);
}

// Additional verification
console.log('\n🔍 Additional checks:');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
console.log(`Node.js version: ${nodeVersion} ${majorVersion >= 18 ? '✅' : '❌ (18+ required)'}`);

// Check if git is available
try {
  require('child_process').execSync('git --version', { stdio: 'ignore' });
  console.log('Git available: ✅');
} catch (error) {
  console.log('Git available: ❌ (required for deployment)');
}

// Check package.json scripts
try {
  const pkg = JSON.parse(fs.readFileSync('src/rag-observability-power/package.json', 'utf8'));
  const requiredScripts = ['build', 'test', 'lint'];
  const hasAllScripts = requiredScripts.every(script => pkg.scripts && pkg.scripts[script]);
  console.log(`Package.json scripts: ${hasAllScripts ? '✅' : '❌'}`);
} catch (error) {
  console.log('Package.json scripts: ❌');
}

console.log('\n🚀 Ready for deployment!');