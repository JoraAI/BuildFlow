#!/usr/bin/env node
/**
 * Patch estimate templates: add rateAnalysisName/resourceName to unlinked MATERIAL items.
 * Reads each template file, finds MATERIAL items without procurement links,
 * and adds the appropriate link based on keyword matching.
 */
const fs = require('fs');
const path = require('path');

// Keyword → RA name mapping (checked in order, first match wins)
const RA_MATCHES = [
  // Concrete grades - check specific patterns first
  [/RCC M20/i, 'RCC M20 Slabs & Beams'],
  [/RCC M25/i, 'RCC M25 (Foundation & Slab)'],
  [/RCC M30/i, 'RCC M30 (Columns, Beams & Slabs)'],
  [/RCC M35/i, 'RCC M35 (Heavy Structural)'],
  [/RCC M40/i, 'RCC M40 (High-Rise & Pile Caps)'],
  [/PCC M15/i, 'PCC M15 (1:2:4)'],
  [/PCC M10/i, 'PCC M10 (1:3:6)'],
  // Structural elements
  [/Pier Column/i, 'RCC Pier Columns M35'],
  [/Pier Cap/i, 'RCC Pier Columns M35'],
  [/Deck Slab/i, 'RCC Deck Slab M35'],
  [/Pile concrete|Concrete for pile|Tremie/i, 'Tremie Concrete M30 (Piling)'],
  [/Pile cap/i, 'RCC M40 (High-Rise & Pile Caps)'],
  [/Diaphragm wall/i, 'Diaphragm Wall RCC M40 (600mm)'],
  [/Post-tensioned/i, 'Post-Tensioned Slab RCC M40'],
  [/Footings?.*Tie|Tie.*Beam/i, 'RCC Footings & Tie Beams M30'],
  [/Footing/i, 'RCC Footings & Tie Beams M30'],
  [/Pedestal/i, 'RCC Pedestal Foundation M30'],
  [/Wing Wall|Abutment/i, 'Culvert RCC (Wing Walls & Abutments)'],
  [/Column jacketing/i, 'Column Jacketing RCC M30'],
  // Tank/Pool
  [/Tank Wall|Tank base/i, 'RCC Water Tank Walls & Floor M30'],
  [/Pool Wall|Pool Floor|Pool.*RCC/i, 'Swimming Pool RCC M30 (Walls)'],
  // Roads
  [/DBM/i, 'DBM 50mm (Dense Bituminous Macadam)'],
  [/BC|wearing coat|Bituminous.*concrete/i, 'BC 40mm (Bituminous Concrete)'],
  [/Thermoplastic|road marking/i, 'Thermoplastic Road Marking'],
  [/Crash barrier/i, 'Crash Barrier Installation (W-Beam)'],
  // Pipes
  [/Hume pipe.*600|hume pipe 600/i, 'RCC Hume Pipe 600mm Installation'],
  [/Hume pipe.*900|hume pipe 900/i, 'RCC Hume Pipe 900mm Installation'],
  [/Hume pipe/i, 'RCC Hume Pipe 600mm Installation'],
];

