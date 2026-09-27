#!/usr/bin/env node
/**
 * Ensure every estimate-template item has resourceName or rateAnalysisName.
 * Prefers existing RA / catalog matches; otherwise appends catalog entries
 * and patches template files in place.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const T_DIR = path.join(ROOT, 'apps/mobile/constants/estimate-templates');
const CAT_PATH = path.join(ROOT, 'apps/backend/prisma/catalog-data.ts');
const RA_PATH = path.join(ROOT, 'apps/backend/prisma/rate-analysis-data.ts');

const ITEM_RE =
  /\{\s*(?:itemCode:\s*'[^']*'\s*,\s*)?description:\s*'([^']*)'\s*,\s*unit:\s*'([^']*)'\s*,\s*quantity:\s*([\d.]+)\s*,\s*rate:\s*([\d.]+)\s*,\s*type:\s*'([^']+)'([^}]*)\}/g;

/** Explicit description → preferred RA name (must exist in rate-analysis-data). */
const RA_OVERRIDES = {
  'Excavation for foundation (ordinary soil)': 'Excavation in Ordinary Soil',
  'Gypsum board ceiling': 'Gypsum Board Partition 75mm',
  'Built-up columns (welded section)': 'Fabricated Steel Truss (per ton)',
  'Built-up rafters (tapered)': 'Fabricated Steel Truss (per ton)',
  'Pre-stressed concrete girders (cast & erect)': 'Post-Tensioned Slab RCC M40',
  'RCC manhole (1.5x1.0m) complete': 'RCC M25 (Foundation & Slab)',
  'Manhole construction (complete)': 'RCC M25 (Foundation & Slab)',
  'Catch pit (0.6x0.6x0.9m)': 'RCC M25 (Foundation & Slab)',
  'RCC outfall structure': 'RCC M25 (Foundation & Slab)',
  'Carbon fiber wrapping': 'Column Jacketing RCC M30',
};

/** Explicit description → existing catalog resource name. */
const RES_OVERRIDES = {
  'Scaffolding hire': 'Scaffolding Pipe 40mm NB',
  'Concrete saw for joint cutting': 'Circular Saw 14 inch',
  'Slip form paver for PQC': 'Paver Finisher',
  'Loading with excavator': 'Excavator PC130',
  'Loading for dispatch': 'JCB Excavator 3DX',
  'Wheel loader 1.5 cum': 'JCB Excavator 3DX',
  'Wheel loader for stockpile': 'JCB Excavator 3DX',
  'Bearing installation': 'Steel Fabricator',
  'Setting out & marking': 'Surveyor',
  'Site clearing & leveling': 'Unskilled Labour (Male)',
  'Vegetation clearing & grubbing': 'Unskilled Labour (Male)',
  'Site grading & leveling': 'Unskilled Labour (Male)',
  'Dismantling damaged plaster': 'Unskilled Labour (Male)',
  'Dismantling damaged RCC': 'Breaker / Demolition Hammer',
  'Safety equipment': 'Safety Officer',
  'Safety equipment & PPE': 'Safety Officer',
  'Site cleanup': 'Sweeper / Cleaner',
};

function loadNames(file, re) {
  const text = fs.readFileSync(file, 'utf8');
  const set = new Set();
  let m;
  while ((m = re.exec(text))) set.add(m[1]);
  return set;
}

const catNames = loadNames(CAT_PATH, /name:\s*'([^']+)'/g);
const raNames = loadNames(RA_PATH, /name:\s*'([^']+)'/g);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectUnlinked() {
  const files = fs
    .readdirSync(T_DIR)
    .filter((f) => f.endsWith('.ts') && !['types.ts', 'index.ts'].includes(f));
  const map = new Map();
  for (const file of files) {
    const content = fs.readFileSync(path.join(T_DIR, file), 'utf8');
    ITEM_RE.lastIndex = 0;
    let m;
    while ((m = ITEM_RE.exec(content))) {
      const rest = m[6];
      if (/resourceName:/.test(rest) || /rateAnalysisName:/.test(rest)) continue;
      const key = `${m[5]}|${m[1]}`;
      if (!map.has(key)) {
        map.set(key, {
          type: m[5],
          description: m[1],
          unit: m[2],
          rate: Number(m[4]),
        });
      }
    }
  }
  return [...map.values()];
}

function resolveLink(item) {
  if (RA_OVERRIDES[item.description] && raNames.has(RA_OVERRIDES[item.description])) {
    return { kind: 'ra', name: RA_OVERRIDES[item.description] };
  }
  if (RES_OVERRIDES[item.description] && catNames.has(RES_OVERRIDES[item.description])) {
    return { kind: 'res', name: RES_OVERRIDES[item.description] };
  }
  // Exact RA name match
  if (raNames.has(item.description)) {
    return { kind: 'ra', name: item.description };
  }
  // Exact catalog match
  if (catNames.has(item.description)) {
    return { kind: 'res', name: item.description };
  }
  // Create catalog entry named after description
  return { kind: 'new', name: item.description };
}

