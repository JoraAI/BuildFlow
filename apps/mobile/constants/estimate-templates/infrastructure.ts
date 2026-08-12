/**
 * Infrastructure Estimate Templates - Roads, Canals, Bridges, Tunnels, Dams, Airports, Drainage
 * Each template contains granular line items linked to catalog resources and rate analyses.
 */
import type { EstimateTemplate } from './types';

export const INFRASTRUCTURE_TEMPLATES: EstimateTemplate[] = [
  // ════════════════════════════════════════════════════════════════
  // 1. HIGHWAY / FLEXIBLE PAVEMENT ROAD (2-lane, 1 km)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'highway-flexible-pavement',
    name: 'Highway Road (Flexible Pavement, 2-Lane, 1 km)',
    description: 'Complete 2-lane highway with flexible pavement - earthwork, GSB, WMM, bituminous layers, drainage, signage, marking',
    category: 'Infrastructure',
    sections: [
      {
        name: '1. Preliminary Works & Survey',
        items: [
          { itemCode: 'HW-P-001', description: 'Detailed topographic survey with Total Station', unit: 'km', quantity: 1, rate: 45000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-P-002', description: 'Geotechnical investigation (soil testing every 200m)', unit: 'km', quantity: 1, rate: 85000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-P-003', description: 'Establishing bench marks & survey pillars', unit: 'nos', quantity: 10, rate: 2500, type: 'MISC' },
          { itemCode: 'HW-P-004', description: 'Project signage & site mobilization', unit: 'ls', quantity: 1, rate: 250000, type: 'MISC' },
          { itemCode: 'HW-P-005', description: 'Traffic management plan & detours', unit: 'ls', quantity: 1, rate: 180000, type: 'MISC' },
        ],
      },
      {
        name: '2. Site Clearing & Grubbing',
        items: [
          { itemCode: 'HW-C-001', description: 'Clearing & grubbing vegetation (including tree removal)', unit: 'sqm', quantity: 14000, rate: 28, type: 'LABOUR', resourceName: 'Unskilled Labour (Male)' },
          { itemCode: 'HW-C-002', description: 'Excavator for site clearing', unit: 'day', quantity: 8, rate: 28000, type: 'EQUIPMENT', resourceName: 'Excavator 20T (PC200)' },
          { itemCode: 'HW-C-003', description: 'Tipper for debris hauling', unit: 'trip', quantity: 45, rate: 1800, type: 'EQUIPMENT', resourceName: 'Tipper / Dumper 10 cum (Local)' },
          { itemCode: 'HW-C-004', description: 'Excavator operator', unit: 'day', quantity: 8, rate: 1500, type: 'LABOUR', resourceName: 'JCB / Excavator Operator' },
        ],
      },
      {
        name: '3. Earthwork & Embankment',
        items: [
          // Composite items - each RA bundles excavator + operator + labour.
          // Do NOT list equipment separately; that double-counts the RA components.
          { itemCode: 'HW-E-001', description: 'Excavation in ordinary soil for road formation', unit: 'cum', quantity: 8000, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'HW-E-002', description: 'Excavation in hard rock (if required)', unit: 'cum', quantity: 1500, rate: 850, type: 'MATERIAL', rateAnalysisName: 'Excavation in Hard Rock (Chiselling)' },
          { itemCode: 'HW-E-003', description: 'Embankment fill with selected soil (compacted)', unit: 'cum', quantity: 6500, rate: 380, type: 'MATERIAL', rateAnalysisName: 'Backfilling with Sand' },
          { itemCode: 'HW-E-008', description: 'Field density test (sand replacement)', unit: 'nos', quantity: 80, rate: 2500, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '4. Granular Sub-Base (GSB)',
        items: [
          // Single composite line - the RA bundles GSB material + grader + roller + labour.
          { itemCode: 'HW-G-002', description: 'GSB layer 200mm (supply, spread & compact)', unit: 'sqm', quantity: 8500, rate: 550, type: 'MATERIAL', rateAnalysisName: 'GSB Layer 200mm' },
        ],
      },
      {
        name: '5. Wet Mix Macadam (WMM)',
        items: [
          // Single composite line - the RA bundles WMM material + plant + roller + labour.
          { itemCode: 'HW-W-002', description: 'WMM layer 250mm (supply, spread & compact)', unit: 'sqm', quantity: 8500, rate: 850, type: 'MATERIAL', rateAnalysisName: 'WMM Layer 250mm' },
        ],
      },
      {
        name: '6. Prime Coat & Tack Coat',
        items: [
          { itemCode: 'HW-PT-001', description: 'Prime coat application (bitumen cutback)', unit: 'sqm', quantity: 8500, rate: 65, type: 'MATERIAL', rateAnalysisName: 'Prime Coat Application' },
          { itemCode: 'HW-PT-002', description: 'Prime coat material (cutback bitumen)', unit: 'litre', quantity: 5950, rate: 52, type: 'MATERIAL', resourceName: 'Prime Coat Material (Cutback)' },
          { itemCode: 'HW-PT-003', description: 'Tack coat application (bitumen emulsion)', unit: 'sqm', quantity: 8500, rate: 45, type: 'MATERIAL', rateAnalysisName: 'Tack Coat Application' },
          { itemCode: 'HW-PT-004', description: 'Bitumen emulsion SS-1 for tack coat', unit: 'litre', quantity: 2975, rate: 45, type: 'MATERIAL', resourceName: 'Bitumen Emulsion (SS-1)' },
        ],
      },
      {
        name: '7. Dense Bituminous Macadam (DBM)',
        items: [
          // Single composite line - the RA bundles DBM mix + hot mix plant + paver + roller + labour.
          { itemCode: 'HW-D-001', description: 'DBM 75mm binder course (supply, mix, lay & compact)', unit: 'sqm', quantity: 8500, rate: 650, type: 'MATERIAL', rateAnalysisName: 'DBM 75mm (Dense Bituminous Macadam)' },
        ],
      },
      {
        name: '8. Bituminous Concrete (BC) Wearing Course',
        items: [
          // Single composite line - the RA bundles BC mix + hot mix plant + paver + roller + labour.
          { itemCode: 'HW-B-001', description: 'BC 40mm wearing course (supply, mix, lay & compact)', unit: 'sqm', quantity: 8500, rate: 520, type: 'MATERIAL', rateAnalysisName: 'Bituminous Concrete 40mm' },
        ],
      },
      {
        name: '9. Shoulders & Kerbs',
        items: [
          { itemCode: 'HW-S-001', description: 'Earthen shoulder with gravel', unit: 'cum', quantity: 380, rate: 450, type: 'MATERIAL', resourceName: 'Moorum (Gravel)' },
          { itemCode: 'HW-S-002', description: 'Gravel/moorum for shoulder', unit: 'cum', quantity: 400, rate: 650, type: 'MATERIAL', resourceName: 'Moorum (Gravel)' },
          { itemCode: 'HW-S-003', description: 'RCC kerb stone 300x150mm', unit: 'rmt', quantity: 2000, rate: 180, type: 'MATERIAL', resourceName: 'Kerb Stone RCC 300x150' },
          { itemCode: 'HW-S-004', description: 'Kerb laying & finishing', unit: 'rmt', quantity: 2000, rate: 65, type: 'LABOUR', resourceName: 'Mason Grade 1 (Mistri)' },
          { itemCode: 'HW-S-005', description: 'OPC cement for kerb fixing', unit: 'bag', quantity: 120, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'HW-S-006', description: 'River sand for kerb mortar', unit: 'cum', quantity: 8, rate: 1800, type: 'MATERIAL', resourceName: 'River Sand (Fine)' },
        ],
      },
      {
        name: '10. Side Drains & Culverts',
        items: [
          { itemCode: 'HW-DN-001', description: 'Excavation for side drains', unit: 'cum', quantity: 1200, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'HW-DN-002', description: 'RCC NP3 hume pipe 600mm dia', unit: 'rmt', quantity: 150, rate: 2800, type: 'MATERIAL', rateAnalysisName: 'RCC Hume Pipe 600mm Installation' },
          { itemCode: 'HW-DN-003', description: 'PCC bedding for pipes (150mm)', unit: 'cum', quantity: 18, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'HW-DN-004', description: 'Manhole construction (complete)', unit: 'nos', quantity: 12, rate: 28500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-DN-005', description: 'Precast manhole cover 600x600', unit: 'nos', quantity: 12, rate: 3500, type: 'MATERIAL', resourceName: 'Precast Manhole Cover (Heavy Duty) 600x600' },
          { itemCode: 'HW-DN-006', description: 'Culvert RCC slab (3m span)', unit: 'cum', quantity: 25, rate: 8200, type: 'MATERIAL', rateAnalysisName: 'RCC M25 (Foundation & Slab)' },
          { itemCode: 'HW-DN-007', description: 'Culvert wing walls & abutments', unit: 'cum', quantity: 45, rate: 7800, type: 'MATERIAL', rateAnalysisName: 'Culvert RCC (Wing Walls & Abutments)' },
          { itemCode: 'HW-DN-008', description: 'TMT steel Fe500 for culvert', unit: 'kg', quantity: 5500, rate: 72, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'HW-DN-009', description: 'OPC cement for culvert RCC', unit: 'bag', quantity: 850, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
        ],
      },
      {
        name: '11. Road Marking & Signage',
        items: [
          { itemCode: 'HW-RM-001', description: 'Thermoplastic road marking (white, center line)', unit: 'rmt', quantity: 1800, rate: 180, type: 'MATERIAL', rateAnalysisName: 'Thermoplastic Road Marking' },
          { itemCode: 'HW-RM-002', description: 'Thermoplastic road marking (yellow, edge line)', unit: 'rmt', quantity: 3600, rate: 180, type: 'MATERIAL', rateAnalysisName: 'Thermoplastic Road Marking' },
          { itemCode: 'HW-RM-003', description: 'Thermoplastic paint (white)', unit: 'kg', quantity: 180, rate: 75, type: 'MATERIAL', resourceName: 'Thermoplastic Road Marking Paint (White)' },
          { itemCode: 'HW-RM-004', description: 'Thermoplastic paint (yellow)', unit: 'kg', quantity: 360, rate: 85, type: 'MATERIAL', resourceName: 'Thermoplastic Road Marking Paint (Yellow)' },
          { itemCode: 'HW-RM-005', description: 'Glass microbeads for retroreflection', unit: 'kg', quantity: 85, rate: 120, type: 'MATERIAL', resourceName: 'Glass Microbeads (Retroreflective)' },
          { itemCode: 'HW-RM-006', description: 'Road marking machine hire', unit: 'day', quantity: 4, rate: 8500, type: 'EQUIPMENT', resourceName: 'Thermoplastic Road Marking Machine' },
          { itemCode: 'HW-RM-007', description: 'Solar road studs', unit: 'nos', quantity: 80, rate: 350, type: 'MATERIAL', resourceName: 'Road Stud (Solar)' },
          { itemCode: 'HW-RM-008', description: 'Cat eye reflectors (amber)', unit: 'nos', quantity: 120, rate: 120, type: 'MATERIAL', resourceName: 'Cat Eye Reflector (Amber)' },
          { itemCode: 'HW-RM-009', description: 'Road signage boards (directional)', unit: 'nos', quantity: 15, rate: 8500, type: 'MATERIAL', resourceName: 'Building Name Board (ACP) 2400x600' },
          { itemCode: 'HW-RM-010', description: 'Mild steel crash barrier (W-beam)', unit: 'rmt', quantity: 500, rate: 1850, type: 'MATERIAL', resourceName: 'Wire Rope Barrier 4mm (Galvanized)' },
        ],
      },
      {
        name: '12. Street Lighting',
        items: [
          { itemCode: 'HW-SL-001', description: 'Octagonal steel lighting pole 9m', unit: 'nos', quantity: 40, rate: 35000, type: 'MATERIAL', resourceName: 'Octagonal Steel Lighting Pole 9m' },
          { itemCode: 'HW-SL-002', description: 'LED street light 120W', unit: 'nos', quantity: 40, rate: 3200, type: 'MATERIAL', resourceName: 'LED Street Light 60W' },
          { itemCode: 'HW-SL-003', description: 'Foundation concrete for poles', unit: 'cum', quantity: 16, rate: 6500, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'HW-SL-004', description: 'Underground cable for lighting', unit: 'rmt', quantity: 2000, rate: 280, type: 'MATERIAL', resourceName: 'Aluminium Cable 4 Core 25 sqmm Armoured' },
          { itemCode: 'HW-SL-005', description: 'Distribution panel board', unit: 'nos', quantity: 5, rate: 18500, type: 'MATERIAL', resourceName: 'Distribution Board 12-Way Surface' },
        ],
      },
      {
        name: '13. Quality Control & Testing',
        items: [
          { itemCode: 'HW-QC-001', description: 'Bitumen extraction tests', unit: 'nos', quantity: 25, rate: 3500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-QC-002', description: 'Marshall stability tests', unit: 'nos', quantity: 25, rate: 4500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-QC-003', description: 'Core cutting & density test', unit: 'nos', quantity: 20, rate: 2800, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-QC-004', description: 'CBR test on subgrade', unit: 'nos', quantity: 15, rate: 5500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-QC-005', description: 'Sand replacement density test', unit: 'nos', quantity: 80, rate: 2500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HW-QC-006', description: 'Rebound hammer test', unit: 'nos', quantity: 30, rate: 1200, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '14. Miscellaneous',
        items: [
          { itemCode: 'HW-M-001', description: 'Diesel for equipment', unit: 'litre', quantity: 8500, rate: 88, type: 'MATERIAL', resourceName: 'Diesel (HSD)' },
          { itemCode: 'HW-M-002', description: 'Water for construction', unit: 'kL', quantity: 1200, rate: 120, type: 'MATERIAL', resourceName: 'Water (Tanker Supply)' },
          { itemCode: 'HW-M-003', description: 'Safety equipment & PPE', unit: 'ls', quantity: 1, rate: 185000, type: 'MISC' },
          { itemCode: 'HW-M-004', description: 'Site office & stores setup', unit: 'ls', quantity: 1, rate: 250000, type: 'MISC', resourceName: 'Modular Site Office (Container) 20ft' },
          { itemCode: 'HW-M-005', description: 'Environmental monitoring', unit: 'ls', quantity: 1, rate: 120000, type: 'MISC' },
          { itemCode: 'HW-M-006', description: 'Insurance & bonds', unit: 'ls', quantity: 1, rate: 350000, type: 'MISC' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 2. RIGID PAVEMENT ROAD (Concrete, 2-lane, 1 km)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'highway-rigid-pavement',
    name: 'Highway Road (Rigid Pavement, 2-Lane, 1 km)',
    description: 'Concrete pavement with DLC base, PQC surface, joints, dowels - for heavy traffic highways',
    category: 'Infrastructure',
    sections: [
      {
        name: '1. Preliminary Works',
        items: [
          { itemCode: 'RP-P-001', description: 'Topographic survey & alignment', unit: 'km', quantity: 1, rate: 45000, type: 'SUBCONTRACTOR' },
          { itemCode: 'RP-P-002', description: 'Soil investigation & CBR testing', unit: 'km', quantity: 1, rate: 85000, type: 'SUBCONTRACTOR' },
          { itemCode: 'RP-P-003', description: 'Site mobilization', unit: 'ls', quantity: 1, rate: 250000, type: 'MISC' },
        ],
      },
      {
        name: '2. Earthwork & Sub-grade',
        items: [
          // Composite items - RA bundles excavator + operator + labour.
          { itemCode: 'RP-E-001', description: 'Excavation in soil', unit: 'cum', quantity: 6000, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'RP-E-002', description: 'Embankment fill with selected soil (compacted)', unit: 'cum', quantity: 5000, rate: 380, type: 'MATERIAL', rateAnalysisName: 'Backfilling with Sand' },
        ],
      },
      {
        name: '3. Dry Lean Concrete (DLC) Base',
        items: [
          { itemCode: 'RP-DLC-001', description: 'DLC M15 (150mm thick)', unit: 'cum', quantity: 1275, rate: 5500, type: 'MATERIAL', rateAnalysisName: 'Dry Lean Concrete (DLC) M15' },
          { itemCode: 'RP-DLC-002', description: 'OPC cement 53 grade for DLC', unit: 'bag', quantity: 4080, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'RP-DLC-003', description: 'River sand for DLC', unit: 'cum', quantity: 574, rate: 1800, type: 'MATERIAL', resourceName: 'River Sand (Coarse)' },
          { itemCode: 'RP-DLC-004', description: '40mm aggregate for DLC', unit: 'cum', quantity: 1148, rate: 1300, type: 'MATERIAL', resourceName: '40mm Aggregate' },
          { itemCode: 'RP-DLC-005', description: 'Batching plant for DLC', unit: 'day', quantity: 8, rate: 18000, type: 'EQUIPMENT', resourceName: 'Batching Plant 30 cum/hr' },
          { itemCode: 'RP-DLC-006', description: 'Vibratory roller for DLC compaction', unit: 'day', quantity: 10, rate: 8000, type: 'EQUIPMENT', resourceName: 'Vibratory Roller 10T' },
        ],
      },
      {
        name: '4. Pavement Quality Concrete (PQC)',
        items: [
          { itemCode: 'RP-PQC-001', description: 'PQC M40 (300mm thick) supply & lay', unit: 'cum', quantity: 2550, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'Pavement Quality Concrete (PQC) M40' },
          { itemCode: 'RP-PQC-002', description: 'OPC cement 53 grade for PQC', unit: 'bag', quantity: 22950, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'RP-PQC-003', description: 'River sand for PQC', unit: 'cum', quantity: 969, rate: 1700, type: 'MATERIAL', resourceName: 'River Sand (Coarse)' },
          { itemCode: 'RP-PQC-004', description: '20mm aggregate for PQC', unit: 'cum', quantity: 1071, rate: 1400, type: 'MATERIAL', resourceName: '20mm Aggregate' },
          { itemCode: 'RP-PQC-005', description: '10mm aggregate for PQC', unit: 'cum', quantity: 1071, rate: 1350, type: 'MATERIAL', resourceName: '10mm Aggregate' },
          { itemCode: 'RP-PQC-006', description: 'Superplasticizer (PCE) for PQC', unit: 'litre', quantity: 6375, rate: 135, type: 'MATERIAL', resourceName: 'Superplasticizer (PCE Based)' },
          { itemCode: 'RP-PQC-007', description: 'Air entraining agent', unit: 'litre', quantity: 510, rate: 110, type: 'MATERIAL', resourceName: 'Air Entraining Agent' },
          { itemCode: 'RP-PQC-008', description: 'Slip form paver for PQC', unit: 'day', quantity: 12, rate: 85000, type: 'EQUIPMENT' },
          { itemCode: 'RP-PQC-009', description: 'Batching plant 60 cum/hr', unit: 'day', quantity: 12, rate: 25000, type: 'EQUIPMENT', resourceName: 'Batching Plant 60 cum/hr' },
          { itemCode: 'RP-PQC-010', description: 'Transit mixer for concrete', unit: 'trip', quantity: 450, rate: 3500, type: 'EQUIPMENT', resourceName: 'Transit Mixer 6 cum' },
        ],
      },
      {
        name: '5. Dowels, Tie Bars & Joints',
        items: [
          { itemCode: 'RP-JT-001', description: 'Dowel bars 32mm x 500mm (epoxy coated)', unit: 'nos', quantity: 4200, rate: 280, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 32mm' },
          { itemCode: 'RP-JT-002', description: 'Tie bars 12mm x 600mm', unit: 'nos', quantity: 8500, rate: 45, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 12mm' },
          { itemCode: 'RP-JT-003', description: 'Expansion joint filler board', unit: 'sqm', quantity: 85, rate: 280, type: 'MATERIAL', resourceName: 'Expansion Joint Filler Board (Bituminous) 12mm' },
          { itemCode: 'RP-JT-004', description: 'Joint sealant (silicone)', unit: 'rmt', quantity: 3500, rate: 180, type: 'MATERIAL', resourceName: 'Silicone Sealant' },
          { itemCode: 'RP-JT-005', description: 'Concrete saw for joint cutting', unit: 'day', quantity: 15, rate: 3500, type: 'EQUIPMENT' },
          { itemCode: 'RP-JT-006', description: 'Diamond blade for saw', unit: 'nos', quantity: 8, rate: 4500, type: 'MATERIAL', resourceName: 'Marble Cutting Blade 10 inch' },
        ],
      },
      {
        name: '6. Curing & Finishing',
        items: [
          { itemCode: 'RP-CR-001', description: 'Wax-based curing compound', unit: 'litre', quantity: 1700, rate: 120, type: 'MATERIAL', resourceName: 'Curing Compound (Wax Based)' },
          { itemCode: 'RP-CR-002', description: 'Hessian cloth for curing', unit: 'sqm', quantity: 8500, rate: 35, type: 'MATERIAL', resourceName: 'Curing Mats (Hessian)' },
          { itemCode: 'RP-CR-003', description: 'Water tanker for curing', unit: 'trip', quantity: 60, rate: 2200, type: 'EQUIPMENT', resourceName: 'Water Tanker 20000 L' },
          { itemCode: 'RP-CR-004', description: 'Texturing brush for surface', unit: 'nos', quantity: 12, rate: 850, type: 'MATERIAL', resourceName: 'Float (Wooden) 4ft' },
        ],
      },
      {
        name: '7. Shoulders, Drainage & Miscellaneous',
        items: [
          { itemCode: 'RP-SD-001', description: 'Earthen shoulders with gravel', unit: 'cum', quantity: 380, rate: 450, type: 'MATERIAL', resourceName: 'Moorum (Gravel)' },
          { itemCode: 'RP-SD-002', description: 'RCC kerb stones', unit: 'rmt', quantity: 2000, rate: 180, type: 'MATERIAL', resourceName: 'Kerb Stone RCC 300x150' },
          { itemCode: 'RP-SD-003', description: 'Side drains excavation', unit: 'cum', quantity: 1200, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'RP-SD-004', description: 'RCC hume pipes 600mm', unit: 'rmt', quantity: 150, rate: 2800, type: 'MATERIAL', rateAnalysisName: 'RCC Hume Pipe 600mm Installation' },
          { itemCode: 'RP-SD-005', description: 'Road marking (thermoplastic)', unit: 'rmt', quantity: 1800, rate: 180, type: 'MATERIAL', rateAnalysisName: 'Thermoplastic Road Marking' },
          { itemCode: 'RP-SD-006', description: 'Crash barrier (W-beam)', unit: 'rmt', quantity: 500, rate: 1850, type: 'MATERIAL', rateAnalysisName: 'Crash Barrier Installation (W-Beam)' },
          { itemCode: 'RP-SD-007', description: 'Diesel for equipment', unit: 'litre', quantity: 6500, rate: 88, type: 'MATERIAL', resourceName: 'Diesel (HSD)' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 3. CANAL CONSTRUCTION & LINING (1 km)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'canal-lining',
    name: 'Canal Construction & Concrete Lining (1 km)',
    description: 'Irrigation canal with excavation, embankment, PCC/RCC lining, outlets, cross drainage works',
    category: 'Infrastructure',
    sections: [
      {
        name: '1. Survey & Alignment',
        items: [
          { itemCode: 'CN-S-001', description: 'Canal alignment survey with DGPS', unit: 'km', quantity: 1, rate: 65000, type: 'SUBCONTRACTOR' },
          { itemCode: 'CN-S-002', description: 'Soil investigation along alignment', unit: 'nos', quantity: 20, rate: 8500, type: 'SUBCONTRACTOR' },
          { itemCode: 'CN-S-003', description: 'Profile leveling & marking', unit: 'km', quantity: 1, rate: 35000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '2. Excavation & Embankment',
        items: [
          // Composite items - each RA bundles the excavator + operator + labour.
          // Do NOT list equipment separately; that double-counts the RA components.
          { itemCode: 'CN-E-001', description: 'Excavation in ordinary soil (canal section)', unit: 'cum', quantity: 12000, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'CN-E-002', description: 'Excavation in hard soil', unit: 'cum', quantity: 3500, rate: 450, type: 'MATERIAL', rateAnalysisName: 'Excavation in Hard Soil' },
          { itemCode: 'CN-E-003', description: 'Excavation in soft rock', unit: 'cum', quantity: 800, rate: 750, type: 'MATERIAL', rateAnalysisName: 'Excavation in Soft Rock' },
          { itemCode: 'CN-E-007', description: 'Embankment fill with moorum (compacted)', unit: 'cum', quantity: 4500, rate: 650, type: 'MATERIAL', rateAnalysisName: 'Backfilling with Moorum' },
        ],
      },
      {
        name: '3. PCC Lining (Bed & Sides)',
        items: [
          { itemCode: 'CN-PL-001', description: 'PCC M15 lining (100mm thick) - bed', unit: 'cum', quantity: 180, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'CN-PL-002', description: 'PCC M15 lining (100mm thick) - sides', unit: 'cum', quantity: 220, rate: 5500, type: 'MATERIAL' , rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'CN-PL-003', description: 'OPC cement for PCC lining', unit: 'bag', quantity: 2560, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'CN-PL-004', description: 'River sand for PCC', unit: 'cum', quantity: 168, rate: 1800, type: 'MATERIAL', resourceName: 'River Sand (Fine)' },
          { itemCode: 'CN-PL-005', description: '20mm aggregate for PCC', unit: 'cum', quantity: 336, rate: 1400, type: 'MATERIAL', resourceName: '20mm Aggregate' },
          { itemCode: 'CN-PL-006', description: 'Concrete mixer 350L', unit: 'day', quantity: 25, rate: 2500, type: 'EQUIPMENT', resourceName: 'Concrete Mixer 350L' },
          { itemCode: 'CN-PL-007', description: 'Needle vibrator for PCC', unit: 'day', quantity: 25, rate: 700, type: 'EQUIPMENT', resourceName: 'Needle Vibrator 40mm' },
        ],
      },
      {
        name: '4. RCC Lining (Reinforced)',
        items: [
          { itemCode: 'CN-RL-001', description: 'RCC M25 lining (150mm thick) with reinforcement', unit: 'cum', quantity: 450, rate: 8500, type: 'MATERIAL', rateAnalysisName: 'RCC M25 (Foundation & Slab)' },
          { itemCode: 'CN-RL-002', description: 'TMT steel Fe500 (8mm mesh)', unit: 'kg', quantity: 18000, rate: 75, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 8mm' },
          { itemCode: 'CN-RL-003', description: 'OPC cement for RCC', unit: 'bag', quantity: 2925, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'CN-RL-004', description: 'River sand for RCC', unit: 'cum', quantity: 189, rate: 1800, type: 'MATERIAL', resourceName: 'River Sand (Fine)' },
          { itemCode: 'CN-RL-005', description: '20mm aggregate for RCC', unit: 'cum', quantity: 189, rate: 1400, type: 'MATERIAL', resourceName: '20mm Aggregate' },
          { itemCode: 'CN-RL-006', description: 'Binding wire', unit: 'kg', quantity: 180, rate: 68, type: 'MATERIAL', resourceName: 'Binding Wire 18G' },
          { itemCode: 'CN-RL-007', description: 'Concrete pump for lining', unit: 'day', quantity: 18, rate: 20000, type: 'EQUIPMENT', resourceName: 'Concrete Pump 36m Boom' },
        ],
      },
      {
        name: '5. Construction Joints & Sealing',
        items: [
          { itemCode: 'CN-JT-001', description: 'Expansion joints (every 4m)', unit: 'rmt', quantity: 2500, rate: 180, type: 'MATERIAL', resourceName: 'Expansion Joint Filler Board (Bituminous) 12mm' },
          { itemCode: 'CN-JT-002', description: 'Joint filler board', unit: 'sqm', quantity: 150, rate: 280, type: 'MATERIAL', resourceName: 'Expansion Joint Filler Board (Bituminous) 12mm' },
          { itemCode: 'CN-JT-003', description: 'Polysulphide sealant for joints', unit: 'kg', quantity: 280, rate: 450, type: 'MATERIAL', resourceName: 'Polysulphide Sealant' },
          { itemCode: 'CN-JT-004', description: 'PVC waterstop at joints', unit: 'rmt', quantity: 850, rate: 280, type: 'MATERIAL', resourceName: 'PVC Waterstop 230mm' },
        ],
      },
      {
        name: '6. Outlets & Canal Structures',
        items: [
          { itemCode: 'CN-OT-001', description: 'RCC outlet structure (turnout)', unit: 'nos', quantity: 8, rate: 45000, type: 'MATERIAL', rateAnalysisName: 'RCC M25 (Foundation & Slab)' },
          { itemCode: 'CN-OT-002', description: 'Sluice valve 300mm', unit: 'nos', quantity: 8, rate: 12000, type: 'MATERIAL', resourceName: 'Sluice Valve 80mm (CI)' },
          { itemCode: 'CN-OT-003', description: 'Cross regulator structure', unit: 'nos', quantity: 2, rate: 185000, type: 'SUBCONTRACTOR' },
          { itemCode: 'CN-OT-004', description: 'Fall structure (1.5m drop)', unit: 'nos', quantity: 3, rate: 145000, type: 'SUBCONTRACTOR' },
          { itemCode: 'CN-OT-005', description: 'Bridge crossing (farm road)', unit: 'nos', quantity: 4, rate: 85000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '7. Waterproofing & Protection',
        items: [
          { itemCode: 'CN-WP-001', description: 'Crystalline waterproofing coating', unit: 'sqm', quantity: 6000, rate: 220, type: 'MATERIAL', resourceName: 'Crystalline Waterproofing' },
          { itemCode: 'CN-WP-002', description: 'Integral waterproofing compound', unit: 'litre', quantity: 450, rate: 140, type: 'MATERIAL', resourceName: 'Integral Waterproofing Liquid' },
          { itemCode: 'CN-WP-003', description: 'Geo-textile separation layer', unit: 'sqm', quantity: 8500, rate: 45, type: 'MATERIAL', resourceName: 'Geo-textile (Non-woven) 200 GSM' },
        ],
      },
      {
        name: '8. Miscellaneous',
        items: [
          { itemCode: 'CN-M-001', description: 'Diesel for equipment', unit: 'litre', quantity: 12000, rate: 88, type: 'MATERIAL', resourceName: 'Diesel (HSD)' },
          { itemCode: 'CN-M-002', description: 'Water for construction', unit: 'kL', quantity: 1800, rate: 120, type: 'MATERIAL', resourceName: 'Water (Tanker Supply)' },
          { itemCode: 'CN-M-003', description: 'Safety equipment & PPE', unit: 'ls', quantity: 1, rate: 120000, type: 'MISC' },
          { itemCode: 'CN-M-004', description: 'Field lab for testing', unit: 'ls', quantity: 1, rate: 180000, type: 'MISC' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 4. BRIDGE / FLYOVER
  // ════════════════════════════════════════════════════════════════
  {
    id: 'bridge-flyover',
    name: 'Bridge / Flyover (2-lane, 100m span)',
    description: 'Complete RCC bridge with bored pile foundation, piers, girders, deck slab, bearings, expansion joints',
    category: 'Infrastructure',
    sections: [
      {
        name: '1. Investigation & Design',
        items: [
          { itemCode: 'BR-P-001', description: 'Geotechnical investigation (boreholes)', unit: 'nos', quantity: 6, rate: 45000, type: 'SUBCONTRACTOR' },
          { itemCode: 'BR-P-002', description: 'Hydrological study', unit: 'ls', quantity: 1, rate: 180000, type: 'SUBCONTRACTOR' },
          { itemCode: 'BR-P-003', description: 'Detailed design & drawings', unit: 'ls', quantity: 1, rate: 450000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '2. Foundation - Bored Cast-in-Situ Piles',
        items: [
          { itemCode: 'BR-PF-001', description: 'Bored pile 1200mm dia x 20m deep', unit: 'rmt', quantity: 480, rate: 8500, type: 'MATERIAL', rateAnalysisName: 'Bored Cast-In-Situ Pile 600mm (per rmt)' },
          { itemCode: 'BR-PF-002', description: 'Rotary piling rig 35T', unit: 'day', quantity: 45, rate: 145000, type: 'EQUIPMENT', resourceName: 'Rotary Piling Rig 35T (Bored)' },
          { itemCode: 'BR-PF-003', description: 'Pile casing pipe 1200mm (temporary)', unit: 'rmt', quantity: 180, rate: 6500, type: 'MATERIAL', resourceName: 'Pile Casing Pipe 1200mm (MS)' },
          { itemCode: 'BR-PF-004', description: 'Bentonite clay (piling grade)', unit: 'ton', quantity: 35, rate: 16000, type: 'MATERIAL', resourceName: 'Bentonite Clay Powder (Piling Grade) Bulk' },
          { itemCode: 'BR-PF-005', description: 'Tremie pipe for concreting', unit: 'rmt', quantity: 80, rate: 2800, type: 'MATERIAL', resourceName: 'Tremie Pipe 250mm (Flanged)' },
          { itemCode: 'BR-PF-006', description: 'TMT steel for pile reinforcement', unit: 'kg', quantity: 28800, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'BR-PF-007', description: 'Concrete for piles (M30)', unit: 'cum', quantity: 542, rate: 8500, type: 'MATERIAL', rateAnalysisName: 'Tremie Concrete M30 (Piling)' },
          { itemCode: 'BR-PF-008', description: 'Mobile crane 50T', unit: 'day', quantity: 45, rate: 35000, type: 'EQUIPMENT', resourceName: 'Mobile Crane 50T' },
        ],
      },
      {
        name: '3. Pile Caps & Pier Foundations',
        items: [
          { itemCode: 'BR-PC-001', description: 'Excavation for pile caps', unit: 'cum', quantity: 380, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'BR-PC-002', description: 'PCC 1:4:8 (100mm) blinding', unit: 'cum', quantity: 28, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'BR-PC-003', description: 'RCC M30 pile caps', unit: 'cum', quantity: 220, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'BR-PC-004', description: 'TMT steel Fe500 for pile caps', unit: 'kg', quantity: 33000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 25mm' },
          { itemCode: 'BR-PC-005', description: 'OPC cement for pile caps', unit: 'bag', quantity: 1980, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'BR-PC-006', description: 'Superplasticizer (PCE)', unit: 'litre', quantity: 550, rate: 135, type: 'MATERIAL', resourceName: 'Superplasticizer (PCE Based)' },
        ],
      },
      {
        name: '4. Piers & Pier Caps',
        items: [
          { itemCode: 'BR-PI-001', description: 'RCC M35 pier columns', unit: 'cum', quantity: 180, rate: 12000, type: 'MATERIAL', rateAnalysisName: 'RCC M35 (Heavy Structural)' },
          { itemCode: 'BR-PI-002', description: 'RCC M35 pier caps', unit: 'cum', quantity: 120, rate: 12500, type: 'MATERIAL', rateAnalysisName: 'RCC M35 (Heavy Structural)' },
          { itemCode: 'BR-PI-003', description: 'TMT steel for piers', unit: 'kg', quantity: 36000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 20mm' },
          { itemCode: 'BR-PI-004', description: 'Shuttering for piers (steel)', unit: 'sqm', quantity: 850, rate: 450, type: 'MATERIAL', resourceName: 'Shuttering Plywood 18mm Waterproof' },
          { itemCode: 'BR-PI-005', description: 'Centering plates', unit: 'nos', quantity: 120, rate: 620, type: 'MATERIAL', resourceName: 'Centering Plate 60x90cm' },
          { itemCode: 'BR-PI-006', description: 'Adjustable props', unit: 'nos', quantity: 80, rate: 850, type: 'MATERIAL', resourceName: 'Adjustable Prop 3-5m' },
          { itemCode: 'BR-PI-007', description: 'Concrete pump for pier concrete', unit: 'day', quantity: 12, rate: 25000, type: 'EQUIPMENT', resourceName: 'Concrete Pump 42m Boom' },
        ],
      },
      {
        name: '5. Bearings',
        items: [
          { itemCode: 'BR-BR-001', description: 'Elastomeric bearing pads 300x400x60mm', unit: 'nos', quantity: 48, rate: 4200, type: 'MATERIAL', resourceName: 'Elastomeric Bearing Pad 300x400x60mm' },
          { itemCode: 'BR-BR-002', description: 'Bearing installation', unit: 'nos', quantity: 48, rate: 850, type: 'LABOUR' },
        ],
      },
      {
        name: '6. Superstructure - Girders & Deck',
        items: [
          { itemCode: 'BR-SS-001', description: 'Pre-stressed concrete girders (cast & erect)', unit: 'cum', quantity: 180, rate: 22000, type: 'SUBCONTRACTOR' },
          { itemCode: 'BR-SS-002', description: 'Prestressing strands 15.2mm', unit: 'kg', quantity: 8500, rate: 155, type: 'MATERIAL', resourceName: 'Prestressing Strand 15.2mm (7-Wire) 1860 MPa' },
          { itemCode: 'BR-SS-003', description: 'HDPE ducts for post-tensioning', unit: 'rmt', quantity: 1200, rate: 180, type: 'MATERIAL', resourceName: 'HDPE Duct for Post-Tensioning 75mm' },
          { itemCode: 'BR-SS-004', description: 'Hydraulic prestressing jack', unit: 'day', quantity: 15, rate: 12000, type: 'EQUIPMENT', resourceName: 'Hydraulic Prestressing Jack 200T' },
          { itemCode: 'BR-SS-005', description: 'Post-tensioning grout pump', unit: 'day', quantity: 8, rate: 8500, type: 'EQUIPMENT', resourceName: 'Post-Tensioning Grout Pump' },
          { itemCode: 'BR-SS-006', description: 'Deck slab RCC M35', unit: 'cum', quantity: 150, rate: 12500, type: 'MATERIAL', rateAnalysisName: 'RCC M35 (Heavy Structural)' },
          { itemCode: 'BR-SS-007', description: 'Deck slab reinforcement', unit: 'kg', quantity: 22500, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
        ],
      },
      {
        name: '7. Expansion Joints & Wearing Coat',
        items: [
          { itemCode: 'BR-EJ-001', description: 'Strip seal expansion joints', unit: 'rmt', quantity: 48, rate: 8500, type: 'MATERIAL', resourceName: 'Bridge Expansion Joint (Strip Seal)' },
          { itemCode: 'BR-EJ-002', description: 'Bituminous wearing coat 75mm', unit: 'sqm', quantity: 750, rate: 850, type: 'MATERIAL', rateAnalysisName: 'BC 40mm (Bituminous Concrete)' },
          { itemCode: 'BR-EJ-003', description: 'Bitumen VG30 for wearing coat', unit: 'ton', quantity: 6, rate: 52000, type: 'MATERIAL', resourceName: 'Bitumen VG30' },
        ],
      },
      {
        name: '8. Railings, Footpath & Approach',
        items: [
          { itemCode: 'BR-RA-001', description: 'SS crash barrier railings', unit: 'rmt', quantity: 200, rate: 2800, type: 'MATERIAL', rateAnalysisName: 'Crash Barrier Installation (W-Beam)' },
          { itemCode: 'BR-RA-002', description: 'Stainless steel pipe 50mm', unit: 'rmt', quantity: 400, rate: 380, type: 'MATERIAL', resourceName: 'Stainless Steel Pipe 50mm 304' },
          { itemCode: 'BR-RA-003', description: 'RCC footpath slab', unit: 'cum', quantity: 45, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'RCC M25 (Foundation & Slab)' },
          { itemCode: 'BR-RA-004', description: 'Approach slab RCC M30', unit: 'cum', quantity: 60, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'BR-RA-005', description: 'Approach embankment fill', unit: 'cum', quantity: 850, rate: 380, type: 'MATERIAL', resourceName: 'Approach Embankment Fill (Soil)' },
        ],
      },
      {
        name: '9. River Training & Protection',
        items: [
          { itemCode: 'BR-RT-001', description: 'Gabion boxes for river training', unit: 'nos', quantity: 250, rate: 2800, type: 'MATERIAL', resourceName: 'Gabion Box 1x1x1m (PVC Coated)' },
          { itemCode: 'BR-RT-002', description: 'Boulders for gabion filling', unit: 'cum', quantity: 250, rate: 800, type: 'MATERIAL', resourceName: 'Boulder 200-300mm' },
          { itemCode: 'BR-RT-003', description: 'Geo-textile filter layer', unit: 'sqm', quantity: 1200, rate: 45, type: 'MATERIAL', resourceName: 'Geo-textile (Non-woven) 200 GSM' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 5. STORM WATER DRAINAGE SYSTEM (1 km)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'storm-drainage',
    name: 'Storm Water Drainage System (1 km)',
    description: 'Complete storm water drain with RCC pipes, manholes, catch pits, outfall structures',
    category: 'Infrastructure',
    sections: [
      {
        name: '1. Survey & Setting Out',
        items: [
          { itemCode: 'DR-S-001', description: 'Line & level survey', unit: 'km', quantity: 1, rate: 35000, type: 'SUBCONTRACTOR' },
          { itemCode: 'DR-S-002', description: 'Setting out & marking', unit: 'km', quantity: 1, rate: 18000, type: 'LABOUR' },
        ],
      },
      {
        name: '2. Excavation',
        items: [
          // Composite items - RA bundles excavator + operator + labour.
          { itemCode: 'DR-E-001', description: 'Trench excavation in ordinary soil', unit: 'cum', quantity: 2500, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'DR-E-002', description: 'Trench excavation in hard soil', unit: 'cum', quantity: 800, rate: 450, type: 'MATERIAL', rateAnalysisName: 'Excavation in Hard Soil' },
          // Dewatering & shoring are NOT part of the excavation RA - keep as separate lines.
          { itemCode: 'DR-E-004', description: 'Dewatering pump 5HP', unit: 'day', quantity: 25, rate: 800, type: 'EQUIPMENT', resourceName: 'Dewatering Pump 5HP' },
          { itemCode: 'DR-E-005', description: 'Timber shoring for deep trenches', unit: 'sqm', quantity: 450, rate: 280, type: 'MATERIAL', resourceName: 'Sal Wood' },
        ],
      },
      {
        name: '3. Bedding & Pipes',
        items: [
          { itemCode: 'DR-P-001', description: 'PCC M15 bedding (150mm)', unit: 'cum', quantity: 180, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'DR-P-002', description: 'RCC NP3 hume pipe 600mm dia', unit: 'rmt', quantity: 850, rate: 2800, type: 'MATERIAL', rateAnalysisName: 'RCC Hume Pipe 600mm Installation' },
          { itemCode: 'DR-P-003', description: 'RCC NP3 hume pipe 900mm dia', unit: 'rmt', quantity: 150, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'RCC Hume Pipe 900mm Installation' },
          { itemCode: 'DR-P-004', description: 'HDPE pipe 315mm for cross drains', unit: 'rmt', quantity: 120, rate: 1800, type: 'MATERIAL', resourceName: 'HDPE Pipe 110mm PN 6' },
          { itemCode: 'DR-P-005', description: 'Pipe collar/joint rings', unit: 'nos', quantity: 200, rate: 180, type: 'MATERIAL', resourceName: 'CPVC Coupler 25mm' },
          { itemCode: 'DR-P-006', description: 'OPC cement for bedding', unit: 'bag', quantity: 720, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
        ],
      },
      {
        name: '4. Manholes & Chambers',
        items: [
          { itemCode: 'DR-MH-001', description: 'RCC manhole (1.5x1.0m) complete', unit: 'nos', quantity: 25, rate: 38500, type: 'SUBCONTRACTOR' },
          { itemCode: 'DR-MH-002', description: 'Precast manhole cover heavy duty', unit: 'nos', quantity: 25, rate: 3500, type: 'MATERIAL', resourceName: 'Precast Manhole Cover (Heavy Duty) 600x600' },
          { itemCode: 'DR-MH-003', description: 'Catch pit (0.6x0.6x0.9m)', unit: 'nos', quantity: 40, rate: 8500, type: 'SUBCONTRACTOR' },
          { itemCode: 'DR-MH-004', description: 'Gully grating 300x300 CI', unit: 'nos', quantity: 40, rate: 1800, type: 'MATERIAL', resourceName: 'Precast Gully Grating 300x300 (CI)' },
          { itemCode: 'DR-MH-005', description: 'Steps (M.S.) for manholes', unit: 'nos', quantity: 150, rate: 280, type: 'MATERIAL', resourceName: 'MS Flat 25x3mm' },
        ],
      },
      {
        name: '5. Backfilling & Restoration',
        items: [
          // Composite item - RA bundles sand + plate compactor + labour.
          { itemCode: 'DR-BF-002', description: 'Backfilling with sand around pipes (compacted)', unit: 'cum', quantity: 350, rate: 1700, type: 'MATERIAL', rateAnalysisName: 'Backfilling with Sand' },
          { itemCode: 'DR-BF-004', description: 'Road surface restoration (BC)', unit: 'sqm', quantity: 1800, rate: 420, type: 'MATERIAL', rateAnalysisName: 'BC 40mm (Bituminous Concrete)' },
        ],
      },
      {
        name: '6. Outfall Structure',
        items: [
          { itemCode: 'DR-OF-001', description: 'RCC outfall structure', unit: 'nos', quantity: 2, rate: 85000, type: 'SUBCONTRACTOR' },
          { itemCode: 'DR-OF-002', description: 'Energy dissipater blocks', unit: 'cum', quantity: 15, rate: 8200, type: 'MATERIAL', resourceName: 'Energy Dissipater Block (Concrete)' },
          { itemCode: 'DR-OF-003', description: 'Stone pitching for outfall', unit: 'sqm', quantity: 280, rate: 850, type: 'MATERIAL', resourceName: 'Stone Pitching (Rubble)' },
        ],
      },
    ],
  },
];