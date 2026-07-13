/**
 * Legacy estimate templates - kept for backward compatibility.
 * These are the original 3 templates (residential, office renovation, road).
 * New comprehensive templates are in the estimate-templates/ directory.
 */
import type { EstimateTemplate } from './estimate-templates/types';

export const LEGACY_TEMPLATES: EstimateTemplate[] = [
  {
    id: 'residential-g2',
    name: 'Residential Building (G+2) - Legacy',
    description: 'Original template: RCC framed structure (will be superseded by expanded version)',
    category: 'Buildings',
    sections: [
      {
        name: 'Substructure',
        items: [
          { itemCode: 'E-001', description: 'Site clearing & levelling', unit: 'sqm', quantity: 200, rate: 45, type: 'LABOUR' },
          { itemCode: 'E-002', description: 'Excavation in ordinary soil', unit: 'cum', quantity: 120, rate: 380, type: 'LABOUR' },
          { itemCode: 'E-003', description: 'PCC 1:4:8 (100mm)', unit: 'cum', quantity: 18, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'E-004', description: 'RCC M25 in footings', unit: 'cum', quantity: 32, rate: 7800, type: 'MATERIAL', rateAnalysisName: 'RCC M25 with Fe500 TMT' },
          { itemCode: 'E-005', description: 'Waterproofing for basement/footing', unit: 'sqm', quantity: 85, rate: 420, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: 'Superstructure',
        items: [
          { itemCode: 'E-010', description: 'RCC M25 columns & beams', unit: 'cum', quantity: 95, rate: 8200, type: 'MATERIAL' },
          { itemCode: 'E-011', description: 'RCC M25 slabs (150mm)', unit: 'cum', quantity: 68, rate: 7900, type: 'MATERIAL' },
          { itemCode: 'E-012', description: 'Brick masonry (230mm)', unit: 'cum', quantity: 140, rate: 5800, type: 'MATERIAL' },
          { itemCode: 'E-013', description: 'Centering & shuttering', unit: 'sqm', quantity: 2200, rate: 280, type: 'LABOUR' },
          { itemCode: 'E-014', description: 'Tower crane hire (monthly)', unit: 'month', quantity: 8, rate: 185000, type: 'EQUIPMENT' },
        ],
      },
      {
        name: 'Finishing',
        items: [
          { itemCode: 'E-020', description: 'Internal plaster (12mm cement)', unit: 'sqm', quantity: 3200, rate: 185, type: 'LABOUR' },
          { itemCode: 'E-021', description: 'External texture paint', unit: 'sqm', quantity: 980, rate: 95, type: 'MATERIAL' },
          { itemCode: 'E-022', description: 'Vitrified flooring 600×600', unit: 'sqm', quantity: 1850, rate: 420, type: 'MATERIAL' },
          { itemCode: 'E-023', description: 'Aluminium windows & doors', unit: 'sqm', quantity: 420, rate: 1850, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: 'MEP',
        items: [
          { itemCode: 'E-030', description: 'Electrical wiring & DB (lumpsum)', unit: 'ls', quantity: 1, rate: 850000, type: 'SUBCONTRACTOR' },
          { itemCode: 'E-031', description: 'Plumbing & sanitary fixtures', unit: 'ls', quantity: 1, rate: 620000, type: 'SUBCONTRACTOR' },
          { itemCode: 'E-032', description: 'Fire fighting system', unit: 'ls', quantity: 1, rate: 280000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
  {
    id: 'office-renovation',
    name: 'Office Renovation - Legacy',
    description: 'Original template: Commercial office fit-out (will be expanded)',
    category: 'Buildings',
    sections: [
      {
        name: 'Demolition & Prep',
        items: [
          { itemCode: 'O-001', description: 'Dismantling existing partitions', unit: 'sqm', quantity: 450, rate: 120, type: 'LABOUR' },
          { itemCode: 'O-002', description: 'Floor protection & debris removal', unit: 'ls', quantity: 1, rate: 85000, type: 'MISC' },
        ],
      },
      {
        name: 'Partitions & Ceiling',
        items: [
          { itemCode: 'O-010', description: 'Gypsum board partition (100mm)', unit: 'sqm', quantity: 680, rate: 520, type: 'MATERIAL' },
          { itemCode: 'O-011', description: 'Grid false ceiling with tiles', unit: 'sqm', quantity: 1200, rate: 380, type: 'MATERIAL' },
          { itemCode: 'O-012', description: 'Glass conference room partition', unit: 'sqm', quantity: 45, rate: 4200, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: 'Flooring & Paint',
        items: [
          { itemCode: 'O-020', description: 'Carpet tiles (commercial grade)', unit: 'sqm', quantity: 950, rate: 680, type: 'MATERIAL', resourceName: 'Commercial Carpet Tile' },
          { itemCode: 'O-021', description: 'Emulsion paint - walls & ceiling', unit: 'sqm', quantity: 2800, rate: 65, type: 'MATERIAL', rateAnalysisName: 'Emulsion paint per sqm' },
        ],
      },
      {
        name: 'MEP & IT',
        items: [
          { itemCode: 'O-030', description: 'HVAC cassette units (supply + install)', unit: 'nos', quantity: 24, rate: 42000, type: 'SUBCONTRACTOR' },
          { itemCode: 'O-031', description: 'LED lighting & controls', unit: 'ls', quantity: 1, rate: 320000, type: 'SUBCONTRACTOR' },
          { itemCode: 'O-032', description: 'Network cabling & workstations power', unit: 'ls', quantity: 1, rate: 185000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
  {
    id: 'road-work',
    name: 'Road & Drainage - Legacy',
    description: 'Original template: Basic road (superseded by comprehensive Highway templates)',
    category: 'Infrastructure',
    sections: [
      {
        name: 'Earthwork & Sub-grade',
        items: [
          { itemCode: 'R-001', description: 'Clearing & grubbing', unit: 'km', quantity: 1.2, rate: 85000, type: 'LABOUR' },
          { itemCode: 'R-002', description: 'Excavation in soil for road formation', unit: 'cum', quantity: 850, rate: 320, type: 'LABOUR' },
          { itemCode: 'R-003', description: 'Granular Sub-Base (GSB) 200mm', unit: 'cum', quantity: 420, rate: 1450, type: 'MATERIAL' },
        ],
      },
      {
        name: 'Pavement',
        items: [
          { itemCode: 'R-010', description: 'WMM 250mm compacted', unit: 'cum', quantity: 380, rate: 2100, type: 'MATERIAL' },
          { itemCode: 'R-011', description: 'DBM 50mm', unit: 'cum', quantity: 95, rate: 9800, type: 'MATERIAL' },
          { itemCode: 'R-012', description: 'BC 25mm', unit: 'cum', quantity: 48, rate: 11200, type: 'MATERIAL' },
          { itemCode: 'R-013', description: 'Road roller hire', unit: 'day', quantity: 45, rate: 8500, type: 'EQUIPMENT' },
        ],
      },
      {
        name: 'Drainage',
        items: [
          { itemCode: 'R-020', description: 'RCC NP3 hume pipes 600mm', unit: 'rm', quantity: 320, rate: 2800, type: 'MATERIAL' },
          { itemCode: 'R-021', description: 'Manholes & chambers', unit: 'nos', quantity: 18, rate: 18500, type: 'MATERIAL' },
        ],
      },
    ],
  },
];