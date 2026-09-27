#!/usr/bin/env node
/**
 * Audit estimate template items for missing resourceName / rateAnalysisName links.
 */
const fs = require('fs');
const path = require('path');

const tDir = 'apps/mobile/constants/estimate-templates';
const files = fs
  .readdirSync(tDir)
  .filter((f) => f.endsWith('.ts') && !['types.ts', 'index.ts'].includes(f));

const re =
  /\{\s*(?:itemCode:\s*'[^']*'\s*,\s*)?description:\s*'([^']*)'\s*,\s*unit:\s*'([^']*)'\s*,\s*quantity:\s*([\d.]+)\s*,\s*rate:\s*([\d.]+)\s*,\s*type:\s*'([^']+)'([^}]*)\}/g;

let total = 0;
let linked = 0;
const unlinked = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(tDir, file), 'utf8');
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(content))) {
    total++;
    const rest = m[6];
    const hasRes = /resourceName:/.test(rest);
    const hasRa = /rateAnalysisName:/.test(rest);
    if (hasRes || hasRa) {
      linked++;
    } else {
      unlinked.push({
        file,
        description: m[1],
        unit: m[2],
        type: m[5],
      });
    }
  }
}

console.log(`Total items: ${total}`);
console.log(`Linked (resource or RA): ${linked}`);
console.log(`Unlinked: ${unlinked.length}`);
console.log('');

const byFile = {};
for (const u of unlinked) {
  if (!byFile[u.file]) byFile[u.file] = [];
  byFile[u.file].push(u);
}

for (const [file, items] of Object.entries(byFile).sort()) {
  const byType = {};
  for (const i of items) byType[i.type] = (byType[i.type] || 0) + 1;
  console.log(`=== ${file} (${items.length} unlinked) ${JSON.stringify(byType)} ===`);
  for (const i of items) {
    console.log(`  [${i.type}] ${i.description} (${i.unit})`);
  }
  console.log('');
}
