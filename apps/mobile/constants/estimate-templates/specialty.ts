/**
 * Specialty Estimate Templates - Demolition, Renovation, Landscape
 */
import type { EstimateTemplate } from './types';

export const SPECIALTY_TEMPLATES: EstimateTemplate[] = [
  // ════════════════════════════════════════════════════════════════
  // 1. RENOVATION & REPAIR PROJECT
  // ════════════════════════════════════════════════════════════════
  {
    id: 'renovation-repair',
    name: 'Building Renovation & Repair',
    description: 'Complete renovation - structural repair, waterproofing, new finishes, MEP upgrade',
    category: 'Specialty',
    sections: [
      {
        name: '1. Condition Survey & Demolition',
        items: [
          { itemCode: 'RN-P-001', description: 'Structural condition survey (NDT)', unit: 'ls', quantity: 1, rate: 180000, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-P-002', description: 'Rebound hammer testing', unit: 'nos', quantity: 50, rate: 1200, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-P-003', description: 'Core cutting & testing', unit: 'nos', quantity: 12, rate: 8500, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-P-004', description: 'Dismantling damaged plaster', unit: 'sqm', quantity: 850, rate: 120, type: 'LABOUR' },
          { itemCode: 'RN-P-005', description: 'Dismantling damaged RCC', unit: 'cum', quantity: 8, rate: 2800, type: 'LABOUR' },
          { itemCode: 'RN-P-006', description: 'Demolition hammer hire', unit: 'day', quantity: 15, rate: 800, type: 'EQUIPMENT', resourceName: 'Breaker / Demolition Hammer' },
          { itemCode: 'RN-P-007', description: 'Debris hauling', unit: 'trip', quantity: 35, rate: 1800, type: 'EQUIPMENT', resourceName: 'Tipper / Dumper 10 cum (Local)' },
        ],
      },
      {
        name: '2. Structural Repair',
        items: [
          { itemCode: 'RN-SR-001', description: 'Column jacketing RCC M30', unit: 'cum', quantity: 6, rate: 15000, type: 'MATERIAL' },
          { itemCode: 'RN-SR-002', description: 'Column jacketing reinforcement', unit: 'kg', quantity: 480, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'RN-SR-003', description: 'Epoxy injection (crack repair)', unit: 'rmt', quantity: 250, rate: 850, type: 'MATERIAL', resourceName: 'Epoxy Adhesive (Structural)' },
          { itemCode: 'RN-SR-004', description: 'Non-shrink grout (column base)', unit: 'bag', quantity: 45, rate: 950, type: 'MATERIAL', resourceName: 'Non-Shrink Grout (Cementitious)' },
          { itemCode: 'RN-SR-005', description: 'Carbon fiber wrapping', unit: 'sqm', quantity: 45, rate: 4500, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-SR-006', description: 'Micro-concrete for repair', unit: 'cum', quantity: 4, rate: 12000, type: 'MATERIAL', resourceName: 'Micro-concrete (Non-Shrink)' },
        ],
      },
      {
        name: '3. Waterproofing Repair',
        items: [
          { itemCode: 'RN-WR-001', description: 'Terrace waterproofing (APP membrane)', unit: 'sqm', quantity: 320, rate: 650, type: 'MATERIAL', rateAnalysisName: 'APP Membrane Terrace Waterproofing' },
          { itemCode: 'RN-WR-002', description: 'Crystalline waterproofing (walls)', unit: 'sqm', quantity: 450, rate: 320, type: 'MATERIAL', resourceName: 'Crystalline Waterproofing' },
          { itemCode: 'RN-WR-003', description: 'Bathroom waterproofing (SBR)', unit: 'sqm', quantity: 85, rate: 450, type: 'MATERIAL', rateAnalysisName: 'Toilet Waterproofing (SBR + Tiles)' },
          { itemCode: 'RN-WR-004', description: 'Sump tank waterproofing', unit: 'sqm', quantity: 45, rate: 650, type: 'MATERIAL', rateAnalysisName: 'Sump Tank Waterproofing (Crystalline)' },
        ],
      },
      {
        name: '4. New Plastering',
        items: [
          { itemCode: 'RN-PT-001', description: 'Internal plaster 12mm (CM 1:4)', unit: 'sqm', quantity: 850, rate: 185, type: 'LABOUR', rateAnalysisName: 'Internal Plaster 12mm CM 1:4' },
          { itemCode: 'RN-PT-002', description: 'External plaster 18mm (waterproof)', unit: 'sqm', quantity: 420, rate: 220, type: 'LABOUR', rateAnalysisName: 'External Plaster 18mm (Waterproof)' },
          { itemCode: 'RN-PT-003', description: 'OPC cement for plaster', unit: 'bag', quantity: 180, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
        ],
      },
      {
        name: '5. New Flooring',
        items: [
          { itemCode: 'RN-FL-001', description: 'Vitrified tile flooring (overlay)', unit: 'sqft', quantity: 1200, rate: 55, type: 'MATERIAL', resourceName: 'Vitrified Tile 600x600 Polished' },
          { itemCode: 'RN-FL-002', description: 'Tile adhesive (premium)', unit: 'bag', quantity: 35, rate: 420, type: 'MATERIAL', resourceName: 'Tile Adhesive (Premium)' },
          { itemCode: 'RN-FL-003', description: 'Self-leveling compound (floor prep)', unit: 'bag', quantity: 25, rate: 650, type: 'MATERIAL', resourceName: 'Self-Leveling Compound' },
        ],
      },
      {
        name: '6. Painting',
        items: [
          { itemCode: 'RN-PN-001', description: 'Wall putty (internal)', unit: 'bag', quantity: 25, rate: 580, type: 'MATERIAL', resourceName: 'Wall Putty (Cement Based)' },
          { itemCode: 'RN-PN-002', description: 'Primer (acrylic)', unit: 'litre', quantity: 35, rate: 220, type: 'MATERIAL', resourceName: 'Primer (Acrylic)' },
          { itemCode: 'RN-PN-003', description: 'Interior emulsion (premium)', unit: 'litre', quantity: 85, rate: 380, type: 'MATERIAL', resourceName: 'Interior Emulsion (Premium)' },
          { itemCode: 'RN-PN-004', description: 'Exterior emulsion (premium)', unit: 'litre', quantity: 45, rate: 420, type: 'MATERIAL', resourceName: 'Exterior Emulsion Paint (Premium)' },
          { itemCode: 'RN-PN-005', description: 'Enamel paint (doors/windows)', unit: 'litre', quantity: 18, rate: 350, type: 'MATERIAL', resourceName: 'Enamel Paint (Oil Based)' },
        ],
      },
      {
        name: '7. MEP Upgrade',
        items: [
          { itemCode: 'RN-MEP-001', description: 'Electrical rewiring (partial)', unit: 'ls', quantity: 1, rate: 185000, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-MEP-002', description: 'LED lighting upgrade', unit: 'ls', quantity: 1, rate: 120000, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-MEP-003', description: 'Plumbing replacement (galvanized pipes)', unit: 'ls', quantity: 1, rate: 145000, type: 'SUBCONTRACTOR' },
          { itemCode: 'RN-MEP-004', description: 'New sanitary fixtures', unit: 'ls', quantity: 1, rate: 85000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 2. LANDSCAPE & SITE DEVELOPMENT
  // ════════════════════════════════════════════════════════════════
  {
    id: 'landscape-site-dev',
    name: 'Landscape & Site Development (2000 sqm)',
    description: 'Complete landscaping - grading, lawns, trees, irrigation, pathways, lighting, seating',
    category: 'Specialty',
    sections: [
      {
        name: '1. Site Grading & Preparation',
        items: [
          { itemCode: 'LS-P-001', description: 'Site grading & leveling', unit: 'sqm', quantity: 2000, rate: 85, type: 'LABOUR' },
          { itemCode: 'LS-P-002', description: 'JCB for grading', unit: 'day', quantity: 5, rate: 12000, type: 'EQUIPMENT', resourceName: 'JCB Excavator 3DX' },
          { itemCode: 'LS-P-003', description: 'Topsoil spreading (300mm)', unit: 'cum', quantity: 600, rate: 450, type: 'MATERIAL', resourceName: 'Topsoil (Screened)' },
          { itemCode: 'LS-P-004', description: 'Soil testing & amendment', unit: 'ls', quantity: 1, rate: 45000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '2. Lawns & Turf',
        items: [
          { itemCode: 'LS-LW-001', description: 'Natural lawn grass (roll)', unit: 'sqm', quantity: 800, rate: 85, type: 'MATERIAL', resourceName: 'Natural Lawn Grass (Roll)' },
          { itemCode: 'LS-LW-002', description: 'Garden soil mix (compost)', unit: 'cum', quantity: 80, rate: 1200, type: 'MATERIAL', resourceName: 'Garden Soil Mix (Compost)' },
          { itemCode: 'LS-LW-003', description: 'Lawn seeding (maintenance)', unit: 'sqm', quantity: 800, rate: 45, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '3. Trees & Plants',
        items: [
          { itemCode: 'LS-TP-001', description: 'Ornamental trees (8-10ft)', unit: 'nos', quantity: 25, rate: 3500, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-TP-002', description: 'Shrubs & hedges', unit: 'nos', quantity: 150, rate: 850, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-TP-003', description: 'Flowering plants', unit: 'nos', quantity: 200, rate: 450, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-TP-004', description: 'Mulch (organic bark)', unit: 'cum', quantity: 15, rate: 950, type: 'MATERIAL', resourceName: 'Mulch (Organic Bark)' },
        ],
      },
      {
        name: '4. Irrigation System',
        items: [
          { itemCode: 'LS-IR-001', description: 'Drip irrigation pipe 16mm', unit: 'rmt', quantity: 850, rate: 18, type: 'MATERIAL', resourceName: 'Drip Irrigation Pipe 16mm' },
          { itemCode: 'LS-IR-002', description: 'Drip emitters 4 LPH', unit: 'nos', quantity: 350, rate: 8, type: 'MATERIAL', resourceName: 'Drip Emitter 4 LPH' },
          { itemCode: 'LS-IR-003', description: 'Pop-up sprinklers', unit: 'nos', quantity: 45, rate: 280, type: 'MATERIAL', resourceName: 'Sprinkler Head (Pop-up)' },
          { itemCode: 'LS-IR-004', description: 'Irrigation controller (auto)', unit: 'nos', quantity: 1, rate: 18000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '5. Hardscape - Pathways & Decking',
        items: [
          { itemCode: 'LS-HS-001', description: 'Interlocking paver blocks 60mm', unit: 'sqm', quantity: 350, rate: 650, type: 'MATERIAL', resourceName: 'Interlocking Paver Block 60mm' },
          { itemCode: 'LS-HS-002', description: 'Natural flagstone pathway', unit: 'sqft', quantity: 280, rate: 65, type: 'MATERIAL', resourceName: 'Natural Flagstone 300x300x25mm (Sandstone)' },
          { itemCode: 'LS-HS-003', description: 'Wooden deck (exterior)', unit: 'sqm', quantity: 45, rate: 2800, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-HS-004', description: 'Garden edging (stone)', unit: 'rmt', quantity: 180, rate: 180, type: 'MATERIAL', resourceName: 'Garden Edging (Stone)' },
        ],
      },
      {
        name: '6. Lighting & Features',
        items: [
          { itemCode: 'LS-LT-001', description: 'Garden bollard lights LED', unit: 'nos', quantity: 18, rate: 3500, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-LT-002', description: 'Underground electrical cable', unit: 'rmt', quantity: 280, rate: 280, type: 'MATERIAL' },
          { itemCode: 'LS-LT-003', description: 'Water feature (fountain)', unit: 'nos', quantity: 1, rate: 185000, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-LT-004', description: 'Seating benches (outdoor)', unit: 'nos', quantity: 8, rate: 8500, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-LT-005', description: 'Children play area equipment', unit: 'ls', quantity: 1, rate: 250000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '7. Drainage',
        items: [
          { itemCode: 'LS-DR-001', description: 'French drain', unit: 'rmt', quantity: 120, rate: 850, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-DR-002', description: 'Channel drain with grating', unit: 'rmt', quantity: 85, rate: 1200, type: 'SUBCONTRACTOR' },
          { itemCode: 'LS-DR-003', description: 'Soak pit', unit: 'nos', quantity: 2, rate: 15000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
];