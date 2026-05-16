#!/usr/bin/env node
const { existsSync } = require('fs');
const { join } = require('path');

const required = [
  'index.js',
  'commands/help.js',
  'music/MusicManager.js',
  'docker-compose.release.yml',
  'services/music-memory/src/server.js',
  'docs/SQA_MUSIC_LEARNING_REPORT.md'
];

const missing = required.filter((f) => !existsSync(join(process.cwd(), f)));
if (missing.length) {
  console.error('build-check failed. Missing required files:');
  for (const m of missing) console.error(`- ${m}`);
  process.exit(1);
}

console.log('build check ok: required artifacts present');
