#!/usr/bin/env node
/**
 * Lightweight test runner for legacy Mocha-style tests.
 * Keeps npm test dependency-free by providing describe/it globals.
 */

const path = require('path');

const tests = [];
let beforeEachHook = null;

global.describe = (name, fn) => {
  console.log(`\n# ${name}`);
  fn();
};

global.beforeEach = (fn) => {
  beforeEachHook = fn;
};

global.it = (name, fn) => {
  tests.push({ name, fn, beforeEachHook });
};

global.test = global.it;
global.test.skip = (name) => {
  console.log(`- skipped: ${name}`);
};

global.expect = (value) => ({
  toBe: (expected) => {
    if (value !== expected) {
      throw new Error(`Expected ${JSON.stringify(value)} to be ${JSON.stringify(expected)}`);
    }
  },
  toBeTruthy: () => {
    if (!value) throw new Error(`Expected ${JSON.stringify(value)} to be truthy`);
  },
  toContain: (expected) => {
    if (!value || !value.includes(expected)) {
      throw new Error(`Expected ${JSON.stringify(value)} to contain ${JSON.stringify(expected)}`);
    }
  }
});

function runMaybeAsync(fn) {
  return new Promise((resolve, reject) => {
    try {
      if (fn.length > 0) {
        let doneCalled = false;
        const timeout = setTimeout(() => {
          if (!doneCalled) reject(new Error('Test timed out waiting for done()'));
        }, 5000);

        fn((err) => {
          doneCalled = true;
          clearTimeout(timeout);
          err ? reject(err) : resolve();
        });
        return;
      }

      Promise.resolve(fn()).then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function main() {
  const files = [
    'bugfix-welcome-goodbye.test.js',
    'preservation.test.js',
    'music-seed-learning.test.js',
    'music-memory-client.test.js'
  ];

  for (const file of files) {
    require(path.join(__dirname, file));
  }

  let passed = 0;
  let failed = 0;

  for (const testCase of tests) {
    try {
      if (testCase.beforeEachHook) await runMaybeAsync(testCase.beforeEachHook);
      await runMaybeAsync(testCase.fn);
      passed++;
      console.log(`? ${testCase.name}`);
    } catch (error) {
      failed++;
      console.error(`? ${testCase.name}`);
      console.error(`  ${error.stack || error.message}`);
    }
  }

  console.log(`\nTest Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('Test runner error:', error.stack || error.message);
  process.exit(1);
});
