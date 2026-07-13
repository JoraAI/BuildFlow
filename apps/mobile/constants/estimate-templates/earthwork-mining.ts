/**
 * Earthwork & Mining Estimate Templates - Gravel Extraction, Quarry, Earthwork
 */
import type { EstimateTemplate } from './types';

export const EARTHWORK_TEMPLATES: EstimateTemplate[] = [
  // ════════════════════════════════════════════════════════════════
  // 1. EARTHWORK & GRAVEL EXTRACTION
  // ════════════════════════════════════════════════════════════════
  {
    id: 'earthwork-gravel-extraction',
    name: 'Earthwork & Gravel Extraction (10,000 cum)',
    description: 'Complete earthwork project - stripping, excavation, loading, hauling, screening, stockpiling',
    category: 'Earthwork',
    sections: [
      {
        name: '1. Site Preparation',
        items: [
          { itemCode: 'EW-P-001', description: 'Topographic survey', unit: 'ha', quantity: 5, rate: 35000, type: 'SUBCONTRACTOR' },
          { itemCode: 'EW-P-002', description: 'Vegetation clearing & grubbing', unit: 'sqm', quantity: 5000, rate: 28, type: 'LABOUR' },
          { itemCode: 'EW-P-003', description: 'Access road construction', unit: 'km', quantity: 0.5, rate: 450000, type: 'SUBCONTRACTOR' },
          { itemCode: 'EW-P-004', description: 'Site office setup', unit: 'ls', quantity: 1, rate: 120000, type: 'MISC', resourceName: 'Modular Site Office (Container) 20ft' },
        ],
      },
      {
        name: '2. Topsoil Stripping',
        items: [
          { itemCode: 'EW-TS-001', description: 'Topsoil stripping (200mm)', unit: 'cum', quantity: 1000, rate: 180, type: 'MATERIAL' },
          { itemCode: 'EW-TS-002', description: 'Bulldozer D6R for stripping', unit: 'day', quantity: 5, rate: 22000, type: 'EQUIPMENT', resourceName: 'Bull Dozer D6R' },
          { itemCode: 'EW-TS-003', description: 'Tipper for topsoil hauling', unit: 'trip', quantity: 85, rate: 1800, type: 'EQUIPMENT', resourceName: 'Tipper / Dumper 10 cum (Local)' },
          { itemCode: 'EW-TS-004', description: 'Topsoil stockpiling area prep', unit: 'ls', quantity: 1, rate: 45000, type: 'MISC' },
        ],
      },
      {
        name: '3. Excavation (Soil)',
        items: [
          { itemCode: 'EW-EX-001', description: 'Excavation in ordinary soil', unit: 'cum', quantity: 6000, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'EW-EX-002', description: 'Excavation in hard soil', unit: 'cum', quantity: 2000, rate: 450, type: 'MATERIAL', rateAnalysisName: 'Excavation in Hard Soil' },
          { itemCode: 'EW-EX-003', description: 'Excavation in soft rock', unit: 'cum', quantity: 1500, rate: 750, type: 'MATERIAL', rateAnalysisName: 'Excavation in Soft Rock' },
          { itemCode: 'EW-EX-004', description: 'Excavation in hard rock (blasting)', unit: 'cum', quantity: 500, rate: 1200, type: 'MATERIAL', rateAnalysisName: 'Excavation in Hard Rock (Chiselling)' },
          { itemCode: 'EW-EX-005', description: 'Excavator 20T', unit: 'day', quantity: 45, rate: 28000, type: 'EQUIPMENT', resourceName: 'Excavator 20T (PC200)' },
          { itemCode: 'EW-EX-006', description: 'Excavator PC130', unit: 'day', quantity: 30, rate: 18000, type: 'EQUIPMENT', resourceName: 'Excavator PC130' },
          { itemCode: 'EW-EX-007', description: 'Bulldozer for pushing', unit: 'day', quantity: 20, rate: 22000, type: 'EQUIPMENT', resourceName: 'Bull Dozer D6R' },
        ],
      },
      {
        name: '4. Loading & Hauling',
        items: [
          { itemCode: 'EW-LH-001', description: 'Loading with excavator', unit: 'cum', quantity: 10000, rate: 45, type: 'EQUIPMENT' },
          { itemCode: 'EW-LH-002', description: 'Tipper hauling (avg 5km lead)', unit: 'trip', quantity: 850, rate: 2500, type: 'EQUIPMENT', resourceName: 'Tipper / Dumper 16 cum (Local)' },
          { itemCode: 'EW-LH-003', description: 'Diesel for fleet', unit: 'litre', quantity: 18000, rate: 88, type: 'MATERIAL', resourceName: 'Diesel (HSD)' },
          { itemCode: 'EW-LH-004', description: 'Equipment operators', unit: 'day', quantity: 120, rate: 1500, type: 'LABOUR', resourceName: 'JCB / Excavator Operator' },
        ],
      },
      {
        name: '5. Screening & Processing',
        items: [
          { itemCode: 'EW-SC-001', description: 'Vibrating screen (3-deck) hire', unit: 'day', quantity: 25, rate: 18000, type: 'EQUIPMENT' },
          { itemCode: 'EW-SC-002', description: 'Jaw crusher 200 TPH hire', unit: 'day', quantity: 15, rate: 45000, type: 'EQUIPMENT' },
          { itemCode: 'EW-SC-003', description: 'Conveyor belts', unit: 'day', quantity: 25, rate: 8500, type: 'EQUIPMENT' },
          { itemCode: 'EW-SC-004', description: 'Wheel loader 1.5 cum', unit: 'day', quantity: 25, rate: 15000, type: 'EQUIPMENT' },
          { itemCode: 'EW-SC-005', description: 'Screened gravel 40mm', unit: 'cum', quantity: 3000, rate: 280, type: 'MATERIAL' },
          { itemCode: 'EW-SC-006', description: 'Screened gravel 20mm', unit: 'cum', quantity: 2500, rate: 300, type: 'MATERIAL' },
          { itemCode: 'EW-SC-007', description: 'Crushed aggregate 12.5mm', unit: 'cum', quantity: 1800, rate: 850, type: 'MATERIAL' },
        ],
      },
      {
        name: '6. Stockpiling & Dispatch',
        items: [
          { itemCode: 'EW-ST-001', description: 'Stockyard preparation', unit: 'sqm', quantity: 2000, rate: 180, type: 'MISC' },
          { itemCode: 'EW-ST-002', description: 'Wheel loader for stockpile', unit: 'day', quantity: 20, rate: 15000, type: 'EQUIPMENT' },
          { itemCode: 'EW-ST-003', description: 'Weighbridge operation', unit: 'month', quantity: 2, rate: 85000, type: 'SUBCONTRACTOR' },
          { itemCode: 'EW-ST-004', description: 'Loading for dispatch', unit: 'cum', quantity: 7300, rate: 45, type: 'EQUIPMENT' },
        ],
      },
      {
        name: '7. Dewatering & Environmental',
        items: [
          { itemCode: 'EW-DW-001', description: 'Dewatering pump 10HP', unit: 'day', quantity: 60, rate: 1200, type: 'EQUIPMENT', resourceName: 'Dewatering Pump 10HP' },
          { itemCode: 'EW-DW-002', description: 'Diesel for dewatering', unit: 'litre', quantity: 1800, rate: 88, type: 'MATERIAL', resourceName: 'Diesel (HSD)' },
          { itemCode: 'EW-DW-003', description: 'Dust suppression (water spray)', unit: 'kL', quantity: 850, rate: 150, type: 'MATERIAL' },
          { itemCode: 'EW-DW-004', description: 'Environmental monitoring', unit: 'month', quantity: 2, rate: 85000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
];