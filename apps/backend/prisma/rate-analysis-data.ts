/**
 * BuildFlow - Composite Rate Analysis Data
 *
 * ~80+ composite rate analyses covering all major construction works.
 * Each RA references catalog items by name (matched in seed via resources map).
 *
 * Component quantities are per unit of the rate analysis (e.g., per cum, per sqm, per sqft).
 */
import { CostType } from '@prisma/client';

export interface RaComponent {
  resourceName?: string;
  miscName?: string;
  quantityPerUnit: number;
  unit: string;
  rate: number;
  type: CostType;
}

export interface RaTemplate {
  name: string;
  unit: string;
  description: string;
  components: RaComponent[];
}

export const RATE_ANALYSES: RaTemplate[] = [
  // ════════════════════════════════════════════════════════════════
  // CONCRETE WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'PCC M5 (1:5:10)',
    unit: 'cum',
    description: 'Plain cement concrete M5 grade (lean mix for blinding)',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 2.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.45, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '40mm Aggregate', quantityPerUnit: 0.90, unit: 'cum', rate: 1300, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.2, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 200L', quantityPerUnit: 0.2, unit: 'day', rate: 1800, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'PCC M7.5 (1:4:8)',
    unit: 'cum',
    description: 'Plain cement concrete M7.5 grade',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 2.6, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.45, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '40mm Aggregate', quantityPerUnit: 0.90, unit: 'cum', rate: 1300, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.3, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 200L', quantityPerUnit: 0.25, unit: 'day', rate: 1800, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'PCC M10 (1:3:6)',
    unit: 'cum',
    description: 'Plain cement concrete M10 grade',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 3.2, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.44, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.88, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.4, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 200L', quantityPerUnit: 0.25, unit: 'day', rate: 1800, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'PCC M20',
    unit: 'cum',
    description: 'Plain cement concrete M20 grade',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 5.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 350L', quantityPerUnit: 0.3, unit: 'day', rate: 2500, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'RCC M15',
    unit: 'cum',
    description: 'Reinforced cement concrete M15 grade',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 4.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 16mm', quantityPerUnit: 60, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 0.8, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Cover Blocks (PVC) 25mm', quantityPerUnit: 4, unit: 'piece', rate: 3, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.6, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 200L', quantityPerUnit: 0.25, unit: 'day', rate: 1800, type: CostType.EQUIPMENT },
      { resourceName: 'Needle Vibrator 40mm', quantityPerUnit: 0.4, unit: 'day', rate: 700, type: CostType.EQUIPMENT },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 700, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC M30',
    unit: 'cum',
    description: 'Reinforced cement concrete M30 grade (high-rise structural)',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.40, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.40, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 120, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 2.0, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.8, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Cover Blocks (PVC) 40mm', quantityPerUnit: 5, unit: 'piece', rate: 3.5, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.9, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.8, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 350L', quantityPerUnit: 0.25, unit: 'day', rate: 2500, type: CostType.EQUIPMENT },
      { resourceName: 'Needle Vibrator 60mm', quantityPerUnit: 0.5, unit: 'day', rate: 800, type: CostType.EQUIPMENT },
      { miscName: 'Shuttering & Formwork', quantityPerUnit: 1, unit: 'ls', rate: 1100, type: CostType.MISC },
      { miscName: 'Electricity & Water', quantityPerUnit: 1, unit: 'ls', rate: 55, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC M35',
    unit: 'cum',
    description: 'Reinforced cement concrete M35 grade',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.40, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 130, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 2.5, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 2.0, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 1.0, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 350L', quantityPerUnit: 0.3, unit: 'day', rate: 2500, type: CostType.EQUIPMENT },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1200, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC M40',
    unit: 'cum',
    description: 'Reinforced cement concrete M40 grade (high performance)',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 9.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.38, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'GGBS (Ground Granulated Blast Slag)', quantityPerUnit: 30, unit: 'kg', rate: 4.5, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 140, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 3.0, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 1.0, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.2, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1300, type: CostType.MISC },
    ],
  },
  {
    name: 'Shotcrete (Gunite) M25',
    unit: 'cum',
    description: 'Sprayed concrete (dry mix) for slope stabilization / tunnel lining',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.50, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.50, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'Accelerating Admixture', quantityPerUnit: 3.0, unit: 'litre', rate: 90, type: CostType.MATERIAL },
      { resourceName: 'Steel Fibres for Concrete', quantityPerUnit: 40, unit: 'kg', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Guniting / Shotcrete Machine', quantityPerUnit: 0.5, unit: 'day', rate: 4500, type: CostType.EQUIPMENT },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.5, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.5, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Tremie Concrete M25 (Piling)',
    unit: 'cum',
    description: 'Underwater concrete for cast-in-situ pile foundations',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.44, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.44, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.44, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'Retarding Admixture', quantityPerUnit: 2.0, unit: 'litre', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (SNF Based)', quantityPerUnit: 2.5, unit: 'litre', rate: 95, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // MASONRY WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Brick Masonry 115mm CM 1:6',
    unit: 'sqm',
    description: 'Half-brick (115mm) masonry in cement mortar 1:6',
    components: [
      { resourceName: 'Fly Ash Brick 230x110x75', quantityPerUnit: 28, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.25, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.015, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.18, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.25, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Brick Masonry 230mm CM 1:4',
    unit: 'sqm',
    description: 'Full brick (230mm) masonry in richer mortar 1:4',
    components: [
      { resourceName: 'Fly Ash Brick 230x110x75', quantityPerUnit: 56, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.75, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.04, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.35, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.50, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Brick Masonry 345mm CM 1:6',
    unit: 'sqm',
    description: 'One-and-half brick (345mm) masonry in CM 1:6',
    components: [
      { resourceName: 'Fly Ash Brick 230x110x75', quantityPerUnit: 84, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.75, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.045, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.50, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.75, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'AAC Block Masonry 150mm',
    unit: 'sqm',
    description: 'AAC block 150mm wall with thin-bed adhesive',
    components: [
      { resourceName: 'AAC Block 600x200x150mm', quantityPerUnit: 8.5, unit: 'piece', rate: 75, type: CostType.MATERIAL },
      { resourceName: 'Block Fixing Adhesive', quantityPerUnit: 0.5, unit: 'bag', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.15, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.20, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'AAC Block Masonry 200mm',
    unit: 'sqm',
    description: 'AAC block 200mm external wall with thin bed adhesive',
    components: [
      { resourceName: 'AAC Block 600x200x200mm', quantityPerUnit: 8.5, unit: 'piece', rate: 95, type: CostType.MATERIAL },
      { resourceName: 'Block Fixing Adhesive', quantityPerUnit: 0.5, unit: 'bag', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.15, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.20, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'AAC Block Masonry 250mm',
    unit: 'sqm',
    description: 'AAC block 250mm external wall with adhesive',
    components: [
      { resourceName: 'AAC Block 600x200x250mm', quantityPerUnit: 8.5, unit: 'piece', rate: 115, type: CostType.MATERIAL },
      { resourceName: 'Block Fixing Adhesive', quantityPerUnit: 0.6, unit: 'bag', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.18, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.22, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Stone Masonry (Random Rubble)',
    unit: 'cum',
    description: 'Random rubble stone masonry in CM 1:6',
    components: [
      { resourceName: 'Boulder 200-300mm', quantityPerUnit: 1.0, unit: 'cum', rate: 800, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 2.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.35, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.6, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.0, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // PLASTERING & FINISHING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Internal Plaster 10mm CM 1:3',
    unit: 'sqm',
    description: '10mm thick internal plaster in rich CM 1:3',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.22, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.013, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.12, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.12, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Internal Plaster 15mm CM 1:4',
    unit: 'sqm',
    description: '15mm thick internal plaster in CM 1:4',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.18, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.022, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.14, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.14, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'External Plaster 18mm (Waterproof)',
    unit: 'sqm',
    description: '18mm external plaster with integral waterproofing',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.25, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.028, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: 'Integral Waterproofing Liquid', quantityPerUnit: 0.05, unit: 'litre', rate: 140, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.16, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.16, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'External Plaster 25mm (Textured)',
    unit: 'sqm',
    description: '25mm thick external plaster with decorative texture finish',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.35, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.038, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: 'Integral Waterproofing Liquid', quantityPerUnit: 0.07, unit: 'litre', rate: 140, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.22, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.22, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'POP Punning 6mm',
    unit: 'sqm',
    description: 'Plaster of Paris finishing coat 6mm over cement plaster',
    components: [
      { resourceName: 'Plaster of Paris (POP)', quantityPerUnit: 0.1, unit: 'bag', rate: 320, type: CostType.MATERIAL },
      { resourceName: 'POP / False Ceiling Worker', quantityPerUnit: 0.08, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.05, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Gypsum Plaster 12mm',
    unit: 'sqm',
    description: '12mm gypsum plaster directly on brick/block wall',
    components: [
      { resourceName: 'Gypsum Plaster', quantityPerUnit: 0.25, unit: 'bag', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'POP / False Ceiling Worker', quantityPerUnit: 0.10, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.06, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Granite Cladding 20mm (Wall)',
    unit: 'sqm',
    description: 'Granite slab cladding on walls with adhesive + mechanical fixing',
    components: [
      { resourceName: 'Granite Slab 20mm Polished', quantityPerUnit: 11, unit: 'sqft', rate: 185, type: CostType.MATERIAL },
      { resourceName: 'Tile Adhesive (Premium)', quantityPerUnit: 0.3, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'Expansion Bolt M10 (Sleeve)', quantityPerUnit: 3, unit: 'nos', rate: 15, type: CostType.MATERIAL },
      { resourceName: 'Granite Fixer', quantityPerUnit: 0.15, unit: 'day', rate: 800, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.12, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // FLOORING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Ceramic Wall Tile 300x600',
    unit: 'sqft',
    description: 'Ceramic wall tile 300x600 with adhesive and grout',
    components: [
      { resourceName: 'Ceramic Wall Tile 300x600', quantityPerUnit: 1.1, unit: 'sqft', rate: 28, type: CostType.MATERIAL },
      { resourceName: 'Tile Adhesive (Standard)', quantityPerUnit: 0.05, unit: 'bag', rate: 320, type: CostType.MATERIAL },
      { resourceName: 'Tile Grout (White)', quantityPerUnit: 0.05, unit: 'kg', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Tile / Marble Fixer', quantityPerUnit: 0.03, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Ceramic Floor Tile 300x300',
    unit: 'sqft',
    description: 'Ceramic floor tile 300x300 with cement mortar',
    components: [
      { resourceName: 'Ceramic Floor Tile 300x300', quantityPerUnit: 1.1, unit: 'sqft', rate: 32, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.05, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.003, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Tile / Marble Fixer', quantityPerUnit: 0.04, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Granite Flooring 20mm',
    unit: 'sqft',
    description: 'Granite slab flooring 20mm with cement mortar',
    components: [
      { resourceName: 'Granite Slab 20mm Polished', quantityPerUnit: 1.1, unit: 'sqft', rate: 185, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.08, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.005, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Granite Fixer', quantityPerUnit: 0.05, unit: 'day', rate: 800, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.04, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Marble Flooring 20mm (Makrana)',
    unit: 'sqft',
    description: 'Marble slab flooring with cement mortar + polishing',
    components: [
      { resourceName: 'Marble Slab (Makrana) 20mm', quantityPerUnit: 1.1, unit: 'sqft', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.08, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.005, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Granite Fixer', quantityPerUnit: 0.05, unit: 'day', rate: 800, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.04, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Marble Polisher', quantityPerUnit: 0.02, unit: 'day', rate: 800, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Kota Stone Flooring 25mm',
    unit: 'sqft',
    description: 'Kota stone flooring with cement mortar',
    components: [
      { resourceName: 'Kota Stone 25mm', quantityPerUnit: 1.1, unit: 'sqft', rate: 65, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.06, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.004, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Tile / Marble Fixer', quantityPerUnit: 0.04, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Epoxy Flooring 3mm',
    unit: 'sqft',
    description: '3mm epoxy flooring with primer + self-leveling topcoat',
    components: [
      { resourceName: 'Epoxy Flooring 3mm', quantityPerUnit: 0.12, unit: 'sqft', rate: 120, type: CostType.MATERIAL },
      { resourceName: 'Epoxy Primer', quantityPerUnit: 0.05, unit: 'kg', rate: 450, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.03, unit: 'day', rate: 700, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.02, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'IPS Flooring 25mm',
    unit: 'sqm',
    description: 'Indian Patent Stone (IPS) flooring 25mm with colour oxide',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 1.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: '12.5mm Aggregate', quantityPerUnit: 0.02, unit: 'cum', rate: 1450, type: CostType.MATERIAL },
      { resourceName: 'Colour Oxide (Red/Green)', quantityPerUnit: 0.5, unit: 'kg', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.15, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.15, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // WATERPROOFING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'APP Membrane Terrace Waterproofing',
    unit: 'sqm',
    description: 'Torch-applied APP membrane on terrace with primer',
    components: [
      { resourceName: 'APP Waterproofing Membrane 4mm', quantityPerUnit: 1.1, unit: 'sqm', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Membrane Primer (Bituminous)', quantityPerUnit: 0.25, unit: 'litre', rate: 120, type: CostType.MATERIAL },
      { miscName: 'LPG Gas for Torch', quantityPerUnit: 0.05, unit: 'cylinder', rate: 1500, type: CostType.MISC },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.05, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.08, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'SBS Membrane Terrace Waterproofing',
    unit: 'sqm',
    description: 'Torch-applied SBS modified bitumen membrane',
    components: [
      { resourceName: 'SBS Waterproofing Membrane 4mm', quantityPerUnit: 1.1, unit: 'sqm', rate: 320, type: CostType.MATERIAL },
      { resourceName: 'Membrane Primer (Bituminous)', quantityPerUnit: 0.25, unit: 'litre', rate: 120, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.05, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.08, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Crystalline Waterproofing (Negative Side)',
    unit: 'sqm',
    description: 'Cementitious crystalline waterproofing coating on negative side',
    components: [
      { resourceName: 'Crystalline Waterproofing', quantityPerUnit: 1.5, unit: 'kg', rate: 220, type: CostType.MATERIAL },
      { miscName: 'Water for Mixing', quantityPerUnit: 0.5, unit: 'litre', rate: 5, type: CostType.MISC },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.05, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.05, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Toilet Waterproofing (SBR + Tiles)',
    unit: 'sqm',
    description: 'Toilet floor waterproofing with SBR slurry + tile overlay',
    components: [
      { resourceName: 'SBR Latex Bonding Agent', quantityPerUnit: 0.25, unit: 'litre', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.3, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.01, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.05, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.05, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Swimming Pool Waterproofing',
    unit: 'sqm',
    description: 'Swimming pool internal waterproofing (epoxy + tile)',
    components: [
      { resourceName: 'Epoxy Paint (Industrial)', quantityPerUnit: 0.3, unit: 'litre', rate: 520, type: CostType.MATERIAL },
      { resourceName: 'Crystalline Waterproofing', quantityPerUnit: 1.0, unit: 'kg', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Anti-skid Tile 300x300', quantityPerUnit: 1.1, unit: 'sqft', rate: 42, type: CostType.MATERIAL },
      { resourceName: 'Tile Adhesive (Premium)', quantityPerUnit: 0.08, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.08, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Tile / Marble Fixer', quantityPerUnit: 0.05, unit: 'day', rate: 750, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // EARTHWORK
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Excavation in Ordinary Soil',
    unit: 'cum',
    description: 'Excavation in ordinary soil including disposal within 50m lead',
    components: [
      { resourceName: 'JCB Excavator 3DX', quantityPerUnit: 0.008, unit: 'day', rate: 12000, type: CostType.EQUIPMENT },
      { resourceName: 'JCB / Excavator Operator', quantityPerUnit: 0.008, unit: 'day', rate: 1500, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.10, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Excavation in Hard Soil',
    unit: 'cum',
    description: 'Excavation in hard soil including disposal within 50m lead',
    components: [
      { resourceName: 'Excavator PC130', quantityPerUnit: 0.012, unit: 'day', rate: 18000, type: CostType.EQUIPMENT },
      { resourceName: 'JCB / Excavator Operator', quantityPerUnit: 0.012, unit: 'day', rate: 1500, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.15, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Excavation in Soft Rock',
    unit: 'cum',
    description: 'Excavation in soft/murum rock requiring chiselling + breaker',
    components: [
      { resourceName: 'Excavator 20T (PC200)', quantityPerUnit: 0.015, unit: 'day', rate: 28000, type: CostType.EQUIPMENT },
      { resourceName: 'Breaker / Demolition Hammer', quantityPerUnit: 0.02, unit: 'day', rate: 800, type: CostType.EQUIPMENT },
      { resourceName: 'JCB / Excavator Operator', quantityPerUnit: 0.015, unit: 'day', rate: 1500, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.25, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Excavation in Hard Rock (Chiselling)',
    unit: 'cum',
    description: 'Hard rock excavation requiring blasting/chiselling',
    components: [
      { resourceName: 'Excavator 20T (PC200)', quantityPerUnit: 0.025, unit: 'day', rate: 28000, type: CostType.EQUIPMENT },
      { resourceName: 'Breaker / Demolition Hammer', quantityPerUnit: 0.05, unit: 'day', rate: 800, type: CostType.EQUIPMENT },
      { miscName: 'Explosives (Controlled Blasting)', quantityPerUnit: 1, unit: 'ls', rate: 200, type: CostType.MISC },
      { resourceName: 'JCB / Excavator Operator', quantityPerUnit: 0.025, unit: 'day', rate: 1500, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.35, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Backfilling with Sand',
    unit: 'cum',
    description: 'Backfilling with sand in layers with compaction',
    components: [
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 1.0, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.005, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.10, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Backfilling with Moorum',
    unit: 'cum',
    description: 'Backfilling with moorum in 150mm layers with watering & compaction',
    components: [
      { resourceName: 'Moorum (Gravel)', quantityPerUnit: 1.0, unit: 'cum', rate: 650, type: CostType.MATERIAL },
      { resourceName: 'Plate Compactor', quantityPerUnit: 0.01, unit: 'day', rate: 1200, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.15, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // STEEL WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Fabricated Steel Truss (per ton)',
    unit: 'ton',
    description: 'Fabricated steel truss including angles, welding, painting',
    components: [
      { resourceName: 'MS Angle 75x75x8mm', quantityPerUnit: 900, unit: 'kg', rate: 76, type: CostType.MATERIAL },
      { resourceName: 'Welding Rod E7018 3.15mm', quantityPerUnit: 8, unit: 'kg', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Red Oxide Primer', quantityPerUnit: 3, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Enamel Paint (Oil Based)', quantityPerUnit: 4, unit: 'litre', rate: 350, type: CostType.MATERIAL },
      { resourceName: 'Steel Fabricator', quantityPerUnit: 5, unit: 'day', rate: 800, type: CostType.LABOUR },
      { resourceName: 'Generator Welding Set 250A', quantityPerUnit: 2, unit: 'day', rate: 3500, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Steel Staircase (per cum)',
    unit: 'cum',
    description: 'Fabricated MS steel staircase with checkered plate treads',
    components: [
      { resourceName: 'MS Channel 200x75mm', quantityPerUnit: 250, unit: 'kg', rate: 78, type: CostType.MATERIAL },
      { resourceName: 'Chequered Plate 6mm', quantityPerUnit: 150, unit: 'kg', rate: 82, type: CostType.MATERIAL },
      { resourceName: 'MS Flat 25x3mm', quantityPerUnit: 30, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Welding Rod E7018 3.15mm', quantityPerUnit: 3, unit: 'kg', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Red Oxide Primer', quantityPerUnit: 1, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Enamel Paint (Oil Based)', quantityPerUnit: 2, unit: 'litre', rate: 350, type: CostType.MATERIAL },
      { resourceName: 'Steel Fabricator', quantityPerUnit: 3, unit: 'day', rate: 800, type: CostType.LABOUR },
      { resourceName: 'Generator Welding Set 250A', quantityPerUnit: 1, unit: 'day', rate: 3500, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'MS Hand Railing (per rmt)',
    unit: 'rmt',
    description: 'Mild steel hand railing 1m height with verticals',
    components: [
      { resourceName: 'Scaffolding Pipe 40mm NB', quantityPerUnit: 4, unit: 'rmt', rate: 185, type: CostType.MATERIAL },
      { resourceName: 'Welding Rod E6013 3.15mm', quantityPerUnit: 0.5, unit: 'kg', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Red Oxide Primer', quantityPerUnit: 0.15, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Enamel Paint (Oil Based)', quantityPerUnit: 0.2, unit: 'litre', rate: 350, type: CostType.MATERIAL },
      { resourceName: 'Steel Fabricator', quantityPerUnit: 0.25, unit: 'day', rate: 800, type: CostType.LABOUR },
    ],
  },
  {
    name: 'SS Hand Railing (per rmt)',
    unit: 'rmt',
    description: 'Stainless steel 304 hand railing 1m height',
    components: [
      { resourceName: 'Stainless Steel Pipe 50mm 304', quantityPerUnit: 4, unit: 'rmt', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Welding Rod E6013 3.15mm', quantityPerUnit: 0.5, unit: 'kg', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Steel Fabricator', quantityPerUnit: 0.30, unit: 'day', rate: 800, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // ROAD WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'GSB Layer 200mm',
    unit: 'sqm',
    description: 'Granular Sub-Base 200mm compacted thickness',
    components: [
      { resourceName: 'GSB (Granular Sub-Base)', quantityPerUnit: 0.25, unit: 'cum', rate: 1450, type: CostType.MATERIAL },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.003, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
      { resourceName: 'Motor Grader', quantityPerUnit: 0.002, unit: 'day', rate: 18000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.02, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'WMM Layer 250mm',
    unit: 'sqm',
    description: 'Wet Mix Macadam 250mm compacted layer',
    components: [
      { resourceName: 'WMM (Wet Mix Macadam)', quantityPerUnit: 0.30, unit: 'cum', rate: 2100, type: CostType.MATERIAL },
      { resourceName: 'Vibratory Roller 12T', quantityPerUnit: 0.004, unit: 'day', rate: 10000, type: CostType.EQUIPMENT },
      { resourceName: 'WMM Plant', quantityPerUnit: 0.002, unit: 'day', rate: 15000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.02, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'DBM 75mm (Dense Bituminous Macadam)',
    unit: 'sqm',
    description: 'Dense Bituminous Macadam 75mm binder course',
    components: [
      { resourceName: 'DBM Mix Material (per ton)', quantityPerUnit: 0.18, unit: 'ton', rate: 8500, type: CostType.MATERIAL },
      { resourceName: 'Paver Finisher', quantityPerUnit: 0.001, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
      { resourceName: 'Hot Mix Plant 60-90 TPH', quantityPerUnit: 0.001, unit: 'day', rate: 25000, type: CostType.EQUIPMENT },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.002, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Bituminous Concrete 40mm',
    unit: 'sqm',
    description: 'Bituminous Concrete (BC) 40mm wearing course',
    components: [
      { resourceName: 'BC Mix Material (per ton)', quantityPerUnit: 0.10, unit: 'ton', rate: 9500, type: CostType.MATERIAL },
      { resourceName: 'Paver Finisher', quantityPerUnit: 0.001, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
      { resourceName: 'Hot Mix Plant 60-90 TPH', quantityPerUnit: 0.001, unit: 'day', rate: 25000, type: CostType.EQUIPMENT },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.002, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Prime Coat Application',
    unit: 'sqm',
    description: 'Prime coat application on granular surface',
    components: [
      { resourceName: 'Prime Coat Material (Cutback)', quantityPerUnit: 0.7, unit: 'litre', rate: 52, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.005, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Tack Coat Application',
    unit: 'sqm',
    description: 'Tack coat (bitumen emulsion) between bituminous layers',
    components: [
      { resourceName: 'Bitumen Emulsion (SS-1)', quantityPerUnit: 0.35, unit: 'litre', rate: 45, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.003, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // ADDITIONAL CONCRETE WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Self-Compacting Concrete (SCC) M30',
    unit: 'cum',
    description: 'Self-compacting concrete M30 with high flow PCE admixture',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.48, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.40, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'GGBS (Ground Granulated Blast Slag)', quantityPerUnit: 40, unit: 'kg', rate: 4.5, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 4.0, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 100, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.5, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering (SCC Pressure)', quantityPerUnit: 1, unit: 'ls', rate: 1400, type: CostType.MISC },
    ],
  },
  {
    name: 'Fibre-Reinforced Concrete (FRC) M25',
    unit: 'cum',
    description: 'M25 concrete with polypropylene fibres for crack resistance',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 6.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'Polypropylene Fibre (Monolithic)', quantityPerUnit: 1.2, unit: 'kg', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (SNF Based)', quantityPerUnit: 1.5, unit: 'litre', rate: 95, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 350L', quantityPerUnit: 0.2, unit: 'day', rate: 2500, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Steel Fibre Reinforced Concrete (SFRC) M30',
    unit: 'cum',
    description: 'M30 concrete with steel fibres for industrial floors',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'Steel Fibres for Concrete', quantityPerUnit: 40, unit: 'kg', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 2.0, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Laser Screed Machine', quantityPerUnit: 0.05, unit: 'day', rate: 25000, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Dry Lean Concrete (DLC) M15',
    unit: 'cum',
    description: 'Dry lean concrete M15 for pavement base course',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 3.2, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.45, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: '40mm Aggregate', quantityPerUnit: 0.90, unit: 'cum', rate: 1300, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.2, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.01, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Pavement Quality Concrete (PQC) M40',
    unit: 'cum',
    description: 'Pavement quality concrete M40 for rigid pavement',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 9.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.38, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 2.5, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'Air Entraining Agent', quantityPerUnit: 0.2, unit: 'litre', rate: 110, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Paver Finisher', quantityPerUnit: 0.005, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Polymer-Modified Concrete (PCC) M25',
    unit: 'cum',
    description: 'SBR latex modified concrete for repair works',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'SBR Latex Bonding Agent', quantityPerUnit: 12, unit: 'litre', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (SNF Based)', quantityPerUnit: 2.0, unit: 'litre', rate: 95, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.0, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Lightweight Concrete (CLC) M7.5',
    unit: 'cum',
    description: 'Cellular lightweight concrete blocks for insulation',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 4.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'Fly Ash (Pond Ash)', quantityPerUnit: 200, unit: 'kg', rate: 2.5, type: CostType.MATERIAL },
      { resourceName: 'Foaming Agent (CLC)', quantityPerUnit: 0.8, unit: 'litre', rate: 120, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.0, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'High-Strength Concrete M50',
    unit: 'cum',
    description: 'High-strength concrete M50 for high-rise columns',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 11.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.38, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'Silica Fume (Densified)', quantityPerUnit: 30, unit: 'kg', rate: 35, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 4.0, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 150, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.0, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // ADDITIONAL PLASTERING & FINISHING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Neeru Finish (Cement Slurry) 3mm',
    unit: 'sqm',
    description: 'Neeru finishing coat (white cement + lime + marble dust) for smooth finish',
    components: [
      { resourceName: 'White Cement', quantityPerUnit: 0.1, unit: 'bag', rate: 850, type: CostType.MATERIAL },
      { resourceName: 'Lime (Hydrated)', quantityPerUnit: 0.3, unit: 'kg', rate: 9, type: CostType.MATERIAL },
      { resourceName: 'Marble Chips (Terrazzo)', quantityPerUnit: 1.5, unit: 'kg', rate: 12, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.10, unit: 'day', rate: 650, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Lime Plaster 15mm',
    unit: 'sqm',
    description: 'Traditional lime plaster 15mm for heritage buildings',
    components: [
      { resourceName: 'Lime (Hydrated)', quantityPerUnit: 3.5, unit: 'kg', rate: 9, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.02, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.15, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.10, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Acrylic Texture Plaster 3mm',
    unit: 'sqm',
    description: 'Ready-mix acrylic textured plaster for decorative exteriors',
    components: [
      { resourceName: 'Texture Paint', quantityPerUnit: 1.5, unit: 'kg', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Primer (Acrylic)', quantityPerUnit: 0.05, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.08, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Waterproof Plaster 20mm',
    unit: 'sqm',
    description: '20mm waterproof plaster for water retaining structures',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.3, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.024, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: 'Integral Waterproofing Liquid', quantityPerUnit: 0.08, unit: 'litre', rate: 140, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.18, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.18, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Reinforced Plaster (Mesh) 15mm',
    unit: 'sqm',
    description: '15mm plaster with fiberglass mesh reinforcement',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.22, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.018, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Glass Fibre Mesh', quantityPerUnit: 1.1, unit: 'sqm', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.15, unit: 'day', rate: 650, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // ADDITIONAL FLOORING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Wooden Laminate Flooring 8mm',
    unit: 'sqft',
    description: '8mm wooden laminate flooring with underlay',
    components: [
      { resourceName: 'Wooden Laminate Flooring 8mm', quantityPerUnit: 1.1, unit: 'sqft', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Acoustic Underlay 5mm (Floor)', quantityPerUnit: 0.11, unit: 'sqm', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Laminate Accessories (T-Molding)', quantityPerUnit: 0.05, unit: 'rmt', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Carpenter (Skilled)', quantityPerUnit: 0.03, unit: 'day', rate: 800, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Terrazzo Flooring (In-Situ) 40mm',
    unit: 'sqm',
    description: 'In-situ terrazzo flooring 40mm with divider strips',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 1.2, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'Marble Chips (Terrazzo)', quantityPerUnit: 12, unit: 'kg', rate: 12, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.02, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Brass Divider Strip', quantityPerUnit: 0.5, unit: 'rmt', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.15, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Marble Polisher', quantityPerUnit: 0.05, unit: 'day', rate: 800, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'VDF Industrial Flooring 150mm',
    unit: 'sqm',
    description: 'Vacuum dewatered flooring 150mm with power trowel finish',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 6.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Coarse)', quantityPerUnit: 0.10, unit: 'cum', rate: 1700, type: CostType.MATERIAL },
      { resourceName: '12.5mm Aggregate', quantityPerUnit: 0.15, unit: 'cum', rate: 1450, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (SNF Based)', quantityPerUnit: 0.8, unit: 'litre', rate: 95, type: CostType.MATERIAL },
      { resourceName: 'Concrete Densifier (Lithium)', quantityPerUnit: 0.2, unit: 'litre', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.10, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.25, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Laser Screed Machine', quantityPerUnit: 0.02, unit: 'day', rate: 25000, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'Sandstone Flooring 30mm',
    unit: 'sqft',
    description: 'Dholpur sandstone slab flooring with cement mortar',
    components: [
      { resourceName: 'Sandstone Slab (Dholpur) 30mm', quantityPerUnit: 1.1, unit: 'sqft', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.08, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.005, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Tile / Marble Fixer', quantityPerUnit: 0.04, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Slate Stone Flooring',
    unit: 'sqft',
    description: 'Natural slate stone flooring with cement mortar',
    components: [
      { resourceName: 'Slate Stone', quantityPerUnit: 1.1, unit: 'sqft', rate: 75, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.07, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.004, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Tile / Marble Fixer', quantityPerUnit: 0.04, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.03, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Engineered Wood Flooring 12mm',
    unit: 'sqft',
    description: '12mm engineered wood flooring with glue-down installation',
    components: [
      { resourceName: 'Engineered Wood Flooring 12mm', quantityPerUnit: 1.1, unit: 'sqft', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Wood Flooring Adhesive', quantityPerUnit: 0.1, unit: 'kg', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Carpenter (Skilled)', quantityPerUnit: 0.04, unit: 'day', rate: 800, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // ADDITIONAL WATERPROOFING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Self-Adhesive Membrane Waterproofing',
    unit: 'sqm',
    description: 'Self-adhesive waterproofing membrane for basements',
    components: [
      { resourceName: 'Self-Adhesive Waterproofing Membrane', quantityPerUnit: 1.1, unit: 'sqm', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Membrane Primer (Bituminous)', quantityPerUnit: 0.2, unit: 'litre', rate: 120, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.04, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.06, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'PU Waterproofing for Balcony',
    unit: 'sqm',
    description: 'Polyurethane liquid waterproofing for balconies',
    components: [
      { resourceName: 'PU Waterproofing (Liquid)', quantityPerUnit: 0.8, unit: 'litre', rate: 350, type: CostType.MATERIAL },
      { resourceName: 'Primer (Acrylic)', quantityPerUnit: 0.1, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Fabric Reinforcement (Glass Mesh)', quantityPerUnit: 1.1, unit: 'sqm', rate: 65, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.05, unit: 'day', rate: 1000, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Sump Tank Waterproofing (Crystalline)',
    unit: 'sqm',
    description: 'Crystalline waterproofing for underground sump tanks',
    components: [
      { resourceName: 'Crystalline Waterproofing', quantityPerUnit: 1.8, unit: 'kg', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Acrylic Waterproofing Coating', quantityPerUnit: 0.3, unit: 'litre', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.08, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.08, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'EPDM Membrane Waterproofing (Roof)',
    unit: 'sqm',
    description: 'EPDM membrane waterproofing system for flat roofs',
    components: [
      { resourceName: 'EPDM Membrane 1.5mm', quantityPerUnit: 1.1, unit: 'sqm', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'EPDM Bonding Adhesive', quantityPerUnit: 0.15, unit: 'litre', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.05, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.06, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Elastomeric Coating Waterproofing',
    unit: 'sqm',
    description: 'Elastomeric waterproofing coating for terraces',
    components: [
      { resourceName: 'Elastomeric Waterproofing Coating', quantityPerUnit: 0.6, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Fabric Reinforcement (Glass Mesh)', quantityPerUnit: 1.1, unit: 'sqm', rate: 65, type: CostType.MATERIAL },
      { resourceName: 'Primer (Acrylic)', quantityPerUnit: 0.1, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.05, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // PILING WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Bored Cast-In-Situ Pile 600mm (per rmt)',
    unit: 'rmt',
    description: 'Bored cast-in-situ pile 600mm diameter with tremie concrete',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.04, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.04, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 16mm', quantityPerUnit: 25, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Bentonite Clay Powder (Piling Grade) Bulk', quantityPerUnit: 5, unit: 'kg', rate: 16, type: CostType.MATERIAL },
      { resourceName: 'Rotary Piling Rig 22T (Bored)', quantityPerUnit: 0.015, unit: 'day', rate: 85000, type: CostType.EQUIPMENT },
      { resourceName: 'JCB / Excavator Operator', quantityPerUnit: 0.015, unit: 'day', rate: 1500, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.5, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Driven Pile (RCC) 300x300mm (per rmt)',
    unit: 'rmt',
    description: 'Driven precast RCC pile 300x300mm with diesel hammer',
    components: [
      { resourceName: 'Precast RCC Pile 300x300', quantityPerUnit: 1, unit: 'rmt', rate: 2800, type: CostType.MATERIAL },
      { resourceName: 'Diesel Pile Hammer (D30)', quantityPerUnit: 0.01, unit: 'day', rate: 18000, type: CostType.EQUIPMENT },
      { resourceName: 'Mobile Crane 25T', quantityPerUnit: 0.01, unit: 'day', rate: 18000, type: CostType.EQUIPMENT },
      { resourceName: 'Crane Operator', quantityPerUnit: 0.01, unit: 'day', rate: 1200, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.30, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Micro-Pile 150mm (per rmt)',
    unit: 'rmt',
    description: 'Micro-pile (root pile) 150mm with pressure grouting',
    components: [
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 4, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Grout for Micro-Pile (Non-Shrink)', quantityPerUnit: 15, unit: 'kg', rate: 17, type: CostType.MATERIAL },
      { resourceName: 'Micro-Pile Centralizer (Spacer)', quantityPerUnit: 1, unit: 'piece', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Micro-Pile Pressure Grouting Pump', quantityPerUnit: 0.03, unit: 'day', rate: 4500, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.4, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Sheet Pile (Steel) per sqm',
    unit: 'sqm',
    description: 'Driven steel sheet pile for cofferdams and shoring',
    components: [
      { resourceName: 'Steel Sheet Pile Section', quantityPerUnit: 120, unit: 'kg', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Hydraulic Pile Hammer (Driven)', quantityPerUnit: 0.008, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
      { resourceName: 'Mobile Crane 50T', quantityPerUnit: 0.008, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.20, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // FINISHES & PAINTING
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Wood Polishing (Melamine)',
    unit: 'sqft',
    description: 'Melamine polish for wooden surfaces (3 coats)',
    components: [
      { resourceName: 'Wood Polish (Melamine)', quantityPerUnit: 0.05, unit: 'litre', rate: 280, type: CostType.MATERIAL },
      { resourceName: 'Wood Sealer (NC)', quantityPerUnit: 0.03, unit: 'litre', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Sand Paper 80 Grit', quantityPerUnit: 0.05, unit: 'sheet', rate: 12, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.03, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'PU Polish for Wood',
    unit: 'sqft',
    description: 'PU polish (polyurethane) for premium wood finish',
    components: [
      { resourceName: 'PU Polish', quantityPerUnit: 0.06, unit: 'litre', rate: 450, type: CostType.MATERIAL },
      { resourceName: 'Wood Sealer (NC)', quantityPerUnit: 0.03, unit: 'litre', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.04, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Texture Coating (Exterior)',
    unit: 'sqm',
    description: 'Exterior textured coating with roller finish',
    components: [
      { resourceName: 'Texture Paint', quantityPerUnit: 1.2, unit: 'kg', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Primer (Acrylic)', quantityPerUnit: 0.08, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.08, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Distemper Painting (2 Coats)',
    unit: 'sqm',
    description: 'Acrylic distemper painting with putty and primer',
    components: [
      { resourceName: 'Distemper (Acrylic)', quantityPerUnit: 0.15, unit: 'kg', rate: 55, type: CostType.MATERIAL },
      { resourceName: 'Wall Putty (Cement Based)', quantityPerUnit: 0.02, unit: 'bag', rate: 580, type: CostType.MATERIAL },
      { resourceName: 'Primer (Cement/Water Based)', quantityPerUnit: 0.05, unit: 'litre', rate: 160, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.06, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Enamel Painting (Wood/Metal)',
    unit: 'sqm',
    description: 'Enamel painting for doors/windows/steel with primer',
    components: [
      { resourceName: 'Enamel Paint (Oil Based)', quantityPerUnit: 0.12, unit: 'litre', rate: 350, type: CostType.MATERIAL },
      { resourceName: 'Red Oxide Primer', quantityPerUnit: 0.06, unit: 'litre', rate: 220, type: CostType.MATERIAL },
      { resourceName: 'Sand Paper 80 Grit', quantityPerUnit: 0.05, unit: 'sheet', rate: 12, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.08, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Exterior Emulsion Painting (Premium)',
    unit: 'sqm',
    description: 'Premium exterior emulsion with primer and 2 coats',
    components: [
      { resourceName: 'Exterior Emulsion Paint (Premium)', quantityPerUnit: 0.15, unit: 'litre', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'Primer (Cement/Water Based)', quantityPerUnit: 0.08, unit: 'litre', rate: 160, type: CostType.MATERIAL },
      { resourceName: 'Wall Putty (Cement Based)', quantityPerUnit: 0.025, unit: 'bag', rate: 580, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.08, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // MISCELLANEOUS WORKS
  // ════════════════════════════════════════════════════════════════
  {
    name: 'Anti-Termite Treatment (Pre-Construction)',
    unit: 'sqm',
    description: 'Pre-construction anti-termite soil treatment',
    components: [
      { resourceName: 'Anti-termite Compound', quantityPerUnit: 0.08, unit: 'litre', rate: 320, type: CostType.MATERIAL },
      { miscName: 'Water for Dilution', quantityPerUnit: 2, unit: 'litre', rate: 5, type: CostType.MISC },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.02, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Conduit Wiring (Open)',
    unit: 'rmt',
    description: 'PVC conduit open wiring with pulling wire',
    components: [
      { resourceName: 'PVC Conduit Pipe 25mm Heavy', quantityPerUnit: 1.05, unit: 'metre', rate: 42, type: CostType.MATERIAL },
      { resourceName: 'Conduit Bend 25mm', quantityPerUnit: 0.15, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'GI Wire 14G', quantityPerUnit: 0.05, unit: 'kg', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Electrician', quantityPerUnit: 0.03, unit: 'day', rate: 850, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Switch Board Installation',
    unit: 'nos',
    description: 'Modular switch board installation with switches & sockets',
    components: [
      { resourceName: 'Switch Box (Modular) 3 Module', quantityPerUnit: 1, unit: 'piece', rate: 45, type: CostType.MATERIAL },
      { resourceName: 'Switch 6A Modular', quantityPerUnit: 2, unit: 'piece', rate: 35, type: CostType.MATERIAL },
      { resourceName: 'Socket 3-Pin 6A Modular', quantityPerUnit: 1, unit: 'piece', rate: 45, type: CostType.MATERIAL },
      { resourceName: 'Electrician', quantityPerUnit: 0.10, unit: 'day', rate: 850, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Earth Pit Installation',
    unit: 'nos',
    description: 'Pipe-type earth pit with copper plate and charcoal',
    components: [
      { resourceName: 'Copper Earthing Plate 600x600x3mm', quantityPerUnit: 1, unit: 'piece', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Charcoal & Salt Mix', quantityPerUnit: 25, unit: 'kg', rate: 12, type: CostType.MATERIAL },
      { resourceName: 'GI Earthing Strip 25x4mm', quantityPerUnit: 3, unit: 'metre', rate: 65, type: CostType.MATERIAL },
      { resourceName: 'Electrician', quantityPerUnit: 0.5, unit: 'day', rate: 850, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Aluminium Partition (Glazed)',
    unit: 'sqm',
    description: 'Aluminium framed glazed partition with 12mm glass',
    components: [
      { resourceName: 'Aluminium Window Section', quantityPerUnit: 3.5, unit: 'kg', rate: 285, type: CostType.MATERIAL },
      { resourceName: 'Toughened Glass 12mm', quantityPerUnit: 10, unit: 'sqft', rate: 195, type: CostType.MATERIAL },
      { resourceName: 'Door Hardware Set', quantityPerUnit: 0.1, unit: 'set', rate: 3500, type: CostType.MATERIAL },
      { resourceName: 'Glazier (Glass Fitter)', quantityPerUnit: 0.15, unit: 'day', rate: 750, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Gypsum Board Partition 75mm',
    unit: 'sqm',
    description: 'Metal stud gypsum board partition both sides',
    components: [
      { resourceName: 'Gypsum Board 12.5mm', quantityPerUnit: 2.2, unit: 'sqm', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'GI Stud & Track Set', quantityPerUnit: 2.5, unit: 'rmt', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Jointing Tape (Fiber Mesh)', quantityPerUnit: 2, unit: 'rmt', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'Carpenter (Skilled)', quantityPerUnit: 0.10, unit: 'day', rate: 800, type: CostType.LABOUR },
    ],
  },
  {
    name: 'PCC M15 (1:2:4)',
    unit: 'cum',
    description: 'Plain cement concrete M15 grade (1:2:4 mix)',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 4.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.3, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 1.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 200L', quantityPerUnit: 0.2, unit: 'day', rate: 1800, type: CostType.EQUIPMENT },
    ],
  },
  {
    name: 'RCC M20 Slabs & Beams',
    unit: 'cum',
    description: 'Reinforced cement concrete M20 grade for slabs and beams',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 6.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 16mm', quantityPerUnit: 80, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.0, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Cover Blocks (PVC) 25mm', quantityPerUnit: 5, unit: 'piece', rate: 3, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.5, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 350L', quantityPerUnit: 0.2, unit: 'day', rate: 2500, type: CostType.EQUIPMENT },
      { resourceName: 'Needle Vibrator 40mm', quantityPerUnit: 0.3, unit: 'day', rate: 700, type: CostType.EQUIPMENT },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 800, type: CostType.MISC },
    ],
  },
  {
    name: 'Brick Masonry 230mm CM 1:6',
    unit: 'sqm',
    description: 'Full brick (230mm) masonry in cement mortar 1:6',
    components: [
      { resourceName: 'Fly Ash Brick 230x110x75', quantityPerUnit: 56, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.45, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.03, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.35, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.50, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Internal Plaster 12mm CM 1:4',
    unit: 'sqm',
    description: '12mm thick internal plaster in CM 1:4',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 0.16, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.018, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.13, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.13, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Emulsion paint per sqm',
    unit: 'sqm',
    description: 'Interior emulsion painting (1 primer + 2 coats)',
    components: [
      { resourceName: 'Interior Emulsion (Premium)', quantityPerUnit: 0.15, unit: 'litre', rate: 380, type: CostType.MATERIAL },
      { resourceName: 'Primer (Cement/Water Based)', quantityPerUnit: 0.05, unit: 'litre', rate: 160, type: CostType.MATERIAL },
      { resourceName: 'Wall Putty (Cement Based)', quantityPerUnit: 0.015, unit: 'bag', rate: 580, type: CostType.MATERIAL },
      { resourceName: 'Painter (Skilled)', quantityPerUnit: 0.06, unit: 'day', rate: 700, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Terrace Waterproofing (Brick Bat Coba)',
    unit: 'sqm',
    description: 'Traditional brick bat coba waterproofing for terraces (125mm thick)',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 1.8, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.04, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Fly Ash Brick 230x110x75', quantityPerUnit: 10, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'Integral Waterproofing Liquid', quantityPerUnit: 0.1, unit: 'litre', rate: 140, type: CostType.MATERIAL },
      { resourceName: 'Waterproofing Specialist', quantityPerUnit: 0.08, unit: 'day', rate: 1000, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.20, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // TEMPLATE-LINKED RAs (composite works referenced by estimate templates)
  // ════════════════════════════════════════════════════════════════
  {
    name: 'RCC M25 (Foundation & Slab)',
    unit: 'cum',
    description: 'Reinforced cement concrete M25 for foundations, slabs and beams',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 100, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.2, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Cover Blocks (PVC) 40mm', quantityPerUnit: 5, unit: 'piece', rate: 3.5, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.6, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.2, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 350L', quantityPerUnit: 0.2, unit: 'day', rate: 2500, type: CostType.EQUIPMENT },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 900, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC M30 (Columns, Beams & Slabs)',
    unit: 'cum',
    description: 'Reinforced cement concrete M30 for structural columns, beams and slabs',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 110, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.5, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Cover Blocks (PVC) 40mm', quantityPerUnit: 6, unit: 'piece', rate: 3.5, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.7, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1000, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC M35 (Heavy Structural)',
    unit: 'cum',
    description: 'Reinforced cement concrete M35 for heavy structural elements',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 120, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.8, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.8, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.8, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1100, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC M40 (High-Rise & Pile Caps)',
    unit: 'cum',
    description: 'Reinforced cement concrete M40 for high-rise columns and pile caps',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 9.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.38, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 130, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 2.0, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.9, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1300, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC Pier Columns M35',
    unit: 'cum',
    description: 'Reinforced concrete M35 pier columns for flyover/bridge structures',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 140, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 2.5, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.8, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.0, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1400, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC Deck Slab M35',
    unit: 'cum',
    description: 'Reinforced concrete M35 deck slab for flyover/bridge',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 120, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 2.0, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.7, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1300, type: CostType.MISC },
    ],
  },
  {
    name: 'Culvert RCC (Wing Walls & Abutments)',
    unit: 'cum',
    description: 'RCC M30 for culvert wing walls, abutments and head walls',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 90, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.3, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.6, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 950, type: CostType.MISC },
    ],
  },
  {
    name: 'Tremie Concrete M30 (Piling)',
    unit: 'cum',
    description: 'Underwater tremie concrete M30 for bored cast-in-situ piles',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.44, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.44, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.44, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'Retarding Admixture', quantityPerUnit: 2.5, unit: 'litre', rate: 85, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (SNF Based)', quantityPerUnit: 3.0, unit: 'litre', rate: 95, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.0, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'DBM 50mm (Dense Bituminous Macadam)',
    unit: 'sqm',
    description: 'Dense Bituminous Macadam 50mm binder course with mechanical paving',
    components: [
      { resourceName: 'DBM Mix Material (per ton)', quantityPerUnit: 0.12, unit: 'ton', rate: 8500, type: CostType.MATERIAL },
      { resourceName: 'Bitumen Emulsion (RS-1)', quantityPerUnit: 0.35, unit: 'litre', rate: 48, type: CostType.MATERIAL },
      { resourceName: 'Paver Finisher', quantityPerUnit: 0.001, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
      { resourceName: 'Hot Mix Plant 60-90 TPH', quantityPerUnit: 0.001, unit: 'day', rate: 25000, type: CostType.EQUIPMENT },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.002, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.02, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'BC 40mm (Bituminous Concrete)',
    unit: 'sqm',
    description: 'Bituminous Concrete 40mm wearing course with mechanical paving',
    components: [
      { resourceName: 'BC Mix Material (per ton)', quantityPerUnit: 0.10, unit: 'ton', rate: 9500, type: CostType.MATERIAL },
      { resourceName: 'Bitumen Emulsion (RS-1)', quantityPerUnit: 0.25, unit: 'litre', rate: 48, type: CostType.MATERIAL },
      { resourceName: 'Paver Finisher', quantityPerUnit: 0.001, unit: 'day', rate: 35000, type: CostType.EQUIPMENT },
      { resourceName: 'Hot Mix Plant 60-90 TPH', quantityPerUnit: 0.001, unit: 'day', rate: 25000, type: CostType.EQUIPMENT },
      { resourceName: 'Vibratory Roller 10T', quantityPerUnit: 0.002, unit: 'day', rate: 8000, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.02, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Thermoplastic Road Marking',
    unit: 'rmt',
    description: 'Thermoplastic road marking line (4m wide) with glass beads',
    components: [
      { resourceName: 'Thermoplastic Road Marking Paint (White)', quantityPerUnit: 0.15, unit: 'kg', rate: 75, type: CostType.MATERIAL },
      { resourceName: 'Glass Microbeads (Retroreflective)', quantityPerUnit: 0.03, unit: 'kg', rate: 120, type: CostType.MATERIAL },
      { resourceName: 'Thermoplastic Road Marking Machine', quantityPerUnit: 0.0005, unit: 'day', rate: 8500, type: CostType.EQUIPMENT },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.003, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Crash Barrier Installation (W-Beam)',
    unit: 'rmt',
    description: 'W-beam crash barrier installation with posts and fasteners',
    components: [
      { resourceName: 'W-Beam Crash Barrier (Galvanized) 3mm', quantityPerUnit: 4, unit: 'rmt', rate: 850, type: CostType.MATERIAL },
      { resourceName: 'Crash Barrier Post (MS) 140x70mm', quantityPerUnit: 0.5, unit: 'nos', rate: 650, type: CostType.MATERIAL },
      { resourceName: 'Nut & Bolt Set 16mm (Galvanized)', quantityPerUnit: 2, unit: 'set', rate: 28, type: CostType.MATERIAL },
      { resourceName: 'Steel Fabricator', quantityPerUnit: 0.05, unit: 'day', rate: 800, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.10, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'RCC Hume Pipe 600mm Installation',
    unit: 'rmt',
    description: 'RCC hume pipe NP3 600mm dia with excavation, bedding, laying & jointing',
    components: [
      { resourceName: 'RCC Hume Pipe NP3 600mm', quantityPerUnit: 1.0, unit: 'rmt', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'M-Sand (Manufactured)', quantityPerUnit: 0.15, unit: 'cum', rate: 1650, type: CostType.MATERIAL },
      { resourceName: 'Excavator PC130', quantityPerUnit: 0.005, unit: 'day', rate: 18000, type: CostType.EQUIPMENT },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.05, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.20, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'RCC Hume Pipe 900mm Installation',
    unit: 'rmt',
    description: 'RCC hume pipe NP3 900mm dia with excavation, bedding, laying & jointing',
    components: [
      { resourceName: 'RCC Hume Pipe NP3 900mm', quantityPerUnit: 1.0, unit: 'rmt', rate: 3500, type: CostType.MATERIAL },
      { resourceName: 'M-Sand (Manufactured)', quantityPerUnit: 0.25, unit: 'cum', rate: 1650, type: CostType.MATERIAL },
      { resourceName: 'Excavator PC130', quantityPerUnit: 0.008, unit: 'day', rate: 18000, type: CostType.EQUIPMENT },
      { resourceName: 'Mason Grade 2', quantityPerUnit: 0.08, unit: 'day', rate: 650, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 0.30, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'RCC Footings & Tie Beams M30',
    unit: 'cum',
    description: 'Reinforced concrete M30 for isolated footings and tie beams',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 80, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.0, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.5, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 700, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC Pedestal Foundation M30',
    unit: 'cum',
    description: 'Reinforced concrete M30 pedestal foundations for steel columns',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 20mm', quantityPerUnit: 90, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.2, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.6, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 750, type: CostType.MISC },
    ],
  },
  {
    name: 'Post-Tensioned Slab RCC M40',
    unit: 'cum',
    description: 'Post-tensioned RCC M40 slab with ducts, strands, anchorages & stressing',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 9.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.38, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 16mm', quantityPerUnit: 50, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Prestressing Strand 15.2mm (7-Wire) 1860 MPa', quantityPerUnit: 35, unit: 'kg', rate: 155, type: CostType.MATERIAL },
      { resourceName: 'HDPE Duct for Post-Tensioning 75mm', quantityPerUnit: 2, unit: 'rmt', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 1.0, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1500, type: CostType.MISC },
    ],
  },
  {
    name: 'Diaphragm Wall RCC M40 (600mm)',
    unit: 'cum',
    description: 'RCC M40 diaphragm wall for deep basement excavation retaining',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 9.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.40, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.42, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 25mm', quantityPerUnit: 130, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 2.0, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Superplasticizer (PCE Based)', quantityPerUnit: 3.0, unit: 'litre', rate: 135, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.8, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 3.0, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  },
  {
    name: 'Column Jacketing RCC M30',
    unit: 'cum',
    description: 'RCC M30 jacketing for structural column strengthening/retrofitting',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 8.0, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '10mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1350, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 12mm', quantityPerUnit: 80, unit: 'kg', rate: 73, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.5, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'SBR Latex Bonding Agent', quantityPerUnit: 1.0, unit: 'litre', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.8, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1100, type: CostType.MISC },
    ],
  },
  {
    name: 'RCC Water Tank Walls & Floor M30',
    unit: 'cum',
    description: 'Reinforced concrete M30 for water retaining structures (tank walls/floor)',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 16mm', quantityPerUnit: 90, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.2, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Integral Waterproofing Liquid', quantityPerUnit: 0.1, unit: 'litre', rate: 140, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.6, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1000, type: CostType.MISC },
    ],
  },
  {
    name: 'Swimming Pool RCC M30 (Walls)',
    unit: 'cum',
    description: 'Reinforced concrete M30 for swimming pool walls with waterproofing additive',
    components: [
      { resourceName: 'OPC Cement 53 Grade', quantityPerUnit: 7.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand (Fine)', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500 16mm', quantityPerUnit: 95, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Binding Wire 18G', quantityPerUnit: 1.3, unit: 'kg', rate: 68, type: CostType.MATERIAL },
      { resourceName: 'Integral Waterproofing Liquid', quantityPerUnit: 0.15, unit: 'litre', rate: 140, type: CostType.MATERIAL },
      { resourceName: 'SBR Latex Bonding Agent', quantityPerUnit: 0.5, unit: 'litre', rate: 180, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1 (Mistri)', quantityPerUnit: 0.7, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour (Male)', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 1000, type: CostType.MISC },
    ],
  },
];
