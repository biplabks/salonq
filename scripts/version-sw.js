#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const swPath = path.resolve(process.argv[2]);
if (!swPath) {
  console.error('Usage: node scripts/version-sw.js <path-to-dist/sw.js>');
  process.exit(1);
}

let buildId;
try {
  buildId = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'pipe'] })
    .toString()
    .trim();
} catch {
  buildId = String(Date.now());
}

const content = fs.readFileSync(swPath, 'utf8');
fs.writeFileSync(swPath, content.replaceAll('BUILD_ID', buildId));
console.log(`SW versioned: BUILD_ID → ${buildId} (${swPath})`);
