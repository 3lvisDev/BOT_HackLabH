#!/usr/bin/env node
/**
 * Simple Test Runner
 * Ejecuta los tests de exploración del bug y preservación
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  Test Suite: Welcome/Goodbye Messages Bug Fix             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

async function runTest(testFile, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ Running: ${description}`);
    console.log(`  File: ${testFile}\n`);
    
    const testProcess = spawn('node', [testFile], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✓ ${description} completed\n`);
        resolve();
      } else {
        console.log(`\n✗ ${description} failed with code ${code}\n`);
        reject(new Error(`Test failed: ${description}`));
      }
    });

    testProcess.on('error', (err) => {
      console.error(`\n✗ Error running ${description}:`, err.message);
      reject(err);
    });
  });
}

async function main() {
  const tests = [
    {
      file: path.join(__dirname, 'bugfix-welcome-goodbye.test.js'),
      description: 'Bug Exploration Tests'
    },
    {
      file: path.join(__dirname, 'preservation.test.js'),
      description: 'Preservation Tests'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await runTest(test.file, test.description);
      passed++;
    } catch (error) {
      failed++;
      console.error(`Failed: ${test.description}`);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Results Summary                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}\n`);

  if (failed > 0) {
    console.log('⚠️  Some tests failed. Review the output above.\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('\n❌ Test runner error:', error.message);
  process.exit(1);
});