// Keyword → catalog resourceName mapping
const RES_MATCHES = [
  // Direct catalog materials
  [/Fire alarm panel/i, 'Fire Alarm Panel (Addressable) 4 Zone'],
  [/Z-purlin/i, 'Z-Purlin (Galvanized) 200x50x20x2mm'],
  [/GI gutter 300/i, 'GI Gutter 300mm (Pre-Coated)'],
  [/Crane rail clamp/i, 'EOT Crane Rail Clamps'],
  [/Octagonal.*lighting pole/i, 'Octagonal Steel Lighting Pole 9m'],
  [/Energy dissipater/i, 'Energy Dissipater Block (Concrete)'],
  [/Stone pitching/i, 'Stone Pitching (Rubble)'],
  [/Approach embankment/i, 'Approach Embankment Fill (Soil)'],
  [/AC distribution box/i, 'AC Distribution Box (Surface) IP54'],
  [/DC distribution box/i, 'DC Distribution Box (Surface) IP54'],
  [/Roof penetration sealing/i, 'Roof Penetration Sealing Kit'],
  [/Oxygen pipeline/i, 'Oxygen Pipeline (Copper) 15mm Type L'],
  [/Vacuum pipeline/i, 'Vacuum Pipeline (Copper) 22mm Type L'],
  [/Nitrous oxide pipeline/i, 'Nitrous Oxide Pipeline (Copper) 18mm Type L'],
  [/Float valve 80/i, 'Float Valve 80mm (Brass)'],
  [/Epoxy tile grout/i, 'Epoxy Tile Grout (Pool Grade)'],
  [/Deck drainage channel/i, 'Deck Drainage Channel (SS)'],
  [/Expansion joint filler|Joint filler board/i, 'Expansion Joint Filler Board (Bituminous) 12mm'],
  [/Topsoil stripping/i, 'Red Earth'],
  [/Screened gravel 40/i, '40mm Aggregate'],
  [/Screened gravel 20/i, '20mm Aggregate'],
  [/Crushed aggregate 12/i, '12.5mm Aggregate'],
  [/Dust suppression/i, 'Water (Tanker Supply)'],
  [/Earthen shoulder/i, 'Moorum (Gravel)'],
  [/Underground cable/i, 'Aluminium Cable 4 Core 25 sqmm Armoured'],
  [/HDPE pipe 315/i, 'HDPE Pipe 110mm PN 6'],
  [/Diamond blade/i, 'Marble Cutting Blade 10 inch'],
  [/Texturing brush/i, 'Float (Wooden) 4ft'],
  [/Steps.*M\.S\..*manhole/i, 'MS Flat 25x3mm'],
  [/Timber shoring/i, 'Sal Wood'],
  [/Road signage/i, 'Building Name Board (ACP) 2400x600'],
  [/Road surface restoration/i, 'BC Mix Material (per ton)'],
  // Additional matches for remaining items
  [/Compound wall.*brick/i, null, 'RA:Brick Masonry 230mm CM 1:6'],
  [/Compound wall foundation/i, null, 'RA:RCC Footings & Tie Beams M30'],
  [/Bored cast-in-situ pile/i, null, 'RA:Bored Cast-In-Situ Pile 600mm (per rmt)'],
  [/Industrial rolling shutter/i, 'Industrial Rolling Shutter Motor 1HP'],
  [/Culvert RCC slab/i, null, 'RA:RCC M25 (Foundation & Slab)'],
  [/Expansion joints?\s*\(every/i, 'Expansion Joint Filler Board (Bituminous) 12mm'],
  [/RCC outlet structure/i, null, 'RA:RCC M25 (Foundation & Slab)'],
  [/Shuttering for piers/i, 'Shuttering Plywood 18mm Waterproof'],
  [/RCC footpath slab/i, null, 'RA:RCC M25 (Foundation & Slab)'],
  [/Pipe collar|joint ring/i, 'CPVC Coupler 25mm'],
  [/Shuttering for columns/i, 'Shuttering Plywood 18mm Waterproof'],
  [/Underground electrical cable/i, 'Aluminium Cable 4 Core 25 sqmm Armoured'],
];

const tDir = 'apps/mobile/constants/estimate-templates';
const files = ['buildings.ts', 'infrastructure.ts', 'utilities.ts', 'specialty.ts', 'earthwork-mining.ts'];

let totalPatched = 0;
let totalUnmatched = 0;
const unmatchedItems = [];

for (const file of files) {
  const filePath = path.join(tDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let filePatched = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line is a MATERIAL item without rateAnalysisName or resourceName
    if (!line.includes("type: 'MATERIAL'")) continue;
    if (line.includes('rateAnalysisName') || line.includes('resourceName')) continue;
    
    // Extract description
    const descMatch = line.match(/description:\s*'([^']+)'/);
    if (!descMatch) continue;
    const desc = descMatch[1];
    
    // Try RA matches first
    let matched = false;
    for (const [regex, raName] of RA_MATCHES) {
      if (regex.test(desc)) {
        // Add rateAnalysisName before the closing }
        lines[i] = line.replace(/\s*\},?\s*$/, `, rateAnalysisName: '${raName}' },`);
        filePatched++;
        matched = true;
        break;
      }
    }
    
    if (matched) continue;
    
    // Try resource matches
    for (const [regex, resName] of RES_MATCHES) {
      if (regex.test(desc)) {
        lines[i] = line.replace(/\s*\},?\s*$/, `, resourceName: '${resName}' },`);
        filePatched++;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      totalUnmatched++;
      unmatchedItems.push({ file, line: i + 1, desc });
    }
  }
  
  if (filePatched > 0) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`[${file}] Patched ${filePatched} items`);
    totalPatched += filePatched;
  }
}

console.log(`\nTotal patched: ${totalPatched}`);
console.log(`Still unmatched: ${totalUnmatched}`);
if (unmatchedItems.length > 0) {
  console.log('\nUnmatched items:');
  for (const u of unmatchedItems) {
    console.log(`  [${u.file}:${u.line}] ${u.desc}`);
  }
}