function resourceTypeFor(itemType) {
  if (itemType === 'LABOUR') return 'LABOUR';
  if (itemType === 'EQUIPMENT') return 'EQUIPMENT';
  if (itemType === 'SUBCONTRACTOR') return 'SUBCONTRACTOR';
  // MISC estimate lines → catalog SUBCONTRACTOR (package / provisional)
  return 'SUBCONTRACTOR';
}

function categoryFor(itemType) {
  if (itemType === 'LABOUR') return 'Labour';
  if (itemType === 'EQUIPMENT') return 'Equipment Hire';
  if (itemType === 'SUBCONTRACTOR') return 'Subcontractor Packages';
  return 'Provisional / Misc';
}

function gstFor(itemType) {
  if (itemType === 'LABOUR') return 0;
  return 18;
}

function hsnFor(itemType) {
  if (itemType === 'LABOUR') return undefined;
  if (itemType === 'EQUIPMENT') return '8430';
  return '9987'; // construction services
}

const unlinked = collectUnlinked();
console.log(`Unlinked unique items: ${unlinked.length}`);

const toCreate = [];
const linkPlan = new Map(); // description|type → {kind,name}

for (const item of unlinked) {
  const link = resolveLink(item);
  const key = `${item.type}|${item.description}`;
  if (link.kind === 'new') {
    // Deduplicate by catalog name
    if (!catNames.has(link.name) && !toCreate.some((c) => c.name === link.name)) {
      toCreate.push({
        name: link.name,
        type: resourceTypeFor(item.type),
        unit: item.unit,
        rate: item.rate,
        gstRate: gstFor(item.type),
        hsn: hsnFor(item.type),
        category: categoryFor(item.type),
      });
      catNames.add(link.name);
    }
    linkPlan.set(key, { kind: 'res', name: link.name });
  } else {
    linkPlan.set(key, link);
  }
}

console.log(`New catalog entries to add: ${toCreate.length}`);
console.log(
  `Link plan: RA=${[...linkPlan.values()].filter((l) => l.kind === 'ra').length}, RES=${[...linkPlan.values()].filter((l) => l.kind === 'res').length}`,
);

// Append catalog entries
if (toCreate.length > 0) {
  let cat = fs.readFileSync(CAT_PATH, 'utf8');
  const lines = [
    '',
    '  // ════════════════════════════════════════════════════════════════',
    '  // 71. TEMPLATE PACKAGE LINKS (subcontractor / labour / equipment / misc)',
    '  // Auto-added so every estimate-template line resolves to a catalog resource.',
    '  // ════════════════════════════════════════════════════════════════',
  ];
  for (const c of toCreate) {
    const hsn = c.hsn ? `, hsn: '${c.hsn}'` : '';
    lines.push(
      `  { name: '${c.name.replace(/'/g, "\\'")}', type: ResourceType.${c.type}, unit: '${c.unit}', rate: ${c.rate}, gstRate: ${c.gstRate}${hsn}, category: '${c.category}' },`,
    );
  }
  // Insert before trailing `];` of CATALOG_ITEMS / export array
  const insertPoint = cat.lastIndexOf('\n];');
  if (insertPoint < 0) throw new Error('Could not find end of catalog array');
  cat = cat.slice(0, insertPoint) + '\n' + lines.join('\n') + cat.slice(insertPoint);
  fs.writeFileSync(CAT_PATH, cat);
  console.log(`Appended ${toCreate.length} catalog items`);
}

// Patch template files
const tFiles = fs
  .readdirSync(T_DIR)
  .filter((f) => f.endsWith('.ts') && !['types.ts', 'index.ts'].includes(f));

let patched = 0;
for (const file of tFiles) {
  const full = path.join(T_DIR, file);
  let content = fs.readFileSync(full, 'utf8');
  const next = content.replace(ITEM_RE, (fullMatch, desc, unit, qty, rate, type, rest) => {
    if (/resourceName:/.test(rest) || /rateAnalysisName:/.test(rest)) return fullMatch;
    const plan = linkPlan.get(`${type}|${desc}`);
    if (!plan) return fullMatch;
    const field =
      plan.kind === 'ra'
        ? `, rateAnalysisName: '${plan.name.replace(/'/g, "\\'")}'`
        : `, resourceName: '${plan.name.replace(/'/g, "\\'")}'`;
    // Insert before closing }
    const trimmed = fullMatch.replace(/\s*\}$/, '');
    patched++;
    return `${trimmed}${field} }`;
  });
  if (next !== content) fs.writeFileSync(full, next);
}

console.log(`Patched ${patched} template item occurrences`);
