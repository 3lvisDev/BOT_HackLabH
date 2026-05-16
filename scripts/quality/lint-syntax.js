#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join } = require('path');

const root = process.cwd();
const ignored = new Set(['node_modules', '.git', '.agents', '.continue', '.vscode', '.kiro', 'services/music-memory/node_modules']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const rel = dir === root ? name : `${dir.slice(root.length + 1)}\\${name}`;
    const norm = rel.replace(/\\/g, '/');
    if ([...ignored].some((x) => norm === x || norm.startsWith(`${x}/`))) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(js|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(root);
let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  if (res.status !== 0) {
    failed++;
    process.stderr.write(`\n[lint-syntax] ${file}\n${res.stderr.toString()}\n`);
  }
}

if (failed) {
  console.error(`lint failed: ${failed} file(s) with syntax errors`);
  process.exit(1);
}
console.log(`lint ok: ${files.length} JS files checked`);
