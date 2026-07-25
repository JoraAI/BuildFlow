#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read catalog names
const cat = fs.readFileSync('apps/backend/prisma/catalog-data.ts', 'utf8');
const catNames = new Set();
let m;
const reCat = /name:\s*'([^']+)'/g;
while ((m = reCat.exec(cat))) catNames.add(m[1]);

// Read RA names
const ra = fs.readFileSync('apps/backend/prisma/rate-analysis-data.ts', 'utf8');
const raNames = new Set();
const reRa = /name:\s*'([^']+)'/g;
while ((m = reRa.exec(ra))) raNames.add(m[1]);

// Read all template files
const tDir = 'apps/mobile/constants/estimate-templates';
const dirs = fs.readdirSync(tDir);
const tFiles = dirs.filter(f => f.endsWith('.ts') && f !== 'types.ts' && f !== 'index.ts');

const missingRes = new Map();
const missingRa = new Map();

for (const f of tFiles) {
  const content = fs.readFileSync(path.join(tDir, f), 'utf8');
  const reRes = /resourceName:\s*'([^']+)'/g;
  while ((m = reRes.exec(content))) {
    if (!catNames.has(m[1])) {
      if (!missingRes.has(m[1])) missingRes.set(m[1], []);
      missingRes.get(m[1]).push(f);
    }
  }
  const reRaRef = /rateAnalysisName:\s*'([^']+)'/g;
  while ((m = reRaRef.exec(content))) {
    if (!raNames.has(m[1])) {
      if (!missingRa.has(m[1])) missingRa.set(m[1], []);
      missingRa.get(m[1]).push(f);
    }
  }
}

console.log('=== MISSING CATALOG RESOURCES ===');
console.log('Total catalog items:', catNames.size);
console.log('Missing references:', missingRes.size);
for (const [name, files] of [...missingRes].sort()) {
  console.log('  ' + name + ' (' + files.join(', ') + ')');
}
console.log('');
console.log('=== MISSING RATE ANALYSES ===');
console.log('Total RAs:', raNames.size);
console.log('Missing references:', missingRa.size);
for (const [name, files] of [...missingRa].sort()) {
  console.log('  ' + name + ' (' + files.join(', ') + ')');
}

// ─── Check RA data source: MISC components must use miscName, not resourceName ───
console.log('');
console.log('=== RA MISC COMPONENTS USING resourceName (should use miscName) ===');
const raMiscBugs = [];
for (const line of ra.split('\n')) {
  const mm = line.match(/resourceName:\s*'([^']+)'.*?type:\s*CostType\.MISC/);
  if (mm) raMiscBugs.push(mm[1]);
}
if (raMiscBugs.length === 0) {
  console.log('OK - all MISC components correctly use miscName');
} else {
  console.log('FOUND ' + raMiscBugs.length + ' MISC components using resourceName:');
  const grouped = {};
  for (const n of raMiscBugs) grouped[n] = (grouped[n] || 0) + 1;
  for (const [name, count] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + name + ' (x' + count + ')');
  }
}

// ─── Check RA non-MISC components reference valid catalog names ───
console.log('');
console.log('=== RA NON-MISC COMPONENTS → CATALOG (broken refs) ===');
const brokenRa = [];
for (const line of ra.split('\n')) {
  const mm = line.match(/resourceName:\s*'([^']+)'.*?type:\s*CostType\.(\w+)/);
  if (mm) {
    const [, name, type] = mm;
    if (type !== 'MISC' && !catNames.has(name)) brokenRa.push({ name, type });
  }
}
if (brokenRa.length === 0) {
  console.log('OK - all non-MISC RA components reference valid catalog items');
} else {
  console.log('FOUND ' + brokenRa.length + ' broken references:');
  for (const b of brokenRa) console.log('  [' + b.type + '] ' + b.name);
}
