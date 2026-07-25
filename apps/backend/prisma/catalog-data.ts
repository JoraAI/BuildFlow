/**
 * BuildFlow - Comprehensive Indian Construction Resource Catalog
 *
 * ~600+ catalog items covering all major construction trades for Indian market.
 * Rates are realistic 2025 Indian market estimates (pre-GST).
 * HSN codes per Indian GST classification.
 *
 * Categories:
 *   1. Cement & Binders
 *   2. Steel & Reinforcement
 *   3. Aggregates, Sand & Earth
 *   4. Bricks, Blocks & Masonry
 *   5. Concrete Admixtures & Chemicals
 *   6. Ready-Mix Concrete & Mortar
 *   7. Timber, Plywood & Shuttering
 *   8. Flooring, Tiling & Finishes
 *   9. Paints, Coatings & Waterproofing
 *  10. Roofing & Cladding
 *  11. Doors, Windows & Hardware
 *  12. Plumbing & Sanitary
 *  13. Electrical
 *  14. HVAC & Ventilation
 *  15. Fire Fighting & Safety
 *  16. Labour (Skilled)
 *  17. Labour (Unskilled)
 *  18. Equipment & Machinery (Hiring)
 *  19. Consumables & Misc
 *  20. Transportation
 */
import { ResourceType } from '@prisma/client';

export interface CatalogItem {
  name: string;
  type: ResourceType;
  unit: string;
  rate: number;
  gstRate: number;
  hsn?: string;
  category: string;
  brandOrSpec?: string;
}

export const CATALOG_DATA: CatalogItem[] = [
  // ════════════════════════════════════════════════════════════════
  // 1. CEMENT & BINDERS
  // ════════════════════════════════════════════════════════════════
  { name: 'OPC Cement 53 Grade', type: ResourceType.MATERIAL, unit: 'bag', rate: 420, gstRate: 28, hsn: '2523', category: 'Cement', brandOrSpec: 'UltraTech/ACC/Ambuja' },
  { name: 'OPC Cement 43 Grade', type: ResourceType.MATERIAL, unit: 'bag', rate: 395, gstRate: 28, hsn: '2523', category: 'Cement', brandOrSpec: 'UltraTech/ACC/Ambuja' },
  { name: 'PPC Cement', type: ResourceType.MATERIAL, unit: 'bag', rate: 380, gstRate: 28, hsn: '2523', category: 'Cement', brandOrSpec: 'Fly ash based' },
  { name: 'PSC Cement (Slag)', type: ResourceType.MATERIAL, unit: 'bag', rate: 370, gstRate: 28, hsn: '2523', category: 'Cement' },
  { name: 'White Cement', type: ResourceType.MATERIAL, unit: 'bag', rate: 850, gstRate: 28, hsn: '2523', category: 'Cement', brandOrSpec: 'Birla White/JK' },
  { name: 'Sulphate Resistant Cement', type: ResourceType.MATERIAL, unit: 'bag', rate: 460, gstRate: 28, hsn: '2523', category: 'Cement' },
  { name: 'Rapid Hardening Cement', type: ResourceType.MATERIAL, unit: 'bag', rate: 520, gstRate: 28, hsn: '2523', category: 'Cement' },
  { name: 'Low Heat Cement', type: ResourceType.MATERIAL, unit: 'bag', rate: 480, gstRate: 28, hsn: '2523', category: 'Cement' },
  { name: 'Lime (Hydrated)', type: ResourceType.MATERIAL, unit: 'bag', rate: 180, gstRate: 18, hsn: '2522', category: 'Cement' },
  { name: 'Gypsum Plaster', type: ResourceType.MATERIAL, unit: 'bag', rate: 280, gstRate: 18, hsn: '2520', category: 'Cement' },
  { name: 'Plaster of Paris (POP)', type: ResourceType.MATERIAL, unit: 'bag', rate: 320, gstRate: 18, hsn: '2520', category: 'Cement' },
  { name: 'Cement (Bulk - Silo)', type: ResourceType.MATERIAL, unit: 'ton', rate: 7800, gstRate: 28, hsn: '2523', category: 'Cement', brandOrSpec: 'Bulk tanker delivery' },

  // ════════════════════════════════════════════════════════════════
  // 2. STEEL & REINFORCEMENT
  // ════════════════════════════════════════════════════════════════
  { name: 'TMT Steel Fe500 8mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 75, gstRate: 18, hsn: '7213', category: 'Steel', brandOrSpec: 'Tata/JSW/SAIL/Vizag' },
  { name: 'TMT Steel Fe500 10mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 74, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500 12mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 73, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500 16mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 72, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500 20mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 72, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500 25mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 73, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500 28mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 74, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500 32mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 75, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe500D', type: ResourceType.MATERIAL, unit: 'kg', rate: 76, gstRate: 18, hsn: '7213', category: 'Steel', brandOrSpec: 'Ductile grade' },
  { name: 'TMT Steel Fe550', type: ResourceType.MATERIAL, unit: 'kg', rate: 78, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'TMT Steel Fe600', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7213', category: 'Steel' },
  { name: 'Mild Steel Round Bar 12mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 68, gstRate: 18, hsn: '7214', category: 'Steel' },
  { name: 'Mild Steel Round Bar 16mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 68, gstRate: 18, hsn: '7214', category: 'Steel' },
  { name: 'Mild Steel Round Bar 20mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 68, gstRate: 18, hsn: '7214', category: 'Steel' },
  { name: 'Binding Wire 18G', type: ResourceType.MATERIAL, unit: 'kg', rate: 68, gstRate: 18, hsn: '7217', category: 'Steel' },
  { name: 'Binding Wire 16G', type: ResourceType.MATERIAL, unit: 'kg', rate: 65, gstRate: 18, hsn: '7217', category: 'Steel' },
  { name: 'Welded Wire Mesh 100x100x4mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 120, gstRate: 18, hsn: '7314', category: 'Steel' },
  { name: 'GI Wire 14G', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7217', category: 'Steel' },
  { name: 'Cover Blocks (PVC) 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 3, gstRate: 18, hsn: '3926', category: 'Steel' },
  { name: 'Cover Blocks (PVC) 40mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 3.5, gstRate: 18, hsn: '3926', category: 'Steel' },
  { name: 'Cover Blocks (PVC) 50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 4, gstRate: 18, hsn: '3926', category: 'Steel' },
  { name: 'Cover Blocks (Concrete) 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 2, gstRate: 0, hsn: '6810', category: 'Steel' },
  { name: 'Rebar Coupler 20mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '7318', category: 'Steel' },
  { name: 'Rebar Coupler 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 220, gstRate: 18, hsn: '7318', category: 'Steel' },
  { name: 'MS Flat 25x3mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 72, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Flat 40x6mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 72, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Angle 50x50x6mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 74, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Angle 75x75x8mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 76, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Channel 100x50mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 76, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Channel 200x75mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 78, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Beam ISMB 200', type: ResourceType.MATERIAL, unit: 'kg', rate: 78, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Beam ISMB 300', type: ResourceType.MATERIAL, unit: 'kg', rate: 79, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'MS Plate 6mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 78, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'MS Plate 10mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 78, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'MS Plate 12mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 79, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'MS Plate 16mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 80, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'HR Sheet 2mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 75, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'HR Sheet 3mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 75, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'CR Sheet 1.2mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 82, gstRate: 18, hsn: '7209', category: 'Steel' },
  { name: 'Chequered Plate 6mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 82, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'Stainless Steel Sheet 304 1mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '7220', category: 'Steel' },
  { name: 'Stainless Steel Pipe 50mm 304', type: ResourceType.MATERIAL, unit: 'rmt', rate: 380, gstRate: 18, hsn: '7306', category: 'Steel' },

  // ════════════════════════════════════════════════════════════════
  // 3. AGGREGATES, SAND & EARTH
  // ════════════════════════════════════════════════════════════════
  { name: 'River Sand (Fine)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1800, gstRate: 5, hsn: '2505', category: 'Aggregates' },
  { name: 'River Sand (Medium)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1750, gstRate: 5, hsn: '2505', category: 'Aggregates' },
  { name: 'River Sand (Coarse)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1700, gstRate: 5, hsn: '2505', category: 'Aggregates' },
  { name: 'M-Sand (Manufactured)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1650, gstRate: 5, hsn: '2505', category: 'Aggregates' },
  { name: '40mm Aggregate', type: ResourceType.MATERIAL, unit: 'cum', rate: 1300, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: '20mm Aggregate', type: ResourceType.MATERIAL, unit: 'cum', rate: 1400, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: '12.5mm Aggregate', type: ResourceType.MATERIAL, unit: 'cum', rate: 1450, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: '10mm Aggregate', type: ResourceType.MATERIAL, unit: 'cum', rate: 1350, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: '6mm Aggregate (Grit)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1500, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Stone Dust', type: ResourceType.MATERIAL, unit: 'cum', rate: 1200, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Moorum (Gravel)', type: ResourceType.MATERIAL, unit: 'cum', rate: 650, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'GSB (Granular Sub-Base)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1450, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'WMM (Wet Mix Macadam)', type: ResourceType.MATERIAL, unit: 'cum', rate: 2100, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Red Earth', type: ResourceType.MATERIAL, unit: 'cum', rate: 350, gstRate: 0, category: 'Aggregates' },
  { name: 'Black Cotton Soil', type: ResourceType.MATERIAL, unit: 'cum', rate: 300, gstRate: 0, category: 'Aggregates' },
  { name: 'Quarry Dust', type: ResourceType.MATERIAL, unit: 'cum', rate: 1100, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Boulder 200-300mm', type: ResourceType.MATERIAL, unit: 'cum', rate: 800, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Stone Metal 63mm', type: ResourceType.MATERIAL, unit: 'cum', rate: 1250, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Kankar (Limestone)', type: ResourceType.MATERIAL, unit: 'cum', rate: 700, gstRate: 5, hsn: '2521', category: 'Aggregates' },
  { name: 'Laterite Stone', type: ResourceType.MATERIAL, unit: 'cum', rate: 900, gstRate: 5, hsn: '2517', category: 'Aggregates' },

  // ════════════════════════════════════════════════════════════════
  // 4. BRICKS, BLOCKS & MASONRY
  // ════════════════════════════════════════════════════════════════
  { name: 'Red Clay Brick Class A 230x115x75', type: ResourceType.MATERIAL, unit: 'piece', rate: 9, gstRate: 5, hsn: '6904', category: 'Bricks' },
  { name: 'Red Clay Brick Class B 230x115x75', type: ResourceType.MATERIAL, unit: 'piece', rate: 8, gstRate: 5, hsn: '6904', category: 'Bricks' },
  { name: 'Fly Ash Brick 230x110x75', type: ResourceType.MATERIAL, unit: 'piece', rate: 8, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Fly Ash Brick 230x100x75', type: ResourceType.MATERIAL, unit: 'piece', rate: 7.5, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'AAC Block 600x200x100mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 55, gstRate: 12, hsn: '6810', category: 'Bricks' },
  { name: 'AAC Block 600x200x150mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 75, gstRate: 12, hsn: '6810', category: 'Bricks' },
  { name: 'AAC Block 600x200x200mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 95, gstRate: 12, hsn: '6810', category: 'Bricks' },
  { name: 'AAC Block 600x200x250mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 115, gstRate: 12, hsn: '6810', category: 'Bricks' },
  { name: 'Solid Concrete Block 400x200x200', type: ResourceType.MATERIAL, unit: 'piece', rate: 38, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Solid Concrete Block 400x200x150', type: ResourceType.MATERIAL, unit: 'piece', rate: 32, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Solid Concrete Block 400x200x100', type: ResourceType.MATERIAL, unit: 'piece', rate: 25, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Hollow Concrete Block 400x200x200', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Interlocking Paver Block 60mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 28, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Interlocking Paver Block 80mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 35, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Kerb Stone RCC 300x150', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Precast Concrete Tile 300x300', type: ResourceType.MATERIAL, unit: 'piece', rate: 35, gstRate: 5, hsn: '6810', category: 'Bricks' },
  { name: 'Wire Cut Brick', type: ResourceType.MATERIAL, unit: 'piece', rate: 12, gstRate: 5, hsn: '6904', category: 'Bricks' },
  { name: 'Fire Brick', type: ResourceType.MATERIAL, unit: 'piece', rate: 65, gstRate: 5, hsn: '6902', category: 'Bricks' },
  { name: 'Glazed Brick', type: ResourceType.MATERIAL, unit: 'piece', rate: 25, gstRate: 5, hsn: '6904', category: 'Bricks' },
  { name: 'Designer Brick', type: ResourceType.MATERIAL, unit: 'piece', rate: 22, gstRate: 5, hsn: '6904', category: 'Bricks' },

  // ════════════════════════════════════════════════════════════════
  // 5. CONCRETE ADMIXTURES & CHEMICALS
  // ════════════════════════════════════════════════════════════════
  { name: 'Superplasticizer (SNF Based)', type: ResourceType.MATERIAL, unit: 'litre', rate: 95, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Superplasticizer (PCE Based)', type: ResourceType.MATERIAL, unit: 'litre', rate: 135, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Water Reducing Admixture', type: ResourceType.MATERIAL, unit: 'litre', rate: 75, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Retarding Admixture', type: ResourceType.MATERIAL, unit: 'litre', rate: 85, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Accelerating Admixture', type: ResourceType.MATERIAL, unit: 'litre', rate: 90, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Air Entraining Agent', type: ResourceType.MATERIAL, unit: 'litre', rate: 110, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Integral Waterproofing Compound (Powder)', type: ResourceType.MATERIAL, unit: 'kg', rate: 185, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Integral Waterproofing Liquid', type: ResourceType.MATERIAL, unit: 'litre', rate: 140, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Curing Compound (Wax Based)', type: ResourceType.MATERIAL, unit: 'litre', rate: 120, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Curing Compound (Resin Based)', type: ResourceType.MATERIAL, unit: 'litre', rate: 150, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Polypropylene Fibre (Monolithic)', type: ResourceType.MATERIAL, unit: 'kg', rate: 220, gstRate: 18, hsn: '5501', category: 'Admixtures' },
  { name: 'Steel Fibres for Concrete', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7213', category: 'Admixtures' },
  { name: 'Glass Fibre Mesh', type: ResourceType.MATERIAL, unit: 'sqm', rate: 85, gstRate: 18, hsn: '7019', category: 'Admixtures' },
  { name: 'Silica Fume (Densified)', type: ResourceType.MATERIAL, unit: 'kg', rate: 35, gstRate: 18, hsn: '2811', category: 'Admixtures' },
  { name: 'Fly Ash (Pond Ash)', type: ResourceType.MATERIAL, unit: 'kg', rate: 2.5, gstRate: 5, hsn: '2621', category: 'Admixtures' },
  { name: 'GGBS (Ground Granulated Blast Slag)', type: ResourceType.MATERIAL, unit: 'kg', rate: 4.5, gstRate: 5, hsn: '2618', category: 'Admixtures' },
  { name: 'SBR Latex Bonding Agent', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '4002', category: 'Admixtures' },
  { name: 'Epoxy Bonding Agent', type: ResourceType.MATERIAL, unit: 'kg', rate: 450, gstRate: 18, hsn: '3907', category: 'Admixtures' },
  { name: 'Shrinkage Compensating Agent', type: ResourceType.MATERIAL, unit: 'kg', rate: 210, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Anti-termite Compound', type: ResourceType.MATERIAL, unit: 'litre', rate: 320, gstRate: 18, hsn: '3808', category: 'Admixtures' },
  { name: 'Foaming Agent (CLC)', type: ResourceType.MATERIAL, unit: 'litre', rate: 120, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Concrete Densifier (Lithium)', type: ResourceType.MATERIAL, unit: 'litre', rate: 280, gstRate: 18, hsn: '3824', category: 'Admixtures' },

  // ════════════════════════════════════════════════════════════════
  // 6. READY-MIX CONCRETE & MORTAR
  // ════════════════════════════════════════════════════════════════
  { name: 'RMC M10', type: ResourceType.MATERIAL, unit: 'cum', rate: 3800, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'RMC M15', type: ResourceType.MATERIAL, unit: 'cum', rate: 4200, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'RMC M20', type: ResourceType.MATERIAL, unit: 'cum', rate: 4500, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'RMC M25', type: ResourceType.MATERIAL, unit: 'cum', rate: 5200, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'RMC M30', type: ResourceType.MATERIAL, unit: 'cum', rate: 5800, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'RMC M35', type: ResourceType.MATERIAL, unit: 'cum', rate: 6200, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'RMC M40', type: ResourceType.MATERIAL, unit: 'cum', rate: 6800, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'Dry Mix Mortar (CM 1:6)', type: ResourceType.MATERIAL, unit: 'cum', rate: 4200, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'Dry Mix Mortar (CM 1:4)', type: ResourceType.MATERIAL, unit: 'cum', rate: 4800, gstRate: 18, hsn: '3824', category: 'RMC' },
  { name: 'Tile Adhesive (Premium)', type: ResourceType.MATERIAL, unit: 'bag', rate: 420, gstRate: 18, hsn: '3214', category: 'RMC' },
  { name: 'Tile Adhesive (Standard)', type: ResourceType.MATERIAL, unit: 'bag', rate: 320, gstRate: 18, hsn: '3214', category: 'RMC' },
  { name: 'Tile Grout (White)', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '3214', category: 'RMC' },
  { name: 'Tile Grout (Colour)', type: ResourceType.MATERIAL, unit: 'kg', rate: 120, gstRate: 18, hsn: '3214', category: 'RMC' },
  { name: 'Block Fixing Adhesive', type: ResourceType.MATERIAL, unit: 'bag', rate: 380, gstRate: 18, hsn: '3214', category: 'RMC' },
  { name: 'Self-Leveling Compound', type: ResourceType.MATERIAL, unit: 'bag', rate: 650, gstRate: 18, hsn: '3214', category: 'RMC' },
  { name: 'Micro-concrete (Non-Shrink)', type: ResourceType.MATERIAL, unit: 'cum', rate: 5500, gstRate: 18, hsn: '3824', category: 'RMC' },

  // ════════════════════════════════════════════════════════════════
  // 7. TIMBER, PLYWOOD & SHUTTERING
  // ════════════════════════════════════════════════════════════════
  { name: 'Shuttering Plywood 12mm Waterproof', type: ResourceType.MATERIAL, unit: 'sqft', rate: 52, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'Shuttering Plywood 18mm Waterproof', type: ResourceType.MATERIAL, unit: 'sqft', rate: 62, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'Commercial Plywood 6mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 35, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'Commercial Plywood 12mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 48, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'Commercial Plywood 18mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 62, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'Marine Plywood 18mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 95, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'MDF Board 18mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 38, gstRate: 18, hsn: '4411', category: 'Timber' },
  { name: 'Particle Board 18mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 28, gstRate: 18, hsn: '4410', category: 'Timber' },
  { name: 'Block Board 19mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 72, gstRate: 18, hsn: '4412', category: 'Timber' },
  { name: 'Teak Wood', type: ResourceType.MATERIAL, unit: 'cft', rate: 2200, gstRate: 18, hsn: '4403', category: 'Timber' },
  { name: 'Sal Wood', type: ResourceType.MATERIAL, unit: 'cft', rate: 1800, gstRate: 18, hsn: '4403', category: 'Timber' },
  { name: 'Pine Wood', type: ResourceType.MATERIAL, unit: 'cft', rate: 950, gstRate: 18, hsn: '4403', category: 'Timber' },
  { name: 'Merranti Wood', type: ResourceType.MATERIAL, unit: 'cft', rate: 1200, gstRate: 18, hsn: '4403', category: 'Timber' },
  { name: 'Flush Door Shutter 35mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 180, gstRate: 18, hsn: '4418', category: 'Timber' },
  { name: 'H-Frame Shuttering (Steel)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 350, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Acrow Span 3.5m', type: ResourceType.MATERIAL, unit: 'piece', rate: 2800, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Centering Plate 60x60cm', type: ResourceType.MATERIAL, unit: 'piece', rate: 450, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Centering Plate 60x90cm', type: ResourceType.MATERIAL, unit: 'piece', rate: 620, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Adjustable Prop 3-5m', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Cup Lock Vertical 3m', type: ResourceType.MATERIAL, unit: 'rmt', rate: 380, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Cup Lock Horizontal 1m', type: ResourceType.MATERIAL, unit: 'piece', rate: 250, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Scaffolding Pipe 40mm NB', type: ResourceType.MATERIAL, unit: 'rmt', rate: 185, gstRate: 18, hsn: '7306', category: 'Timber' },
  { name: 'Scaffolding Coupler (Right Angle)', type: ResourceType.MATERIAL, unit: 'piece', rate: 35, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Scaffolding Coupler (Swivel)', type: ResourceType.MATERIAL, unit: 'piece', rate: 42, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Scaffolding Jack (Base Plate)', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '7308', category: 'Timber' },
  { name: 'Bamboo Scaffolding Pole', type: ResourceType.MATERIAL, unit: 'rmt', rate: 45, gstRate: 0, hsn: '1401', category: 'Timber' },
  { name: 'Wood Primer', type: ResourceType.MATERIAL, unit: 'litre', rate: 220, gstRate: 18, hsn: '3210', category: 'Timber' },
  { name: 'Linseed Oil', type: ResourceType.MATERIAL, unit: 'litre', rate: 280, gstRate: 18, hsn: '1515', category: 'Timber' },
  { name: 'Wood Preservative (Boron)', type: ResourceType.MATERIAL, unit: 'litre', rate: 320, gstRate: 18, hsn: '3808', category: 'Timber' },

  // ════════════════════════════════════════════════════════════════
  // 8. FLOORING, TILING & FINISHES
  // ════════════════════════════════════════════════════════════════
  { name: 'Vitrified Tile 600x600 Polished', type: ResourceType.MATERIAL, unit: 'sqft', rate: 55, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Vitrified Tile 600x600 Glazed', type: ResourceType.MATERIAL, unit: 'sqft', rate: 48, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Vitrified Tile 600x1200', type: ResourceType.MATERIAL, unit: 'sqft', rate: 68, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Ceramic Wall Tile 300x600', type: ResourceType.MATERIAL, unit: 'sqft', rate: 28, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Ceramic Wall Tile 250x375', type: ResourceType.MATERIAL, unit: 'sqft', rate: 22, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Ceramic Floor Tile 300x300', type: ResourceType.MATERIAL, unit: 'sqft', rate: 32, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Ceramic Floor Tile 600x600', type: ResourceType.MATERIAL, unit: 'sqft', rate: 48, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Porcelain Tile 600x600', type: ResourceType.MATERIAL, unit: 'sqft', rate: 65, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Granite Slab 20mm Polished', type: ResourceType.MATERIAL, unit: 'sqft', rate: 185, gstRate: 18, hsn: '6802', category: 'Flooring' },
  { name: 'Granite Slab 18mm Flamed', type: ResourceType.MATERIAL, unit: 'sqft', rate: 220, gstRate: 18, hsn: '6802', category: 'Flooring' },
  { name: 'Marble Slab (Makrana) 20mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 280, gstRate: 18, hsn: '2515', category: 'Flooring' },
  { name: 'Marble Slab (Italian) 20mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 450, gstRate: 18, hsn: '2515', category: 'Flooring' },
  { name: 'Kota Stone 25mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 65, gstRate: 18, hsn: '2516', category: 'Flooring' },
  { name: 'Sandstone Slab (Dholpur) 30mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '2516', category: 'Flooring' },
  { name: 'Slate Stone', type: ResourceType.MATERIAL, unit: 'sqft', rate: 75, gstRate: 18, hsn: '2514', category: 'Flooring' },
  { name: 'Commercial Carpet Tile', type: ResourceType.MATERIAL, unit: 'sqm', rate: 680, gstRate: 18, hsn: '5703', category: 'Flooring' },
  { name: 'Broadloom Carpet', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '5703', category: 'Flooring' },
  { name: 'Vinyl Flooring 2mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 65, gstRate: 18, hsn: '3918', category: 'Flooring' },
  { name: 'Vinyl Plank Flooring 4mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 95, gstRate: 18, hsn: '3918', category: 'Flooring' },
  { name: 'Epoxy Flooring 3mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 120, gstRate: 18, hsn: '3907', category: 'Flooring' },
  { name: 'PU Flooring 3mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 180, gstRate: 18, hsn: '3907', category: 'Flooring' },
  { name: 'Wooden Laminate Flooring 8mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '4411', category: 'Flooring' },
  { name: 'Engineered Wood Flooring 12mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 180, gstRate: 18, hsn: '4412', category: 'Flooring' },
  { name: 'Terrazzo Tile 400x400', type: ResourceType.MATERIAL, unit: 'piece', rate: 120, gstRate: 18, hsn: '6810', category: 'Flooring' },
  { name: 'Anti-skid Tile 300x300', type: ResourceType.MATERIAL, unit: 'sqft', rate: 42, gstRate: 18, hsn: '6907', category: 'Flooring' },
  { name: 'Glass Mosaic Tile', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '7016', category: 'Flooring' },
  { name: 'Quartz Surface Slab', type: ResourceType.MATERIAL, unit: 'sqft', rate: 320, gstRate: 18, hsn: '6815', category: 'Flooring' },
  { name: 'Wall Paper (Vinyl) 55 sqft Roll', type: ResourceType.MATERIAL, unit: 'roll', rate: 1800, gstRate: 18, hsn: '4814', category: 'Flooring' },
  { name: 'False Ceiling Tile (Mineral Fiber) 600x600', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '6806', category: 'Flooring' },
  { name: 'Gypsum Board 12.5mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 180, gstRate: 18, hsn: '6809', category: 'Flooring' },
  { name: 'GI Grid Main Runner', type: ResourceType.MATERIAL, unit: 'rmt', rate: 65, gstRate: 18, hsn: '7308', category: 'Flooring' },
  { name: 'GI Grid Cross Tee', type: ResourceType.MATERIAL, unit: 'rmt', rate: 38, gstRate: 18, hsn: '7308', category: 'Flooring' },
  { name: 'Wall Putty (Cement Based)', type: ResourceType.MATERIAL, unit: 'bag', rate: 580, gstRate: 18, hsn: '3214', category: 'Flooring' },
  { name: 'Wall Putty (Acrylic Ready Mix)', type: ResourceType.MATERIAL, unit: 'kg', rate: 35, gstRate: 18, hsn: '3214', category: 'Flooring' },
  { name: 'Primer (Cement/Water Based)', type: ResourceType.MATERIAL, unit: 'litre', rate: 160, gstRate: 18, hsn: '3210', category: 'Flooring' },
  { name: 'Primer (Acrylic)', type: ResourceType.MATERIAL, unit: 'litre', rate: 220, gstRate: 18, hsn: '3210', category: 'Flooring' },
  { name: 'Corner Bead (GI)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 25, gstRate: 18, hsn: '7308', category: 'Flooring' },
  { name: 'Jointing Tape (Fiber Mesh)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 8, gstRate: 18, hsn: '5903', category: 'Flooring' },
  { name: 'Marble Chips (Terrazzo)', type: ResourceType.MATERIAL, unit: 'kg', rate: 12, gstRate: 5, hsn: '2517', category: 'Flooring' },
  { name: 'PVC Skirting 75mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 45, gstRate: 18, hsn: '3916', category: 'Flooring' },
  { name: 'Corian Solid Surface', type: ResourceType.MATERIAL, unit: 'sqft', rate: 450, gstRate: 18, hsn: '3920', category: 'Flooring' },
  { name: 'Epoxy Primer', type: ResourceType.MATERIAL, unit: 'kg', rate: 450, gstRate: 18, hsn: '3907', category: 'Flooring' },
  { name: 'Colour Oxide (Red/Green)', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '3206', category: 'Flooring' },
  { name: 'Brass Divider Strip', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '7411', category: 'Flooring' },
  { name: 'Laminate Accessories (T-Molding)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '3916', category: 'Flooring' },
  { name: 'Wood Flooring Adhesive', type: ResourceType.MATERIAL, unit: 'kg', rate: 280, gstRate: 18, hsn: '3506', category: 'Flooring' },
  { name: 'Acoustic Underlay 5mm (Floor)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '3918', category: 'Flooring' },

  // ════════════════════════════════════════════════════════════════
  // 9. PAINTS, COATINGS & WATERPROOFING
  // ════════════════════════════════════════════════════════════════
  { name: 'Exterior Emulsion Paint (Premium)', type: ResourceType.MATERIAL, unit: 'litre', rate: 420, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Interior Emulsion (Premium)', type: ResourceType.MATERIAL, unit: 'litre', rate: 380, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Interior Emulsion (Economy)', type: ResourceType.MATERIAL, unit: 'litre', rate: 220, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Enamel Paint (Oil Based)', type: ResourceType.MATERIAL, unit: 'litre', rate: 350, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Distemper (Acrylic)', type: ResourceType.MATERIAL, unit: 'kg', rate: 55, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Distemper (Dry)', type: ResourceType.MATERIAL, unit: 'kg', rate: 32, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Cement Paint', type: ResourceType.MATERIAL, unit: 'kg', rate: 45, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Lime Wash', type: ResourceType.MATERIAL, unit: 'kg', rate: 12, gstRate: 0, hsn: '2522', category: 'Paints' },
  { name: 'Texture Paint', type: ResourceType.MATERIAL, unit: 'kg', rate: 180, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Wood Polish (Melamine)', type: ResourceType.MATERIAL, unit: 'litre', rate: 280, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'PU Polish', type: ResourceType.MATERIAL, unit: 'litre', rate: 450, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'French Polish', type: ResourceType.MATERIAL, unit: 'litre', rate: 320, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Varnish (Synthetic)', type: ResourceType.MATERIAL, unit: 'litre', rate: 250, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Aluminium Paint', type: ResourceType.MATERIAL, unit: 'litre', rate: 380, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Bituminous Paint', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Epoxy Paint (Industrial)', type: ResourceType.MATERIAL, unit: 'litre', rate: 520, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Heat Resistant Paint', type: ResourceType.MATERIAL, unit: 'litre', rate: 650, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Anti-Corrosive Primer', type: ResourceType.MATERIAL, unit: 'litre', rate: 280, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Red Oxide Primer', type: ResourceType.MATERIAL, unit: 'litre', rate: 220, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Zinc Chromate Primer', type: ResourceType.MATERIAL, unit: 'litre', rate: 350, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Elastomeric Waterproofing Coating', type: ResourceType.MATERIAL, unit: 'litre', rate: 220, gstRate: 18, hsn: '3907', category: 'Waterproofing' },
  { name: 'APP Waterproofing Membrane 4mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '6807', category: 'Waterproofing' },
  { name: 'SBS Waterproofing Membrane 4mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 320, gstRate: 18, hsn: '6807', category: 'Waterproofing' },
  { name: 'Self-Adhesive Waterproofing Membrane', type: ResourceType.MATERIAL, unit: 'sqm', rate: 180, gstRate: 18, hsn: '6807', category: 'Waterproofing' },
  { name: 'Geo-membrane HDPE 1mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 150, gstRate: 18, hsn: '3920', category: 'Waterproofing' },
  { name: 'Bentonite Waterproofing', type: ResourceType.MATERIAL, unit: 'kg', rate: 35, gstRate: 18, hsn: '2508', category: 'Waterproofing' },
  { name: 'Crystalline Waterproofing', type: ResourceType.MATERIAL, unit: 'kg', rate: 220, gstRate: 18, hsn: '3824', category: 'Waterproofing' },
  { name: 'PU Waterproofing (Liquid)', type: ResourceType.MATERIAL, unit: 'litre', rate: 350, gstRate: 18, hsn: '3907', category: 'Waterproofing' },
  { name: 'Acrylic Waterproofing Coating', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3907', category: 'Waterproofing' },
  { name: 'Silicone Sealant', type: ResourceType.MATERIAL, unit: 'tube', rate: 180, gstRate: 18, hsn: '3506', category: 'Waterproofing' },
  { name: 'Polyurethane Sealant', type: ResourceType.MATERIAL, unit: 'tube', rate: 280, gstRate: 18, hsn: '3907', category: 'Waterproofing' },
  { name: 'Polysulphide Sealant', type: ResourceType.MATERIAL, unit: 'kg', rate: 450, gstRate: 18, hsn: '3910', category: 'Waterproofing' },
  { name: 'Butyl Rubber Tape', type: ResourceType.MATERIAL, unit: 'rmt', rate: 65, gstRate: 18, hsn: '4007', category: 'Waterproofing' },
  { name: 'EPDM Membrane 1.5mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 380, gstRate: 18, hsn: '4008', category: 'Waterproofing' },

  // ════════════════════════════════════════════════════════════════
  // 10. ROOFING & CLADDING
  // ════════════════════════════════════════════════════════════════
  { name: 'Pre-coated GI Roofing Sheet 0.50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 380, gstRate: 18, hsn: '7210', category: 'Roofing' },
  { name: 'Pre-coated GI Roofing Sheet 0.30mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '7210', category: 'Roofing' },
  { name: 'Aluminium Roofing Sheet 0.70mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 650, gstRate: 18, hsn: '7606', category: 'Roofing' },
  { name: 'Polycarbonate Sheet 4mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 450, gstRate: 18, hsn: '3920', category: 'Roofing' },
  { name: 'FRP Roofing Sheet 1.5mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 320, gstRate: 18, hsn: '3926', category: 'Roofing' },
  { name: 'Asbestos Cement Sheet 6mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 180, gstRate: 18, hsn: '6811', category: 'Roofing' },
  { name: 'Colour Coated Roofing Sheet 0.50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 420, gstRate: 18, hsn: '7210', category: 'Roofing' },
  { name: 'Roofing Screw with EPDM Washer', type: ResourceType.MATERIAL, unit: 'piece', rate: 8, gstRate: 18, hsn: '7318', category: 'Roofing' },
  { name: 'Ridge Cap GI', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '7210', category: 'Roofing' },
  { name: 'Turbo Ventilator', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '8414', category: 'Roofing' },
  { name: 'Insulated Panel (PUF) 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '3925', category: 'Roofing' },
  { name: 'Clay Roof Tile (Mangalore)', type: ResourceType.MATERIAL, unit: 'piece', rate: 22, gstRate: 5, hsn: '6905', category: 'Roofing' },
  { name: 'Concrete Roof Tile', type: ResourceType.MATERIAL, unit: 'piece', rate: 35, gstRate: 5, hsn: '6810', category: 'Roofing' },
  { name: 'Roofing Shingle (Asphalt)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '6807', category: 'Roofing' },
  { name: 'Solar Reflective Coating', type: ResourceType.MATERIAL, unit: 'litre', rate: 320, gstRate: 18, hsn: '3208', category: 'Roofing' },
  { name: 'Sky-light Panel Polycarbonate', type: ResourceType.MATERIAL, unit: 'sqm', rate: 550, gstRate: 18, hsn: '3920', category: 'Roofing' },
  { name: 'GI Gutter Downspout 100mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '7306', category: 'Roofing' },
  { name: 'Rain Water Pipe PVC 110mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 220, gstRate: 18, hsn: '3917', category: 'Roofing' },
  { name: 'Fascia Board (GI) 300mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '7210', category: 'Roofing' },

  // ════════════════════════════════════════════════════════════════
  // 11. DOORS, WINDOWS & HARDWARE
  // ════════════════════════════════════════════════════════════════
  { name: 'Teak Wood Door Frame 100x65mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 450, gstRate: 18, hsn: '4409', category: 'Doors' },
  { name: 'Flush Door Shutter 35mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 180, gstRate: 18, hsn: '4418', category: 'Doors' },
  { name: 'PVC Door Shutter', type: ResourceType.MATERIAL, unit: 'sqft', rate: 120, gstRate: 18, hsn: '3925', category: 'Doors' },
  { name: 'Aluminium Sliding Door Section', type: ResourceType.MATERIAL, unit: 'kg', rate: 285, gstRate: 18, hsn: '7610', category: 'Doors' },
  { name: 'Aluminium Window Section', type: ResourceType.MATERIAL, unit: 'kg', rate: 285, gstRate: 18, hsn: '7610', category: 'Doors' },
  { name: 'UPVC Window Section', type: ResourceType.MATERIAL, unit: 'rmt', rate: 320, gstRate: 18, hsn: '3916', category: 'Doors' },
  { name: 'Float Glass 6mm Clear', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '7005', category: 'Doors' },
  { name: 'Float Glass 8mm Clear', type: ResourceType.MATERIAL, unit: 'sqft', rate: 115, gstRate: 18, hsn: '7005', category: 'Doors' },
  { name: 'Float Glass 12mm Clear', type: ResourceType.MATERIAL, unit: 'sqft', rate: 180, gstRate: 18, hsn: '7005', category: 'Doors' },
  { name: 'Toughened Glass 10mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 150, gstRate: 18, hsn: '7007', category: 'Doors' },
  { name: 'Toughened Glass 12mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 195, gstRate: 18, hsn: '7007', category: 'Doors' },
  { name: 'Laminated Glass 6.38mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 165, gstRate: 18, hsn: '7007', category: 'Doors' },
  { name: 'Reflective Glass 6mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 140, gstRate: 18, hsn: '7005', category: 'Doors' },
  { name: 'Double Glazing Unit (DGU) 6-12-6', type: ResourceType.MATERIAL, unit: 'sqft', rate: 280, gstRate: 18, hsn: '7008', category: 'Doors' },
  { name: 'Stainless Steel Hinge 100mm (Pair)', type: ResourceType.MATERIAL, unit: 'pair', rate: 85, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Mortice Lock Set (Godrej)', type: ResourceType.MATERIAL, unit: 'set', rate: 850, gstRate: 18, hsn: '8301', category: 'Doors' },
  { name: 'Door Handle SS', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Door Closer (Hydraulic)', type: ResourceType.MATERIAL, unit: 'piece', rate: 650, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Floor Spring (Concealed)', type: ResourceType.MATERIAL, unit: 'piece', rate: 2200, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Sliding Door Track Set', type: ResourceType.MATERIAL, unit: 'set', rate: 850, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Aldrop (MS Galvanized)', type: ResourceType.MATERIAL, unit: 'piece', rate: 280, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Tower Bolt SS 150mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 65, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Magic Eye (Peephole)', type: ResourceType.MATERIAL, unit: 'piece', rate: 120, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Roller Shutter (GI) 0.8mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 450, gstRate: 18, hsn: '7308', category: 'Doors' },

  // ════════════════════════════════════════════════════════════════
  // 12. PLUMBING & SANITARY
  // ════════════════════════════════════════════════════════════════
  { name: 'GI Pipe 25mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 145, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 50mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 285, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'CPVC Pipe 15mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 65, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Pipe 25mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 95, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Pipe 50mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 220, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'UPVC Pipe 110mm SWR', type: ResourceType.MATERIAL, unit: 'metre', rate: 220, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'UPVC Pipe 160mm SWR', type: ResourceType.MATERIAL, unit: 'metre', rate: 420, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'PPR Pipe 25mm PN 10', type: ResourceType.MATERIAL, unit: 'metre', rate: 85, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Elbow 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 18, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Tee 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 22, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Coupler 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 12, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Reducer 25-20mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 15, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC End Cap 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 14, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'UPVC Bend 110mm SWR', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'UPVC Tee 110mm SWR', type: ResourceType.MATERIAL, unit: 'piece', rate: 95, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'P-Trap 110mm UPVC', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'Floor Trap 110mm UPVC', type: ResourceType.MATERIAL, unit: 'piece', rate: 150, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Solvent Cement', type: ResourceType.MATERIAL, unit: 'litre', rate: 350, gstRate: 18, hsn: '3506', category: 'Plumbing' },
  { name: 'Teflon Tape', type: ResourceType.MATERIAL, unit: 'roll', rate: 35, gstRate: 18, hsn: '3919', category: 'Plumbing' },
  { name: 'CP Brass Faucet (Mixer)', type: ResourceType.MATERIAL, unit: 'piece', rate: 1200, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'CP Brass Faucet (Pillar Cock)', type: ResourceType.MATERIAL, unit: 'piece', rate: 650, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'CP Brass Faucet (Angle Valve)', type: ResourceType.MATERIAL, unit: 'piece', rate: 380, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Wall Mixer 3-in-1', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Shower Head (Overhead) CP', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Indian Style WC (Orissa Pan)', type: ResourceType.MATERIAL, unit: 'piece', rate: 2200, gstRate: 18, hsn: '6910', category: 'Plumbing' },
  { name: 'Western Style WC (EWC) One-Piece', type: ResourceType.MATERIAL, unit: 'piece', rate: 8500, gstRate: 18, hsn: '6910', category: 'Plumbing' },
  { name: 'Western Style WC (EWC) Wall Mounted', type: ResourceType.MATERIAL, unit: 'piece', rate: 12000, gstRate: 18, hsn: '6910', category: 'Plumbing' },
  { name: 'Wash Basin (Counter Top)', type: ResourceType.MATERIAL, unit: 'piece', rate: 2800, gstRate: 18, hsn: '6910', category: 'Plumbing' },
  { name: 'Wash Basin (Wall Hung)', type: ResourceType.MATERIAL, unit: 'piece', rate: 1500, gstRate: 18, hsn: '6910', category: 'Plumbing' },
  { name: 'SS Sink 24x18 inch', type: ResourceType.MATERIAL, unit: 'piece', rate: 2800, gstRate: 18, hsn: '7323', category: 'Plumbing' },
  { name: 'SS Kitchen Sink 36x20 inch Double Bowl', type: ResourceType.MATERIAL, unit: 'piece', rate: 5200, gstRate: 18, hsn: '7323', category: 'Plumbing' },
  { name: 'Urinal (Wall Hung) Vitreous China', type: ResourceType.MATERIAL, unit: 'piece', rate: 3500, gstRate: 18, hsn: '6910', category: 'Plumbing' },
  { name: 'CP Brass Flush Valve (Concealed)', type: ResourceType.MATERIAL, unit: 'piece', rate: 4500, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'CP Flush Cistern (Half/Full)', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'CP Brass Bib Tap', type: ResourceType.MATERIAL, unit: 'piece', rate: 280, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'CP Brass Health Faucet Set', type: ResourceType.MATERIAL, unit: 'set', rate: 950, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Brass Gate Valve 50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'PPR Ball Valve 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Sluice Valve 80mm (CI)', type: ResourceType.MATERIAL, unit: 'piece', rate: 3200, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Non-Return Valve (CI) 80mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 2800, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Sintex Water Tank 1000L (Triple Layer)', type: ResourceType.MATERIAL, unit: 'piece', rate: 8500, gstRate: 18, hsn: '3925', category: 'Plumbing' },
  { name: 'Sintex Water Tank 5000L (Triple Layer)', type: ResourceType.MATERIAL, unit: 'piece', rate: 32000, gstRate: 18, hsn: '3925', category: 'Plumbing' },
  { name: 'Sintex Water Tank 10000L (Triple Layer)', type: ResourceType.MATERIAL, unit: 'piece', rate: 58000, gstRate: 18, hsn: '3925', category: 'Plumbing' },
  { name: 'Monoblock Water Pump 1HP', type: ResourceType.MATERIAL, unit: 'piece', rate: 8500, gstRate: 18, hsn: '8413', category: 'Plumbing' },
  { name: 'Monoblock Water Pump 2HP', type: ResourceType.MATERIAL, unit: 'piece', rate: 14500, gstRate: 18, hsn: '8413', category: 'Plumbing' },
  { name: 'Submersible Pump 5HP', type: ResourceType.MATERIAL, unit: 'piece', rate: 32000, gstRate: 18, hsn: '8413', category: 'Plumbing' },

  // ════════════════════════════════════════════════════════════════
  // 13. ELECTRICAL
  // ════════════════════════════════════════════════════════════════
  { name: 'PVC Conduit Pipe 20mm Heavy', type: ResourceType.MATERIAL, unit: 'metre', rate: 32, gstRate: 18, hsn: '3917', category: 'Electrical' },
  { name: 'PVC Conduit Pipe 25mm Heavy', type: ResourceType.MATERIAL, unit: 'metre', rate: 42, gstRate: 18, hsn: '3917', category: 'Electrical' },
  { name: 'Conduit Bend 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 8, gstRate: 18, hsn: '3917', category: 'Electrical' },
  { name: 'Conduit Junction Box 75x75 Round', type: ResourceType.MATERIAL, unit: 'piece', rate: 18, gstRate: 18, hsn: '3926', category: 'Electrical' },
  { name: 'GI Wire 14 SWG (for Earthing)', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7217', category: 'Electrical' },
  { name: 'Copper Wire 1.5 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 18, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 2.5 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 28, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 4.0 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 42, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 6.0 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 62, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 10 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 105, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 25 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 280, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Aluminium Cable 4 Core 25 sqmm Armoured', type: ResourceType.MATERIAL, unit: 'metre', rate: 380, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Aluminium Cable 4 Core 95 sqmm Armoured', type: ResourceType.MATERIAL, unit: 'metre', rate: 1200, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Switch 6A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 35, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Switch 16A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 55, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Switch 32A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 95, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Socket 6A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 38, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Socket 16A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 65, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'MCB 6A Single Pole C-Curve', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'MCB 16A Single Pole C-Curve', type: ResourceType.MATERIAL, unit: 'piece', rate: 185, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'MCB 32A Single Pole C-Curve', type: ResourceType.MATERIAL, unit: 'piece', rate: 220, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'MCB 63A DP C-Curve', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'RCCB 25A 30mA Double Pole', type: ResourceType.MATERIAL, unit: 'piece', rate: 1200, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'RCCB 40A 30mA Double Pole', type: ResourceType.MATERIAL, unit: 'piece', rate: 1450, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'MCCB 63A TP 25kA', type: ResourceType.MATERIAL, unit: 'piece', rate: 3500, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'MCCB 100A TP 25kA', type: ResourceType.MATERIAL, unit: 'piece', rate: 5800, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Distribution Board 8-Way Surface', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '8537', category: 'Electrical' },
  { name: 'Distribution Board 12-Way Surface', type: ResourceType.MATERIAL, unit: 'piece', rate: 1200, gstRate: 18, hsn: '8537', category: 'Electrical' },
  { name: 'LED Tube Light 20W', type: ResourceType.MATERIAL, unit: 'piece', rate: 280, gstRate: 18, hsn: '9405', category: 'Electrical' },
  { name: 'LED Panel Light 18W', type: ResourceType.MATERIAL, unit: 'piece', rate: 450, gstRate: 18, hsn: '9405', category: 'Electrical' },
  { name: 'LED Downlighter 12W', type: ResourceType.MATERIAL, unit: 'piece', rate: 220, gstRate: 18, hsn: '9405', category: 'Electrical' },
  { name: 'LED Street Light 60W', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '9405', category: 'Electrical' },
  { name: 'LED Flood Light 100W', type: ResourceType.MATERIAL, unit: 'piece', rate: 2200, gstRate: 18, hsn: '9405', category: 'Electrical' },
  { name: 'Ceiling Fan 48 inch', type: ResourceType.MATERIAL, unit: 'piece', rate: 1600, gstRate: 18, hsn: '8414', category: 'Electrical' },
  { name: 'Exhaust Fan 12 inch', type: ResourceType.MATERIAL, unit: 'piece', rate: 950, gstRate: 18, hsn: '8414', category: 'Electrical' },
  { name: 'Copper Earthing Plate 600x600x3mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '7409', category: 'Electrical' },
  { name: 'GI Earthing Strip 25x4mm', type: ResourceType.MATERIAL, unit: 'metre', rate: 65, gstRate: 18, hsn: '7213', category: 'Electrical' },
  { name: 'LT Power Cable 3.5C 240 sqmm Al', type: ResourceType.MATERIAL, unit: 'metre', rate: 2200, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Glanding & Termination Kit', type: ResourceType.MATERIAL, unit: 'set', rate: 350, gstRate: 18, hsn: '8538', category: 'Electrical' },
  { name: 'Solar Panel 540W Mono PERC', type: ResourceType.MATERIAL, unit: 'piece', rate: 14000, gstRate: 18, hsn: '8541', category: 'Electrical' },

  // ════════════════════════════════════════════════════════════════
  // 14. HVAC & VENTILATION
  // ════════════════════════════════════════════════════════════════
  { name: 'GI Duct Sheet 0.8mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 320, gstRate: 18, hsn: '7306', category: 'HVAC' },
  { name: 'GI Duct Sheet 1.0mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 380, gstRate: 18, hsn: '7306', category: 'HVAC' },
  { name: 'Pre-Insulated Duct Panel 20mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 450, gstRate: 18, hsn: '3925', category: 'HVAC' },
  { name: 'Duct Insulation (Glasswool) 25mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 180, gstRate: 18, hsn: '7019', category: 'HVAC' },
  { name: 'Duct Insulation (PUF) 25mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '3925', category: 'HVAC' },
  { name: 'Volume Control Damper 600x300', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '8481', category: 'HVAC' },
  { name: 'Fire Damper 600x300', type: ResourceType.MATERIAL, unit: 'piece', rate: 4500, gstRate: 18, hsn: '8481', category: 'HVAC' },
  { name: 'Air Diffuser 600x600 Square', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '8414', category: 'HVAC' },
  { name: 'Linear Slot Diffuser 1200mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '8414', category: 'HVAC' },
  { name: 'Cassette AC 2 Ton', type: ResourceType.MATERIAL, unit: 'piece', rate: 42000, gstRate: 18, hsn: '8415', category: 'HVAC' },
  { name: 'Split AC 1.5 Ton Inverter', type: ResourceType.MATERIAL, unit: 'piece', rate: 35000, gstRate: 18, hsn: '8415', category: 'HVAC' },
  { name: 'VRV System 8HP Outdoor Unit', type: ResourceType.MATERIAL, unit: 'piece', rate: 185000, gstRate: 18, hsn: '8415', category: 'HVAC' },
  { name: 'Fan Coil Unit (FCU) 200 CFM', type: ResourceType.MATERIAL, unit: 'piece', rate: 12000, gstRate: 18, hsn: '8414', category: 'HVAC' },
  { name: 'Chilled Water Pump 5HP', type: ResourceType.MATERIAL, unit: 'piece', rate: 32000, gstRate: 18, hsn: '8413', category: 'HVAC' },
  { name: 'Cooling Tower 50 TR', type: ResourceType.MATERIAL, unit: 'piece', rate: 180000, gstRate: 18, hsn: '8419', category: 'HVAC' },
  { name: 'Refrigerant Gas R410A', type: ResourceType.MATERIAL, unit: 'kg', rate: 650, gstRate: 18, hsn: '3824', category: 'HVAC' },
  { name: 'Copper Tube 1/4 inch (AC)', type: ResourceType.MATERIAL, unit: 'metre', rate: 120, gstRate: 18, hsn: '7411', category: 'HVAC' },
  { name: 'Copper Tube 3/8 inch (AC)', type: ResourceType.MATERIAL, unit: 'metre', rate: 180, gstRate: 18, hsn: '7411', category: 'HVAC' },
  { name: 'AC Drainage Pipe 19mm', type: ResourceType.MATERIAL, unit: 'metre', rate: 35, gstRate: 18, hsn: '3917', category: 'HVAC' },
  { name: 'Insulation Tube 13mm (AC Pipe)', type: ResourceType.MATERIAL, unit: 'metre', rate: 45, gstRate: 18, hsn: '3917', category: 'HVAC' },

  // ════════════════════════════════════════════════════════════════
  // 15. FIRE FIGHTING & SAFETY
  // ════════════════════════════════════════════════════════════════
  { name: 'Fire Extinguisher CO2 4.5kg', type: ResourceType.MATERIAL, unit: 'piece', rate: 3500, gstRate: 18, hsn: '8424', category: 'Fire Safety' },
  { name: 'Fire Extinguisher DCP 5kg', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '8424', category: 'Fire Safety' },
  { name: 'Fire Extinguifier ABC 6kg', type: ResourceType.MATERIAL, unit: 'piece', rate: 2200, gstRate: 18, hsn: '8424', category: 'Fire Safety' },
  { name: 'Fire Sprinkler Head (Pendent)', type: ResourceType.MATERIAL, unit: 'piece', rate: 280, gstRate: 18, hsn: '8424', category: 'Fire Safety' },
  { name: 'Fire Sprinkler Head (Upright)', type: ResourceType.MATERIAL, unit: 'piece', rate: 280, gstRate: 18, hsn: '8424', category: 'Fire Safety' },
  { name: 'Fire Hydrant Landing Valve 80mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 4500, gstRate: 18, hsn: '8481', category: 'Fire Safety' },
  { name: 'Fire Hose Reel 19mm x 30m', type: ResourceType.MATERIAL, unit: 'piece', rate: 3500, gstRate: 18, hsn: '8413', category: 'Fire Safety' },
  { name: 'Fire Hose 63mm x 15m Canvas', type: ResourceType.MATERIAL, unit: 'piece', rate: 2800, gstRate: 18, hsn: '5903', category: 'Fire Safety' },
  { name: 'Fire Hose Box (RRL)', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '7326', category: 'Fire Safety' },
  { name: 'Smoke Detector (Conventional)', type: ResourceType.MATERIAL, unit: 'piece', rate: 650, gstRate: 18, hsn: '8531', category: 'Fire Safety' },
  { name: 'Heat Detector (Conventional)', type: ResourceType.MATERIAL, unit: 'piece', rate: 750, gstRate: 18, hsn: '8531', category: 'Fire Safety' },
  { name: 'Fire Alarm Panel 4 Zone', type: ResourceType.MATERIAL, unit: 'piece', rate: 8500, gstRate: 18, hsn: '8531', category: 'Fire Safety' },
  { name: 'Manual Call Point (Break Glass)', type: ResourceType.MATERIAL, unit: 'piece', rate: 450, gstRate: 18, hsn: '8531', category: 'Fire Safety' },
  { name: 'Response Indicator', type: ResourceType.MATERIAL, unit: 'piece', rate: 350, gstRate: 18, hsn: '8531', category: 'Fire Safety' },
  { name: 'Fire Door (1hr Rating) 1200x2100', type: ResourceType.MATERIAL, unit: 'piece', rate: 8500, gstRate: 18, hsn: '4418', category: 'Fire Safety' },
  { name: 'Exit Sign Light (LED)', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '9405', category: 'Fire Safety' },
  { name: 'GI Fire Pipe 80mm Class B', type: ResourceType.MATERIAL, unit: 'metre', rate: 520, gstRate: 18, hsn: '7306', category: 'Fire Safety' },
  { name: 'GI Fire Pipe 100mm Class B', type: ResourceType.MATERIAL, unit: 'metre', rate: 680, gstRate: 18, hsn: '7306', category: 'Fire Safety' },
  { name: 'Fire Pump 15HP (Diesel)', type: ResourceType.MATERIAL, unit: 'piece', rate: 85000, gstRate: 18, hsn: '8413', category: 'Fire Safety' },
  { name: 'Safety Helmet (ISI)', type: ResourceType.MATERIAL, unit: 'piece', rate: 250, gstRate: 18, hsn: '6506', category: 'Fire Safety' },
  { name: 'Safety Shoes (Steel Toe)', type: ResourceType.MATERIAL, unit: 'pair', rate: 850, gstRate: 18, hsn: '6403', category: 'Fire Safety' },
  { name: 'Safety Jacket (Reflective)', type: ResourceType.MATERIAL, unit: 'piece', rate: 150, gstRate: 18, hsn: '6210', category: 'Fire Safety' },
  { name: 'Safety Net (Nylon) 4x4m', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '5608', category: 'Fire Safety' },
  { name: 'First Aid Box (Standard)', type: ResourceType.MATERIAL, unit: 'piece', rate: 1200, gstRate: 18, hsn: '3006', category: 'Fire Safety' },

  // ════════════════════════════════════════════════════════════════
  // 16. LABOUR (SKILLED)
  // ════════════════════════════════════════════════════════════════
  { name: 'Mason Grade 1 (Mistri)', type: ResourceType.LABOUR, unit: 'day', rate: 750, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Mason Grade 2', type: ResourceType.LABOUR, unit: 'day', rate: 650, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Carpenter (Skilled)', type: ResourceType.LABOUR, unit: 'day', rate: 800, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Bar Bender & Fixer', type: ResourceType.LABOUR, unit: 'day', rate: 700, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Welder (Gas)', type: ResourceType.LABOUR, unit: 'day', rate: 850, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Welder (Arc)', type: ResourceType.LABOUR, unit: 'day', rate: 900, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Plumber', type: ResourceType.LABOUR, unit: 'day', rate: 850, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Electrician', type: ResourceType.LABOUR, unit: 'day', rate: 850, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Painter (Skilled)', type: ResourceType.LABOUR, unit: 'day', rate: 700, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Tile / Marble Fixer', type: ResourceType.LABOUR, unit: 'day', rate: 750, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Granite Fixer', type: ResourceType.LABOUR, unit: 'day', rate: 800, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Glazier (Glass Fitter)', type: ResourceType.LABOUR, unit: 'day', rate: 750, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Steel Fabricator', type: ResourceType.LABOUR, unit: 'day', rate: 800, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Rigger', type: ResourceType.LABOUR, unit: 'day', rate: 650, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Scaffolder', type: ResourceType.LABOUR, unit: 'day', rate: 600, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Crane Operator', type: ResourceType.LABOUR, unit: 'day', rate: 1200, gstRate: 0, category: 'Skilled Labour' },
  { name: 'JCB / Excavator Operator', type: ResourceType.LABOUR, unit: 'day', rate: 1500, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Surveyor', type: ResourceType.LABOUR, unit: 'day', rate: 1500, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Foreman', type: ResourceType.LABOUR, unit: 'day', rate: 1800, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Site Engineer (Civil)', type: ResourceType.LABOUR, unit: 'day', rate: 2500, gstRate: 0, category: 'Skilled Labour' },
  { name: 'HVAC Technician', type: ResourceType.LABOUR, unit: 'day', rate: 950, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Fire Fighting Technician', type: ResourceType.LABOUR, unit: 'day', rate: 850, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Waterproofing Specialist', type: ResourceType.LABOUR, unit: 'day', rate: 1000, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Polishing / Grinding Worker', type: ResourceType.LABOUR, unit: 'day', rate: 700, gstRate: 0, category: 'Skilled Labour' },
  { name: 'POP / False Ceiling Worker', type: ResourceType.LABOUR, unit: 'day', rate: 650, gstRate: 0, category: 'Skilled Labour' },

  // ════════════════════════════════════════════════════════════════
  // 17. LABOUR (UNSKILLED)
  // ════════════════════════════════════════════════════════════════
  { name: 'Unskilled Labour (Male)', type: ResourceType.LABOUR, unit: 'day', rate: 450, gstRate: 0, category: 'Unskilled Labour' },
  { name: 'Unskilled Labour (Female)', type: ResourceType.LABOUR, unit: 'day', rate: 400, gstRate: 0, category: 'Unskilled Labour' },
  { name: 'Helper / Beldar', type: ResourceType.LABOUR, unit: 'day', rate: 420, gstRate: 0, category: 'Unskilled Labour' },
  { name: 'Water Carrier', type: ResourceType.LABOUR, unit: 'day', rate: 380, gstRate: 0, category: 'Unskilled Labour' },
  { name: 'Watchman (Night)', type: ResourceType.LABOUR, unit: 'day', rate: 450, gstRate: 0, category: 'Unskilled Labour' },
  { name: 'Sweeper / Cleaner', type: ResourceType.LABOUR, unit: 'day', rate: 350, gstRate: 0, category: 'Unskilled Labour' },
  { name: 'Gardener (Mali)', type: ResourceType.LABOUR, unit: 'day', rate: 400, gstRate: 0, category: 'Unskilled Labour' },

  // ════════════════════════════════════════════════════════════════
  // 18. EQUIPMENT & MACHINERY (HIRING)
  // ════════════════════════════════════════════════════════════════
  { name: 'Concrete Mixer 200L', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1800, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Concrete Mixer 350L', type: ResourceType.EQUIPMENT, unit: 'day', rate: 2500, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Needle Vibrator 25mm', type: ResourceType.EQUIPMENT, unit: 'day', rate: 600, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Needle Vibrator 40mm', type: ResourceType.EQUIPMENT, unit: 'day', rate: 700, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Needle Vibrator 60mm', type: ResourceType.EQUIPMENT, unit: 'day', rate: 800, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Concrete Pump 42m Boom', type: ResourceType.EQUIPMENT, unit: 'day', rate: 25000, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'Concrete Pump 36m Boom', type: ResourceType.EQUIPMENT, unit: 'day', rate: 20000, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'Concrete Line Pump', type: ResourceType.EQUIPMENT, unit: 'cum', rate: 450, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'Transit Mixer 6 cum', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 3500, gstRate: 18, hsn: '8705', category: 'Equipment Hire' },
  { name: 'JCB Excavator 3DX', type: ResourceType.EQUIPMENT, unit: 'day', rate: 12000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'JCB Excavator (Backhoe Loader)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 9000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Excavator PC130', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Excavator 20T (PC200)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 28000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Bull Dozer D6R', type: ResourceType.EQUIPMENT, unit: 'day', rate: 22000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Motor Grader', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Vibratory Roller 10T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 8000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Vibratory Roller 12T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 10000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Plate Compactor', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1200, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Road Roller (Static) 8-10T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 6000, gstRate: 18, hsn: '8429', category: 'Equipment Hire' },
  { name: 'Paver Finisher', type: ResourceType.EQUIPMENT, unit: 'day', rate: 35000, gstRate: 18, hsn: '8479', category: 'Equipment Hire' },
  { name: 'WMM Plant', type: ResourceType.EQUIPMENT, unit: 'day', rate: 15000, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Hot Mix Plant 60-90 TPH', type: ResourceType.EQUIPMENT, unit: 'day', rate: 25000, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Batching Plant 30 cum/hr', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Batching Plant 60 cum/hr', type: ResourceType.EQUIPMENT, unit: 'day', rate: 25000, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Tower Crane 5T', type: ResourceType.EQUIPMENT, unit: 'month', rate: 285000, gstRate: 18, hsn: '8426', category: 'Equipment Hire' },
  { name: 'Tower Crane 10T', type: ResourceType.EQUIPMENT, unit: 'month', rate: 450000, gstRate: 18, hsn: '8426', category: 'Equipment Hire' },
  { name: 'Mobile Crane 15T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 12000, gstRate: 18, hsn: '8426', category: 'Equipment Hire' },
  { name: 'Mobile Crane 25T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8426', category: 'Equipment Hire' },
  { name: 'Mobile Crane 50T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 35000, gstRate: 18, hsn: '8426', category: 'Equipment Hire' },
  { name: 'Hydra Crane 12T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 8000, gstRate: 18, hsn: '8426', category: 'Equipment Hire' },
  { name: 'Dewatering Pump 5HP', type: ResourceType.EQUIPMENT, unit: 'day', rate: 800, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'Dewatering Pump 10HP', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1200, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'DG Set 15 KVA', type: ResourceType.EQUIPMENT, unit: 'day', rate: 4500, gstRate: 18, hsn: '8502', category: 'Equipment Hire' },
  { name: 'DG Set 25 KVA', type: ResourceType.EQUIPMENT, unit: 'day', rate: 6500, gstRate: 18, hsn: '8502', category: 'Equipment Hire' },
  { name: 'DG Set 62.5 KVA', type: ResourceType.EQUIPMENT, unit: 'day', rate: 12000, gstRate: 18, hsn: '8502', category: 'Equipment Hire' },
  { name: 'DG Set 125 KVA', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8502', category: 'Equipment Hire' },
  { name: 'DG Set 250 KVA', type: ResourceType.EQUIPMENT, unit: 'day', rate: 32000, gstRate: 18, hsn: '8502', category: 'Equipment Hire' },
  { name: 'Bar Bending Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1500, gstRate: 18, hsn: '8462', category: 'Equipment Hire' },
  { name: 'Bar Cutting Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1500, gstRate: 18, hsn: '8462', category: 'Equipment Hire' },
  { name: 'Circular Saw 14 inch', type: ResourceType.EQUIPMENT, unit: 'day', rate: 600, gstRate: 18, hsn: '8462', category: 'Equipment Hire' },
  { name: 'Breaker / Demolition Hammer', type: ResourceType.EQUIPMENT, unit: 'day', rate: 800, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },
  { name: 'Guniting / Shotcrete Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 4500, gstRate: 18, hsn: '8424', category: 'Equipment Hire' },
  { name: 'Core Cutting Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1200, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },
  { name: 'Scissor Lift 8m', type: ResourceType.EQUIPMENT, unit: 'day', rate: 5000, gstRate: 18, hsn: '8428', category: 'Equipment Hire' },
  { name: 'Boom Lift 12m', type: ResourceType.EQUIPMENT, unit: 'day', rate: 8000, gstRate: 18, hsn: '8428', category: 'Equipment Hire' },
  { name: 'Tele-handler 7m', type: ResourceType.EQUIPMENT, unit: 'day', rate: 7000, gstRate: 18, hsn: '8427', category: 'Equipment Hire' },
  { name: 'Concrete Floor Grinder', type: ResourceType.EQUIPMENT, unit: 'day', rate: 2500, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },
  { name: 'Marble Polisher', type: ResourceType.EQUIPMENT, unit: 'day', rate: 800, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },

  // ════════════════════════════════════════════════════════════════
  // 19. CONSUMABLES & MISC
  // ════════════════════════════════════════════════════════════════
  { name: 'Diesel (HSD)', type: ResourceType.MATERIAL, unit: 'litre', rate: 88, gstRate: 0, hsn: '2710', category: 'Consumables' },
  { name: 'Petrol', type: ResourceType.MATERIAL, unit: 'litre', rate: 102, gstRate: 0, hsn: '2710', category: 'Consumables' },
  { name: 'Engine Oil (15W40)', type: ResourceType.MATERIAL, unit: 'litre', rate: 280, gstRate: 18, hsn: '2710', category: 'Consumables' },
  { name: 'Hydraulic Oil AW68', type: ResourceType.MATERIAL, unit: 'litre', rate: 320, gstRate: 18, hsn: '2710', category: 'Consumables' },
  { name: 'Grease (Multipurpose)', type: ResourceType.MATERIAL, unit: 'kg', rate: 220, gstRate: 18, hsn: '2710', category: 'Consumables' },
  { name: 'Welding Rod E6013 3.15mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 180, gstRate: 18, hsn: '8311', category: 'Consumables' },
  { name: 'Welding Rod E7018 3.15mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 280, gstRate: 18, hsn: '8311', category: 'Consumables' },
  { name: 'Oxygen Gas (Cylinder)', type: ResourceType.MATERIAL, unit: 'cylinder', rate: 450, gstRate: 18, hsn: '2804', category: 'Consumables' },
  { name: 'Acetylene Gas (Cylinder)', type: ResourceType.MATERIAL, unit: 'cylinder', rate: 1200, gstRate: 18, hsn: '2901', category: 'Consumables' },
  { name: 'Argon Gas (Cylinder)', type: ResourceType.MATERIAL, unit: 'cylinder', rate: 850, gstRate: 18, hsn: '2804', category: 'Consumables' },
  { name: 'Nails 50mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7317', category: 'Consumables' },
  { name: 'Nails 75mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 80, gstRate: 18, hsn: '7317', category: 'Consumables' },
  { name: 'Screws (Self Tapping) 25mm', type: ResourceType.MATERIAL, unit: 'box', rate: 120, gstRate: 18, hsn: '7318', category: 'Consumables' },
  { name: 'Nut & Bolt Set 10mm (Galvanized)', type: ResourceType.MATERIAL, unit: 'set', rate: 12, gstRate: 18, hsn: '7318', category: 'Consumables' },
  { name: 'Nut & Bolt Set 16mm (Galvanized)', type: ResourceType.MATERIAL, unit: 'set', rate: 28, gstRate: 18, hsn: '7318', category: 'Consumables' },
  { name: 'Threaded Rod 10mm (Full)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '7318', category: 'Consumables' },
  { name: 'Threaded Rod 12mm (Full)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 120, gstRate: 18, hsn: '7318', category: 'Consumables' },
  { name: 'Plastic Sheet (Polythene) 200 GSM', type: ResourceType.MATERIAL, unit: 'sqm', rate: 28, gstRate: 18, hsn: '3920', category: 'Consumables' },
  { name: 'Plastic Sheet (Polythene) 500 GSM', type: ResourceType.MATERIAL, unit: 'sqm', rate: 55, gstRate: 18, hsn: '3920', category: 'Consumables' },
  { name: 'Jute Bag (Hessian)', type: ResourceType.MATERIAL, unit: 'piece', rate: 18, gstRate: 5, hsn: '6305', category: 'Consumables' },
  { name: 'Curing Mats (Hessian)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 35, gstRate: 5, hsn: '6305', category: 'Consumables' },
  { name: 'Masking Tape 1 inch', type: ResourceType.MATERIAL, unit: 'roll', rate: 45, gstRate: 18, hsn: '3919', category: 'Consumables' },
  { name: 'Duct Tape 48mm', type: ResourceType.MATERIAL, unit: 'roll', rate: 85, gstRate: 18, hsn: '3919', category: 'Consumables' },
  { name: 'Sand Paper 80 Grit', type: ResourceType.MATERIAL, unit: 'sheet', rate: 12, gstRate: 18, hsn: '6805', category: 'Consumables' },
  { name: 'Wire Brush (Hand)', type: ResourceType.MATERIAL, unit: 'piece', rate: 65, gstRate: 18, hsn: '9603', category: 'Consumables' },
  { name: 'Paint Brush 4 inch', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '9603', category: 'Consumables' },
  { name: 'Paint Roller 9 inch (with Sleeve)', type: ResourceType.MATERIAL, unit: 'set', rate: 180, gstRate: 18, hsn: '9603', category: 'Consumables' },
  { name: 'Paint Tray (Metal)', type: ResourceType.MATERIAL, unit: 'piece', rate: 120, gstRate: 18, hsn: '7323', category: 'Consumables' },
  { name: 'Cotton Waste (Cleaning)', type: ResourceType.MATERIAL, unit: 'kg', rate: 45, gstRate: 5, hsn: '5202', category: 'Consumables' },
  { name: 'Thinner', type: ResourceType.MATERIAL, unit: 'litre', rate: 85, gstRate: 18, hsn: '3814', category: 'Consumables' },
  { name: 'Turpentine Oil', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3805', category: 'Consumables' },
  { name: 'Water (Tanker Supply)', type: ResourceType.MATERIAL, unit: 'trip', rate: 1200, gstRate: 0, category: 'Consumables' },

  // ════════════════════════════════════════════════════════════════
  // 20. TRANSPORTATION
  // ════════════════════════════════════════════════════════════════
  { name: 'Tipper / Dumper 6 cum (Local)', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 1200, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Tipper / Dumper 10 cum (Local)', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 1800, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Tipper / Dumper 16 cum (Local)', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 2500, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Truck 9T (Local)', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 2000, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Truck 16T (Local)', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 3500, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Tractor + Trailer (Local)', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 800, gstRate: 18, hsn: '8701', category: 'Transportation' },
  { name: 'Water Tanker 12000 L', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 1500, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Water Tanker 20000 L', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 2200, gstRate: 18, hsn: '8704', category: 'Transportation' },
  { name: 'Low-bed Trailer', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 8000, gstRate: 18, hsn: '8716', category: 'Transportation' },
  { name: 'Container Truck', type: ResourceType.EQUIPMENT, unit: 'trip', rate: 6000, gstRate: 18, hsn: '8704', category: 'Transportation' },

  // ════════════════════════════════════════════════════════════════
  // 21. INTERIORS & FURNITURE
  // ════════════════════════════════════════════════════════════════
  { name: 'Modular Partition Panel 50mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 280, gstRate: 18, hsn: '9403', category: 'Interiors' },
  { name: 'Acrylic Sheet 3mm Transparent', type: ResourceType.MATERIAL, unit: 'sqft', rate: 65, gstRate: 18, hsn: '3920', category: 'Interiors' },
  { name: 'PVC Wall Panel 6mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 45, gstRate: 18, hsn: '3925', category: 'Interiors' },
  { name: 'Laminate Sheet (Sunmica) 1mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 35, gstRate: 18, hsn: '4823', category: 'Interiors' },
  { name: 'Acrylic Laminate Sheet', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '4823', category: 'Interiors' },
  { name: 'Modular Workstation Desk', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '9403', category: 'Interiors' },
  { name: 'Office Chair (Ergonomic)', type: ResourceType.MATERIAL, unit: 'nos', rate: 4500, gstRate: 18, hsn: '9401', category: 'Interiors' },
  { name: 'Vertical Blinds (Aluminium)', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '8302', category: 'Interiors' },
  { name: 'Roller Blinds (Blackout)', type: ResourceType.MATERIAL, unit: 'sqft', rate: 120, gstRate: 18, hsn: '6303', category: 'Interiors' },
  { name: 'Curtain Rod (SS) 25mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '8302', category: 'Interiors' },
  { name: 'SS Wall Hook', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 18, hsn: '8302', category: 'Interiors' },
  { name: 'Glass Shelf with Bracket', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '9403', category: 'Interiors' },
  { name: 'Wardrobe (Modular)', type: ResourceType.MATERIAL, unit: 'sqft', rate: 1200, gstRate: 18, hsn: '9403', category: 'Interiors' },
  { name: 'Kitchen Modular Unit (per running ft)', type: ResourceType.MATERIAL, unit: 'rft', rate: 1800, gstRate: 18, hsn: '9403', category: 'Interiors' },
  { name: 'PVC Coving Profile', type: ResourceType.MATERIAL, unit: 'rmt', rate: 35, gstRate: 18, hsn: '3916', category: 'Interiors' },
  { name: 'Cornice (POP) Decorative', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '2520', category: 'Interiors' },
  { name: 'Concealed Light Fixture (LED)', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '9405', category: 'Interiors' },
  { name: 'Picture Light (LED)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '9405', category: 'Interiors' },
  { name: 'Table Lamp', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '9405', category: 'Interiors' },
  { name: 'Floor Lamp', type: ResourceType.MATERIAL, unit: 'nos', rate: 2200, gstRate: 18, hsn: '9405', category: 'Interiors' },
  { name: 'Mirror 6mm (Bathroom)', type: ResourceType.MATERIAL, unit: 'sqft', rate: 120, gstRate: 18, hsn: '7009', category: 'Interiors' },
  { name: 'Mirror with Bevel Edge', type: ResourceType.MATERIAL, unit: 'sqft', rate: 165, gstRate: 18, hsn: '7009', category: 'Interiors' },
  { name: 'Towel Rail (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 380, gstRate: 18, hsn: '7418', category: 'Interiors' },
  { name: 'Soap Dispenser (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 18, hsn: '7418', category: 'Interiors' },
  { name: 'Toilet Paper Holder (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 250, gstRate: 18, hsn: '7418', category: 'Interiors' },

  // ════════════════════════════════════════════════════════════════
  // 22. SOLAR & RENEWABLE
  // ════════════════════════════════════════════════════════════════
  { name: 'Solar Inverter 5KVA', type: ResourceType.MATERIAL, unit: 'nos', rate: 45000, gstRate: 18, hsn: '8504', category: 'Solar' },
  { name: 'Solar Inverter 10KVA', type: ResourceType.MATERIAL, unit: 'nos', rate: 85000, gstRate: 18, hsn: '8504', category: 'Solar' },
  { name: 'Solar Battery 150Ah (Tubular)', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '8507', category: 'Solar' },
  { name: 'Solar Battery 200Ah (Tubular)', type: ResourceType.MATERIAL, unit: 'nos', rate: 24000, gstRate: 18, hsn: '8507', category: 'Solar' },
  { name: 'Solar Panel Mounting Structure (GI)', type: ResourceType.MATERIAL, unit: 'set', rate: 12000, gstRate: 18, hsn: '7308', category: 'Solar' },
  { name: 'Solar DC Cable 4 sqmm', type: ResourceType.MATERIAL, unit: 'metre', rate: 85, gstRate: 18, hsn: '8544', category: 'Solar' },
  { name: 'Solar DC Cable 6 sqmm', type: ResourceType.MATERIAL, unit: 'metre', rate: 120, gstRate: 18, hsn: '8544', category: 'Solar' },
  { name: 'Solar Combiner Box (4 String)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '8537', category: 'Solar' },
  { name: 'MC4 Connector Pair', type: ResourceType.MATERIAL, unit: 'pair', rate: 85, gstRate: 18, hsn: '8536', category: 'Solar' },
  { name: 'Solar Lightning Arrester', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '8535', category: 'Solar' },
  { name: 'Solar Earthing Kit', type: ResourceType.MATERIAL, unit: 'set', rate: 4500, gstRate: 18, hsn: '8538', category: 'Solar' },
  { name: 'Net Metering Device', type: ResourceType.MATERIAL, unit: 'nos', rate: 6500, gstRate: 18, hsn: '9028', category: 'Solar' },
  { name: 'Solar Charge Controller (MPPT)', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8504', category: 'Solar' },
  { name: 'Solar Water Heater 200 LPD', type: ResourceType.MATERIAL, unit: 'nos', rate: 22000, gstRate: 18, hsn: '8419', category: 'Solar' },
  { name: 'Solar Street Light (All-in-One) 60W', type: ResourceType.MATERIAL, unit: 'nos', rate: 12000, gstRate: 18, hsn: '9405', category: 'Solar' },

  // ════════════════════════════════════════════════════════════════
  // 23. WATER TREATMENT (STP/WTP)
  // ════════════════════════════════════════════════════════════════
  { name: 'MBBR Media (HDPE)', type: ResourceType.MATERIAL, unit: 'cum', rate: 45000, gstRate: 18, hsn: '3926', category: 'Water Treatment' },
  { name: 'MBBR Media (PP)', type: ResourceType.MATERIAL, unit: 'cum', rate: 38000, gstRate: 18, hsn: '3926', category: 'Water Treatment' },
  { name: 'UV System 200 LPM (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 45000, gstRate: 18, hsn: '8419', category: 'Water Treatment' },
  { name: 'RO Membrane 4 inch', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8421', category: 'Water Treatment' },
  { name: 'RO Membrane 8 inch', type: ResourceType.MATERIAL, unit: 'nos', rate: 22000, gstRate: 18, hsn: '8421', category: 'Water Treatment' },
  { name: 'Dosing Pump (Diaphragm)', type: ResourceType.MATERIAL, unit: 'nos', rate: 12000, gstRate: 18, hsn: '8413', category: 'Water Treatment' },
  { name: 'Filter Nozzle (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 350, gstRate: 18, hsn: '8481', category: 'Water Treatment' },
  { name: 'Pressure Gauge 0-10 bar', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 18, hsn: '9026', category: 'Water Treatment' },
  { name: 'Flow Meter (Digital)', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '9026', category: 'Water Treatment' },
  { name: 'Activated Carbon Filter Media', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '3802', category: 'Water Treatment' },
  { name: 'Sand Filter Media (Silica)', type: ResourceType.MATERIAL, unit: 'kg', rate: 12, gstRate: 5, hsn: '2505', category: 'Water Treatment' },
  { name: 'Anthracite Filter Media', type: ResourceType.MATERIAL, unit: 'kg', rate: 45, gstRate: 5, hsn: '2701', category: 'Water Treatment' },
  { name: 'Sodium Hypochlorite 10%', type: ResourceType.MATERIAL, unit: 'litre', rate: 28, gstRate: 18, hsn: '2828', category: 'Water Treatment' },
  { name: 'Polyelectrolyte (Flocculant)', type: ResourceType.MATERIAL, unit: 'kg', rate: 180, gstRate: 18, hsn: '3906', category: 'Water Treatment' },
  { name: 'Diffused Aeration Membrane Disc', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '8413', category: 'Water Treatment' },

  // ════════════════════════════════════════════════════════════════
  // 24. PAVING & LANDSCAPING
  // ════════════════════════════════════════════════════════════════
  { name: 'Natural Flagstone 300x300x25mm (Sandstone)', type: ResourceType.MATERIAL, unit: 'sqft', rate: 65, gstRate: 5, hsn: '2516', category: 'Landscaping' },
  { name: 'Natural Flagstone 400x400x30mm (Limestone)', type: ResourceType.MATERIAL, unit: 'sqft', rate: 75, gstRate: 5, hsn: '2515', category: 'Landscaping' },
  { name: 'Cobblestone (Granite) 100x100x60mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 95, gstRate: 18, hsn: '6802', category: 'Landscaping' },
  { name: 'Grass Paver Grid (Concrete)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 5, hsn: '6810', category: 'Landscaping' },
  { name: 'Artificial Turf (Lawn) 15mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '5703', category: 'Landscaping' },
  { name: 'Artificial Turf (Lawn) 25mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 380, gstRate: 18, hsn: '5703', category: 'Landscaping' },
  { name: 'Natural Lawn Grass (Roll)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 85, gstRate: 0, category: 'Landscaping' },
  { name: 'Topsoil (Screened)', type: ResourceType.MATERIAL, unit: 'cum', rate: 650, gstRate: 0, category: 'Landscaping' },
  { name: 'Decorative Pebbles 20-40mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 18, gstRate: 5, hsn: '2517', category: 'Landscaping' },
  { name: 'Decorative Gravel (Coloured)', type: ResourceType.MATERIAL, unit: 'kg', rate: 25, gstRate: 5, hsn: '2517', category: 'Landscaping' },
  { name: 'Garden Edging (PVC)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '3916', category: 'Landscaping' },
  { name: 'Garden Edging (Stone)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 5, hsn: '2516', category: 'Landscaping' },
  { name: 'Drip Irrigation Pipe 16mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 18, gstRate: 18, hsn: '3917', category: 'Landscaping' },
  { name: 'Drip Emitter 4 LPH', type: ResourceType.MATERIAL, unit: 'nos', rate: 8, gstRate: 18, hsn: '8424', category: 'Landscaping' },
  { name: 'Sprinkler Head (Pop-up)', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '8424', category: 'Landscaping' },
  { name: 'Garden Soil Mix (Compost)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1200, gstRate: 0, category: 'Landscaping' },
  { name: 'Mulch (Organic Bark)', type: ResourceType.MATERIAL, unit: 'cum', rate: 950, gstRate: 0, category: 'Landscaping' },

  // ════════════════════════════════════════════════════════════════
  // 25. SPECIALIZED PIPES
  // ════════════════════════════════════════════════════════════════
  { name: 'Borewell Pipe UPVC 110mm SDR 17', type: ResourceType.MATERIAL, unit: 'metre', rate: 380, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'Borewell Pipe UPVC 160mm SDR 17', type: ResourceType.MATERIAL, unit: 'metre', rate: 650, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'Borewell Casing Pipe (Galvanized) 150mm', type: ResourceType.MATERIAL, unit: 'metre', rate: 850, gstRate: 18, hsn: '7306', category: 'Special Pipes' },
  { name: 'HDPE Pipe 110mm PN 6', type: ResourceType.MATERIAL, unit: 'metre', rate: 320, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'HDPE Pipe 160mm PN 6', type: ResourceType.MATERIAL, unit: 'metre', rate: 580, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'HDPE Pipe 200mm PN 8', type: ResourceType.MATERIAL, unit: 'metre', rate: 850, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'Ductile Iron Pipe DN100 K9', type: ResourceType.MATERIAL, unit: 'metre', rate: 1800, gstRate: 18, hsn: '7303', category: 'Special Pipes' },
  { name: 'Ductile Iron Pipe DN150 K9', type: ResourceType.MATERIAL, unit: 'metre', rate: 2800, gstRate: 18, hsn: '7303', category: 'Special Pipes' },
  { name: 'Copper Pipe 15mm (Type L)', type: ResourceType.MATERIAL, unit: 'metre', rate: 280, gstRate: 18, hsn: '7411', category: 'Special Pipes' },
  { name: 'PEX Pipe 16mm', type: ResourceType.MATERIAL, unit: 'metre', rate: 35, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'PEX Pipe 20mm', type: ResourceType.MATERIAL, unit: 'metre', rate: 45, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'HDPE Pipe Fusion Fitting 110mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'DI Flange Adaptor DN100', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '7307', category: 'Special Pipes' },
  { name: 'Compression Fitting 110mm HDPE', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '3917', category: 'Special Pipes' },
  { name: 'Borewell Submersible Cable 3 Core 4 sqmm', type: ResourceType.MATERIAL, unit: 'metre', rate: 85, gstRate: 18, hsn: '8544', category: 'Special Pipes' },

  // ════════════════════════════════════════════════════════════════
  // 26. WATERPROOFING ACCESSORIES
  // ════════════════════════════════════════════════════════════════
  { name: 'PVC Waterstop 230mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 280, gstRate: 18, hsn: '3920', category: 'Waterproofing' },
  { name: 'Rubber Waterstop 230mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 380, gstRate: 18, hsn: '4008', category: 'Waterproofing' },
  { name: 'Swelling Waterstop (Bentonite)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '2508', category: 'Waterproofing' },
  { name: 'Injection Port (Packter)', type: ResourceType.MATERIAL, unit: 'nos', rate: 45, gstRate: 18, hsn: '3917', category: 'Waterproofing' },
  { name: 'Membrane Primer (Bituminous)', type: ResourceType.MATERIAL, unit: 'litre', rate: 120, gstRate: 18, hsn: '2715', category: 'Waterproofing' },
  { name: 'Fabric Reinforcement (Glass Mesh)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 65, gstRate: 18, hsn: '7019', category: 'Waterproofing' },
  { name: 'Protection Board (XPS) 6mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 120, gstRate: 18, hsn: '3921', category: 'Waterproofing' },
  { name: 'Protection Board (HDPE) 3mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 85, gstRate: 18, hsn: '3920', category: 'Waterproofing' },
  { name: 'Drainage Cell (HDPE) 30mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 150, gstRate: 18, hsn: '3926', category: 'Waterproofing' },
  { name: 'Geo-textile (Non-woven) 200 GSM', type: ResourceType.MATERIAL, unit: 'sqm', rate: 45, gstRate: 18, hsn: '5603', category: 'Waterproofing' },

  // ════════════════════════════════════════════════════════════════
  // 27. FASTENERS & HARDWARE (Specialized)
  // ════════════════════════════════════════════════════════════════
  { name: 'Anchor Bolt M16 x 150mm (Chemical)', type: ResourceType.MATERIAL, unit: 'nos', rate: 85, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Anchor Bolt M20 x 200mm (Chemical)', type: ResourceType.MATERIAL, unit: 'nos', rate: 120, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Anchor Bolt M12 x 100mm (Chemical)', type: ResourceType.MATERIAL, unit: 'nos', rate: 35, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Anchor Bolt M12 x 100mm (Mechanical)', type: ResourceType.MATERIAL, unit: 'nos', rate: 28, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Expansion Bolt M10 (Sleeve)', type: ResourceType.MATERIAL, unit: 'nos', rate: 15, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Expansion Bolt M12 (Sleeve)', type: ResourceType.MATERIAL, unit: 'nos', rate: 22, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Blind Rivet 4x10mm (Aluminium)', type: ResourceType.MATERIAL, unit: 'box', rate: 85, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Threaded Insert (Rivet Nut) M6', type: ResourceType.MATERIAL, unit: 'nos', rate: 8, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Spring Washer M10 (Spring)', type: ResourceType.MATERIAL, unit: 'nos', rate: 2, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Spring Washer M16', type: ResourceType.MATERIAL, unit: 'nos', rate: 4, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Locking Nut (Nylon Insert) M16', type: ResourceType.MATERIAL, unit: 'nos', rate: 12, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Dowel Pin 10x50mm (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 25, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Clevis Pin 12mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 18, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Cotter Pin 4mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 3, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Toggle Bolt (Hollow Wall) M6', type: ResourceType.MATERIAL, unit: 'nos', rate: 12, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Threaded Rod Hanger (Ceiling)', type: ResourceType.MATERIAL, unit: 'nos', rate: 45, gstRate: 18, hsn: '7318', category: 'Fasteners' },

  // ════════════════════════════════════════════════════════════════
  // 28. GLASS & GLAZING (Additional)
  // ════════════════════════════════════════════════════════════════
  { name: 'Float Glass 4mm Clear', type: ResourceType.MATERIAL, unit: 'sqft', rate: 65, gstRate: 18, hsn: '7005', category: 'Glass' },
  { name: 'Float Glass 5mm Clear', type: ResourceType.MATERIAL, unit: 'sqft', rate: 75, gstRate: 18, hsn: '7005', category: 'Glass' },
  { name: 'Frosted Glass 6mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 95, gstRate: 18, hsn: '7003', category: 'Glass' },
  { name: 'Wired Glass 6mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 110, gstRate: 18, hsn: '7003', category: 'Glass' },
  { name: 'Toughened Glass 8mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 130, gstRate: 18, hsn: '7007', category: 'Glass' },
  { name: 'Insulated Glass Unit (DGU) 6-12-6 Low-E', type: ResourceType.MATERIAL, unit: 'sqft', rate: 350, gstRate: 18, hsn: '7008', category: 'Glass' },
  { name: 'Curved Toughened Glass 12mm', type: ResourceType.MATERIAL, unit: 'sqft', rate: 380, gstRate: 18, hsn: '7007', category: 'Glass' },
  { name: 'Acoustic Double Glazing 6-20-8', type: ResourceType.MATERIAL, unit: 'sqft', rate: 420, gstRate: 18, hsn: '7008', category: 'Glass' },
  { name: 'Glass Spider Fitting (4-Arm SS316)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '8302', category: 'Glass' },
  { name: 'Glass Patch Fitting (SS316)', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '8302', category: 'Glass' },

  // ════════════════════════════════════════════════════════════════
  // 29. INSULATION
  // ════════════════════════════════════════════════════════════════
  { name: 'Rockwool Slab 50kg/cum 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 180, gstRate: 18, hsn: '6806', category: 'Insulation' },
  { name: 'Rockwool Slab 80kg/cum 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 250, gstRate: 18, hsn: '6806', category: 'Insulation' },
  { name: 'XPS Board 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '3921', category: 'Insulation' },
  { name: 'XPS Board 100mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 520, gstRate: 18, hsn: '3921', category: 'Insulation' },
  { name: 'EPS Board (Thermocol) 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 85, gstRate: 18, hsn: '3921', category: 'Insulation' },
  { name: 'Reflective Foil (Aluminium) 1mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 65, gstRate: 18, hsn: '7616', category: 'Insulation' },
  { name: 'Vapour Barrier (PE Film) 200 Micron', type: ResourceType.MATERIAL, unit: 'sqm', rate: 28, gstRate: 18, hsn: '3920', category: 'Insulation' },
  { name: 'Acoustic Insulation (Nitrile Foam) 25mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 220, gstRate: 18, hsn: '3921', category: 'Insulation' },
  { name: 'Pipe Insulation (Nitrile) 25mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '3917', category: 'Insulation' },
  { name: 'Roof Insulation (PUF Panel) 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 650, gstRate: 18, hsn: '3925', category: 'Insulation' },

  // ════════════════════════════════════════════════════════════════
  // 30. ROAD & INFRASTRUCTURE MATERIALS
  // ════════════════════════════════════════════════════════════════
  { name: 'Bitumen VG30', type: ResourceType.MATERIAL, unit: 'ton', rate: 52000, gstRate: 18, hsn: '2713', category: 'Road Materials' },
  { name: 'Bitumen VG40', type: ResourceType.MATERIAL, unit: 'ton', rate: 54000, gstRate: 18, hsn: '2713', category: 'Road Materials' },
  { name: 'Bitumen Emulsion (SS-1)', type: ResourceType.MATERIAL, unit: 'litre', rate: 45, gstRate: 18, hsn: '2714', category: 'Road Materials' },
  { name: 'Bitumen Emulsion (RS-1)', type: ResourceType.MATERIAL, unit: 'litre', rate: 48, gstRate: 18, hsn: '2714', category: 'Road Materials' },
  { name: 'CRMB (Crumb Rubber Modified Bitumen)', type: ResourceType.MATERIAL, unit: 'ton', rate: 58000, gstRate: 18, hsn: '2713', category: 'Road Materials' },
  { name: 'Prime Coat Material (Cutback)', type: ResourceType.MATERIAL, unit: 'litre', rate: 52, gstRate: 18, hsn: '2714', category: 'Road Materials' },
  { name: 'Road Stud (Solar)', type: ResourceType.MATERIAL, unit: 'nos', rate: 350, gstRate: 18, hsn: '9405', category: 'Road Materials' },
  { name: 'Cat Eye Reflector (Amber)', type: ResourceType.MATERIAL, unit: 'nos', rate: 120, gstRate: 18, hsn: '9405', category: 'Road Materials' },
  { name: 'Rumble Strip (ABS) 250mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '3925', category: 'Road Materials' },
  { name: 'Thermoplastic Road Marking Paint (Yellow)', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '3208', category: 'Road Materials' },
  { name: 'Thermoplastic Road Marking Paint (White)', type: ResourceType.MATERIAL, unit: 'kg', rate: 75, gstRate: 18, hsn: '3208', category: 'Road Materials' },
  { name: 'Glass Microbeads (Retroreflective)', type: ResourceType.MATERIAL, unit: 'kg', rate: 120, gstRate: 18, hsn: '7018', category: 'Road Materials' },
  { name: 'Wire Rope Barrier 4mm (Galvanized)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '7312', category: 'Road Materials' },
  { name: 'DLC (Dry Lean Concrete) 150mm per sqm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 450, gstRate: 18, hsn: '3824', category: 'Road Materials' },
  { name: 'PQC (Pavement Quality Concrete) 300mm per sqm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 1200, gstRate: 18, hsn: '3824', category: 'Road Materials' },

  // ════════════════════════════════════════════════════════════════
  // 31. INDUSTRIAL ITEMS
  // ════════════════════════════════════════════════════════════════
  { name: 'EOT Crane Rail 25kg/m', type: ResourceType.MATERIAL, unit: 'rmt', rate: 2800, gstRate: 18, hsn: '7302', category: 'Industrial' },
  { name: 'EOT Crane Rail 50kg/m', type: ResourceType.MATERIAL, unit: 'rmt', rate: 5200, gstRate: 18, hsn: '7302', category: 'Industrial' },
  { name: 'Steel Grating 30x3mm (Galvanized)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 1800, gstRate: 18, hsn: '7314', category: 'Industrial' },
  { name: 'Steel Grating 40x5mm (Galvanized)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 2400, gstRate: 18, hsn: '7314', category: 'Industrial' },
  { name: 'Conveyor Belt (Rubber) 600mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 3500, gstRate: 18, hsn: '4010', category: 'Industrial' },
  { name: 'Industrial Floor Paint (Epoxy)', type: ResourceType.MATERIAL, unit: 'litre', rate: 520, gstRate: 18, hsn: '3208', category: 'Industrial' },
  { name: 'Industrial Floor Sealer (PU)', type: ResourceType.MATERIAL, unit: 'litre', rate: 680, gstRate: 18, hsn: '3907', category: 'Industrial' },
  { name: 'Loading Dock Bumper (Rubber)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '4016', category: 'Industrial' },
  { name: 'Loading Dock Leveler (Hydraulic)', type: ResourceType.MATERIAL, unit: 'nos', rate: 85000, gstRate: 18, hsn: '8428', category: 'Industrial' },
  { name: 'Industrial Rolling Shutter Motor 1HP', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '8501', category: 'Industrial' },

  // ════════════════════════════════════════════════════════════════
  // 32. MISCELLANEOUS CONSUMABLES & TOOLS
  // ════════════════════════════════════════════════════════════════
  { name: 'Canvas Drop Cloth 12x9 ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 5, hsn: '6306', category: 'Tools & Consumables' },
  { name: 'Spray Gun (Airless) 517 Tip', type: ResourceType.MATERIAL, unit: 'nos', rate: 4500, gstRate: 18, hsn: '8424', category: 'Tools & Consumables' },
  { name: 'Trowel (Finishing) 12 inch', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Float (Wooden) 4ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 350, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Float (Magnesium) 3ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Measuring Tape 30m', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 18, hsn: '9017', category: 'Tools & Consumables' },
  { name: 'Spirit Level (Aluminium) 4ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '9017', category: 'Tools & Consumables' },
  { name: 'Laser Level (Line)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '9015', category: 'Tools & Consumables' },
  { name: 'Grinding Disc 4 inch (Metal)', type: ResourceType.MATERIAL, unit: 'nos', rate: 35, gstRate: 18, hsn: '6804', category: 'Tools & Consumables' },
  { name: 'Cutting Wheel 4 inch (Metal)', type: ResourceType.MATERIAL, unit: 'nos', rate: 32, gstRate: 18, hsn: '6804', category: 'Tools & Consumables' },
  { name: 'Grinding Disc 7 inch (Concrete)', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '6804', category: 'Tools & Consumables' },
  { name: 'Marble Cutting Blade 10 inch', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '6804', category: 'Tools & Consumables' },
  { name: 'Tile Cutter (Manual) 600mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '8467', category: 'Tools & Consumables' },
  { name: 'Hacksaw Blade 12 inch', type: ResourceType.MATERIAL, unit: 'nos', rate: 45, gstRate: 18, hsn: '8202', category: 'Tools & Consumables' },
  { name: 'Chisel (Cold) 19mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 85, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Hammer (Claw) 500g', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Hammer (Sledge) 4kg', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Pliers (Combination) 200mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '8203', category: 'Tools & Consumables' },
  { name: 'Adjustable Wrench 300mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 350, gstRate: 18, hsn: '8204', category: 'Tools & Consumables' },
  { name: 'Pipe Wrench 450mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 18, hsn: '8204', category: 'Tools & Consumables' },

  // ════════════════════════════════════════════════════════════════
  // 33. ADDITIONAL EQUIPMENT
  // ════════════════════════════════════════════════════════════════
  { name: 'Concrete Boom Placer 23m', type: ResourceType.EQUIPMENT, unit: 'day', rate: 12000, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'Concrete Screed Vibrator', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1500, gstRate: 18, hsn: '8474', category: 'Equipment Hire' },
  { name: 'Laser Screed Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 25000, gstRate: 18, hsn: '8479', category: 'Equipment Hire' },
  { name: 'Shot Blasting Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 8500, gstRate: 18, hsn: '8465', category: 'Equipment Hire' },
  { name: 'Floor Scarifier', type: ResourceType.EQUIPMENT, unit: 'day', rate: 4500, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },
  { name: 'Thermoplastic Road Marking Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 8500, gstRate: 18, hsn: '8479', category: 'Equipment Hire' },
  { name: 'Core Drilling Rig 100mm', type: ResourceType.EQUIPMENT, unit: 'day', rate: 2500, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },
  { name: 'Handheld Core Drill 50mm', type: ResourceType.EQUIPMENT, unit: 'day', rate: 800, gstRate: 18, hsn: '8467', category: 'Equipment Hire' },
  { name: 'Air Compressor 100 PSI', type: ResourceType.EQUIPMENT, unit: 'day', rate: 3500, gstRate: 18, hsn: '8414', category: 'Equipment Hire' },
  { name: 'Sand Blasting Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 4500, gstRate: 18, hsn: '8424', category: 'Equipment Hire' },
  { name: 'Crane Truck (Pickup) 5T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 6000, gstRate: 18, hsn: '8705', category: 'Equipment Hire' },
  { name: 'Forklift 3T (Diesel)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 5500, gstRate: 18, hsn: '8427', category: 'Equipment Hire' },
  { name: 'Electric Pallet Truck 2T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1800, gstRate: 18, hsn: '8427', category: 'Equipment Hire' },
  { name: 'Generator Welding Set 250A', type: ResourceType.EQUIPMENT, unit: 'day', rate: 3500, gstRate: 18, hsn: '8515', category: 'Equipment Hire' },
  { name: 'Plasma Cutting Machine', type: ResourceType.EQUIPMENT, unit: 'day', rate: 2500, gstRate: 18, hsn: '8456', category: 'Equipment Hire' },

  // ════════════════════════════════════════════════════════════════
  // 34. ADDITIONAL SPECIALIZED LABOUR
  // ════════════════════════════════════════════════════════════════
  { name: 'Rigger Supervisor', type: ResourceType.LABOUR, unit: 'day', rate: 1200, gstRate: 0, category: 'Skilled Labour' },
  { name: 'QA/QC Engineer', type: ResourceType.LABOUR, unit: 'day', rate: 2200, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Safety Officer', type: ResourceType.LABOUR, unit: 'day', rate: 1800, gstRate: 0, category: 'Skilled Labour' },
  { name: 'BIM Modeller', type: ResourceType.LABOUR, unit: 'day', rate: 2500, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Drone Operator (Survey)', type: ResourceType.LABOUR, unit: 'day', rate: 3500, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Steel Fixer Foreman', type: ResourceType.LABOUR, unit: 'day', rate: 1100, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Concrete Pump Operator', type: ResourceType.LABOUR, unit: 'day', rate: 1500, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Crane Signalman (Banksman)', type: ResourceType.LABOUR, unit: 'day', rate: 800, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Traffic Management Personnel', type: ResourceType.LABOUR, unit: 'day', rate: 650, gstRate: 0, category: 'Skilled Labour' },
  { name: 'Diver (Underwater Works)', type: ResourceType.LABOUR, unit: 'day', rate: 5500, gstRate: 0, category: 'Skilled Labour' },

  // ════════════════════════════════════════════════════════════════
  // 35. SECURITY & SURVEILLANCE SYSTEMS
  // ════════════════════════════════════════════════════════════════
  { name: 'CCTV Camera (Dome) 4MP', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '8525', category: 'Security' },
  { name: 'CCTV Camera (Bullet) 4MP IR', type: ResourceType.MATERIAL, unit: 'nos', rate: 3200, gstRate: 18, hsn: '8525', category: 'Security' },
  { name: 'NVR 32 Channel', type: ResourceType.MATERIAL, unit: 'nos', rate: 28000, gstRate: 18, hsn: '8523', category: 'Security' },
  { name: 'Network Video Storage HDD 8TB (Surveillance)', type: ResourceType.MATERIAL, unit: 'nos', rate: 18500, gstRate: 18, hsn: '8471', category: 'Security' },
  { name: 'Access Control Card Reader (RFID)', type: ResourceType.MATERIAL, unit: 'nos', rate: 4500, gstRate: 18, hsn: '8531', category: 'Security' },
  { name: 'Biometric Attendance Machine (Fingerprint)', type: ResourceType.MATERIAL, unit: 'nos', rate: 6500, gstRate: 18, hsn: '8471', category: 'Security' },
  { name: 'Boom Barrier (Automatic) 4m', type: ResourceType.MATERIAL, unit: 'nos', rate: 65000, gstRate: 18, hsn: '8473', category: 'Security' },
  { name: 'Door Frame Metal Detector (DFMD)', type: ResourceType.MATERIAL, unit: 'nos', rate: 25000, gstRate: 18, hsn: '8543', category: 'Security' },
  { name: 'Handheld Metal Detector (HHMD)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '8543', category: 'Security' },
  { name: 'PA System Speaker (Horn) 15W', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '8518', category: 'Security' },
  { name: 'PA Amplifier 120W', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8518', category: 'Security' },
  { name: 'PA System Microphone (Collar)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '8518', category: 'Security' },
  { name: 'Intercom Set (2-Way Wired)', type: ResourceType.MATERIAL, unit: 'set', rate: 2800, gstRate: 18, hsn: '8517', category: 'Security' },
  { name: 'Video Door Phone (Colour)', type: ResourceType.MATERIAL, unit: 'set', rate: 5500, gstRate: 18, hsn: '8517', category: 'Security' },
  { name: 'Razor Wire (Concertina) 730mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '7313', category: 'Security' },

  // ════════════════════════════════════════════════════════════════
  // 36. ELEVATORS & ESCALATORS
  // ════════════════════════════════════════════════════════════════
  { name: 'Passenger Elevator 8 Person (Supply+Install)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Passenger Elevator 13 Person (Supply+Install)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Service Elevator 1T (Supply+Install)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1450000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Goods Elevator 2T (Supply+Install)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1850000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Glass Capsule Elevator (Panoramic)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1850000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Escalator 30° Rise (Supply+Install)', type: ResourceType.MATERIAL, unit: 'nos', rate: 2500000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Moving Walkway / Travelator', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500000, gstRate: 18, hsn: '8428', category: 'Elevators' },
  { name: 'Elevator Cabin Interior (SS/Hairline Finish)', type: ResourceType.MATERIAL, unit: 'nos', rate: 85000, gstRate: 18, hsn: '8428', category: 'Elevators' },

  // ════════════════════════════════════════════════════════════════
  // 37. SWIMMING POOL EQUIPMENT
  // ════════════════════════════════════════════════════════════════
  { name: 'Pool Sand Filter 24 inch', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '8421', category: 'Pool' },
  { name: 'Pool Pump 1.5HP', type: ResourceType.MATERIAL, unit: 'nos', rate: 12000, gstRate: 18, hsn: '8413', category: 'Pool' },
  { name: 'Pool Skimmer (In-Ground) SS', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8413', category: 'Pool' },
  { name: 'Pool Main Drain (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '7418', category: 'Pool' },
  { name: 'Pool Return Inlet (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '7418', category: 'Pool' },
  { name: 'Pool Underwater Light (LED) 12V RGB', type: ResourceType.MATERIAL, unit: 'nos', rate: 6500, gstRate: 18, hsn: '9405', category: 'Pool' },
  { name: 'Pool Ladder (SS 316) 4 Step', type: ResourceType.MATERIAL, unit: 'nos', rate: 12000, gstRate: 18, hsn: '7418', category: 'Pool' },
  { name: 'Pool Chlorinator (Salt Water Cell)', type: ResourceType.MATERIAL, unit: 'nos', rate: 28000, gstRate: 18, hsn: '8543', category: 'Pool' },

  // ════════════════════════════════════════════════════════════════
  // 38. RAINWATER HARVESTING
  // ════════════════════════════════════════════════════════════════
  { name: 'RWH Filter (In-Line) 100mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8421', category: 'RWH' },
  { name: 'RWH First Flush Diverter 110mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '3917', category: 'RWH' },
  { name: 'RWH Recharge Pit Ring 1m (Concrete)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 5, hsn: '6810', category: 'RWH' },
  { name: 'RWH Storage Module (Modular Crate)', type: ResourceType.MATERIAL, unit: 'cum', rate: 8500, gstRate: 18, hsn: '3926', category: 'RWH' },
  { name: 'RWH Downspout Filter (Leaf Guard)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '8424', category: 'RWH' },

  // ════════════════════════════════════════════════════════════════
  // 39. EV CHARGING INFRASTRUCTURE
  // ════════════════════════════════════════════════════════════════
  { name: 'EV AC Charger 7.4kW (Type 2)', type: ResourceType.MATERIAL, unit: 'nos', rate: 35000, gstRate: 18, hsn: '8504', category: 'EV Charging' },
  { name: 'EV DC Fast Charger 30kW (CCS2)', type: ResourceType.MATERIAL, unit: 'nos', rate: 250000, gstRate: 18, hsn: '8504', category: 'EV Charging' },
  { name: 'EV DC Fast Charger 60kW (CCS2)', type: ResourceType.MATERIAL, unit: 'nos', rate: 450000, gstRate: 18, hsn: '8504', category: 'EV Charging' },
  { name: 'EV Charging Management System (OCPP)', type: ResourceType.MATERIAL, unit: 'set', rate: 85000, gstRate: 18, hsn: '8537', category: 'EV Charging' },

  // ════════════════════════════════════════════════════════════════
  // 40. PRECAST PRODUCTS
  // ════════════════════════════════════════════════════════════════
  { name: 'Precast Manhole Cover (Heavy Duty) 600x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Manhole Cover (Medium) 600x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 2200, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast U-Drain 300x300mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 850, gstRate: 5, hsn: '6810', category: 'Precast' },
  { name: 'Precast Slab 1200x600x50mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 5, hsn: '6810', category: 'Precast' },
  { name: 'Precast Boundary Wall Panel 2.5m x 0.3m', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 5, hsn: '6810', category: 'Precast' },
  { name: 'Precast Septic Tank 2000L', type: ResourceType.MATERIAL, unit: 'nos', rate: 28000, gstRate: 18, hsn: '3925', category: 'Precast' },
  { name: 'Precast Kerb (Tropical) 500x150', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 5, hsn: '6810', category: 'Precast' },
  { name: 'Precast Tree Grate (Cast Iron) 600x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 4500, gstRate: 18, hsn: '7325', category: 'Precast' },
  { name: 'Precast Chamber Cover 450x450', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 5, hsn: '6810', category: 'Precast' },
  { name: 'Precast Gully Grating 300x300 (CI)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '7325', category: 'Precast' },

  // ════════════════════════════════════════════════════════════════
  // 41. LAB & KITCHEN EQUIPMENT
  // ════════════════════════════════════════════════════════════════
  { name: 'Commercial Exhaust Hood 4ft (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 28000, gstRate: 18, hsn: '8414', category: 'Kitchen/Lab' },
  { name: 'Commercial Chimney (Industrial) 8ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 65000, gstRate: 18, hsn: '8414', category: 'Kitchen/Lab' },
  { name: 'Lab Workbench (Acid Resistant) 4ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 35000, gstRate: 18, hsn: '9403', category: 'Kitchen/Lab' },
  { name: 'Fume Hood (Lab) 4ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 85000, gstRate: 18, hsn: '8414', category: 'Kitchen/Lab' },
  { name: 'Eye Wash Station (SS) (Safety)', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '7418', category: 'Kitchen/Lab' },
  { name: 'Emergency Shower (SS) (Safety)', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '7418', category: 'Kitchen/Lab' },

  // ════════════════════════════════════════════════════════════════
  // 42. SURVEY & TESTING INSTRUMENTS
  // ════════════════════════════════════════════════════════════════
  { name: 'Total Station (Rental)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 3500, gstRate: 18, hsn: '9015', category: 'Survey' },
  { name: 'Auto Level (Rental)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 800, gstRate: 18, hsn: '9015', category: 'Survey' },
  { name: 'DGPS Rover (Rental)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 5000, gstRate: 18, hsn: '9015', category: 'Survey' },
  { name: 'Rebound Hammer (Schmidt N-Type)', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '9024', category: 'Survey' },
  { name: 'Concrete Cube Mould 150mm (Cast Iron)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '9024', category: 'Survey' },
  { name: 'Slump Cone Set (IS 1199)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '9024', category: 'Survey' },
  { name: 'Core Cutter Apparatus 100mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '9024', category: 'Survey' },
  { name: 'Sand Replacement Method Kit', type: ResourceType.MATERIAL, unit: 'set', rate: 6500, gstRate: 18, hsn: '9024', category: 'Survey' },
  { name: 'Digital Moisture Meter (Soil)', type: ResourceType.MATERIAL, unit: 'nos', rate: 22000, gstRate: 18, hsn: '9025', category: 'Survey' },
  { name: 'IS Sieve Set (75mm to 75 Micron)', type: ResourceType.MATERIAL, unit: 'set', rate: 18000, gstRate: 18, hsn: '9024', category: 'Survey' },

  // ════════════════════════════════════════════════════════════════
  // 43. MODULAR / PORTABLE CABIN PRODUCTS
  // ════════════════════════════════════════════════════════════════
  { name: 'Porta Cabin (PREFAB) 20ft Standard', type: ResourceType.MATERIAL, unit: 'nos', rate: 85000, gstRate: 18, hsn: '9406', category: 'Modular Cabin' },
  { name: 'Portable Toilet Cabin (FRP)', type: ResourceType.MATERIAL, unit: 'nos', rate: 28000, gstRate: 18, hsn: '9406', category: 'Modular Cabin' },
  { name: 'Modular Site Office (Container) 20ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 120000, gstRate: 18, hsn: '9406', category: 'Modular Cabin' },
  { name: 'Prefab Security Cabin 8x6ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 45000, gstRate: 18, hsn: '9406', category: 'Modular Cabin' },
  { name: 'FRP Portable Toilet Cabin', type: ResourceType.MATERIAL, unit: 'nos', rate: 22000, gstRate: 18, hsn: '3925', category: 'Modular Cabin' },
  { name: 'Modular Guard Room 10x8ft', type: ResourceType.MATERIAL, unit: 'nos', rate: 65000, gstRate: 18, hsn: '9406', category: 'Modular Cabin' },

  // ════════════════════════════════════════════════════════════════
  // 44. SIGNAGE & MISC BUILDING ITEMS
  // ════════════════════════════════════════════════════════════════
  { name: 'Wayfinding Sign (Acrylic) 600x300', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '8310', category: 'Signage' },
  { name: 'Building Name Board (ACP) 2400x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8310', category: 'Signage' },
  { name: 'Flag Pole (SS) 6m', type: ResourceType.MATERIAL, unit: 'nos', rate: 12000, gstRate: 18, hsn: '7308', category: 'Signage' },
  { name: 'Mailbox Bank (10 Units SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '7326', category: 'Signage' },
  { name: 'Door Number Plate (SS)', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '8310', category: 'Signage' },
  { name: 'Window Grille (MS Square Bar) per sqft', type: ResourceType.MATERIAL, unit: 'sqft', rate: 85, gstRate: 18, hsn: '7308', category: 'Signage' },
  { name: 'Anti-Bird Spikes (SS) per rmt', type: ResourceType.MATERIAL, unit: 'rmt', rate: 120, gstRate: 18, hsn: '7308', category: 'Signage' },
  { name: 'Letter Box (Individual Wall Mount)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '7326', category: 'Signage' },

  // ════════════════════════════════════════════════════════════════
  // 45. ADDITIONAL MISCELLANEOUS MATERIALS
  // ════════════════════════════════════════════════════════════════
  { name: 'Gunny Bag (Sandbag) 60x45cm', type: ResourceType.MATERIAL, unit: 'piece', rate: 12, gstRate: 5, hsn: '6305', category: 'Misc Materials' },
  { name: 'Barricading Net (Safety) Orange 1.2m', type: ResourceType.MATERIAL, unit: 'rmt', rate: 45, gstRate: 18, hsn: '3926', category: 'Misc Materials' },
  { name: 'Dustbin (Outdoor) 240L (Wheelie)', type: ResourceType.MATERIAL, unit: 'nos', rate: 2800, gstRate: 18, hsn: '3926', category: 'Misc Materials' },
  { name: 'Dustbin (Indoor) 40L (Pedal)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '3926', category: 'Misc Materials' },
  { name: 'Signage Board (Caution) 300x450', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '8310', category: 'Misc Materials' },
  { name: 'Cones (Traffic) 750mm with Reflector', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '3926', category: 'Misc Materials' },
  { name: 'Barricading Tape (Red/White) 75mm', type: ResourceType.MATERIAL, unit: 'roll', rate: 85, gstRate: 18, hsn: '3919', category: 'Misc Materials' },
  { name: 'Fire Sand Bucket (Red)', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '7323', category: 'Misc Materials' },
  { name: 'Tarpaulin (HDPE) 5m x 3m 180 GSM', type: ResourceType.MATERIAL, unit: 'piece', rate: 650, gstRate: 18, hsn: '6306', category: 'Misc Materials' },
  { name: 'Tarpaulin (HDPE) 8m x 5m 280 GSM', type: ResourceType.MATERIAL, unit: 'piece', rate: 1800, gstRate: 18, hsn: '6306', category: 'Misc Materials' },
  { name: 'Calcium Chloride (Snow Melting/Setting)', type: ResourceType.MATERIAL, unit: 'kg', rate: 65, gstRate: 18, hsn: '2827', category: 'Misc Materials' },
  { name: 'Sodium Silicate (Water Glass)', type: ResourceType.MATERIAL, unit: 'kg', rate: 35, gstRate: 18, hsn: '2839', category: 'Misc Materials' },
  { name: 'Curing Compound Remover', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3405', category: 'Misc Materials' },
  { name: 'Form Release Agent (Mould Oil)', type: ResourceType.MATERIAL, unit: 'litre', rate: 120, gstRate: 18, hsn: '2710', category: 'Misc Materials' },

  // ════════════════════════════════════════════════════════════════
  // 46. PILING & DEEP FOUNDATION
  // ════════════════════════════════════════════════════════════════
  { name: 'Pile Casing Pipe 900mm (MS)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 4500, gstRate: 18, hsn: '7306', category: 'Piling', brandOrSpec: 'Temporary casing' },
  { name: 'Pile Casing Pipe 1200mm (MS)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 6500, gstRate: 18, hsn: '7306', category: 'Piling', brandOrSpec: 'Temporary casing' },
  { name: 'Pile Casing Pipe 1500mm (MS)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 8500, gstRate: 18, hsn: '7306', category: 'Piling', brandOrSpec: 'Temporary casing' },
  { name: 'Bentonite Clay Powder (Piling Grade)', type: ResourceType.MATERIAL, unit: 'bag', rate: 850, gstRate: 18, hsn: '2508', category: 'Piling', brandOrSpec: '50 kg bag' },
  { name: 'Bentonite Clay Powder (Piling Grade) Bulk', type: ResourceType.MATERIAL, unit: 'ton', rate: 16000, gstRate: 18, hsn: '2508', category: 'Piling' },
  { name: 'Tremie Pipe 250mm (Flanged)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 2800, gstRate: 18, hsn: '7306', category: 'Piling' },
  { name: 'Tremie Pipe 300mm (Flanged)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 3500, gstRate: 18, hsn: '7306', category: 'Piling' },
  { name: 'H-Pile Section 250x250 (HP 250)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 4800, gstRate: 18, hsn: '7216', category: 'Piling', brandOrSpec: 'IS 12778' },
  { name: 'H-Pile Section 300x300 (HP 300)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 6800, gstRate: 18, hsn: '7216', category: 'Piling', brandOrSpec: 'IS 12778' },
  { name: 'Micro-Pile Centralizer (Spacer)', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '3926', category: 'Piling' },
  { name: 'Grout for Micro-Pile (Non-Shrink)', type: ResourceType.MATERIAL, unit: 'bag', rate: 850, gstRate: 18, hsn: '3214', category: 'Piling' },
  { name: 'Micro-Pile Tube-a-Manchette (TAM)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 450, gstRate: 18, hsn: '7306', category: 'Piling' },
  { name: 'Micro-Pile Pressure Grouting Pump', type: ResourceType.EQUIPMENT, unit: 'day', rate: 4500, gstRate: 18, hsn: '8413', category: 'Piling' },
  { name: 'Rotary Piling Rig 22T (Bored)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 85000, gstRate: 18, hsn: '8430', category: 'Piling' },
  { name: 'Rotary Piling Rig 35T (Bored)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 145000, gstRate: 18, hsn: '8430', category: 'Piling' },
  { name: 'Diesel Pile Hammer (D30)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8430', category: 'Piling' },
  { name: 'Hydraulic Pile Hammer (Driven)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 35000, gstRate: 18, hsn: '8430', category: 'Piling' },

  // ════════════════════════════════════════════════════════════════
  // 47. BRIDGE / POST-TENSIONING
  // ════════════════════════════════════════════════════════════════
  { name: 'Elastomeric Bearing Pad 200x250x40mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '4008', category: 'Bridge', brandOrSpec: 'IRC:83' },
  { name: 'Elastomeric Bearing Pad 300x400x60mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 4200, gstRate: 18, hsn: '4008', category: 'Bridge', brandOrSpec: 'IRC:83' },
  { name: 'Bridge Expansion Joint (Strip Seal)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 8500, gstRate: 18, hsn: '7308', category: 'Bridge' },
  { name: 'Bridge Expansion Joint (Compression Seal)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 5500, gstRate: 18, hsn: '7308', category: 'Bridge' },
  { name: 'Prestressing Strand 12.7mm (7-Wire) 1860 MPa', type: ResourceType.MATERIAL, unit: 'kg', rate: 145, gstRate: 18, hsn: '7312', category: 'Bridge', brandOrSpec: 'IS 14268' },
  { name: 'Prestressing Strand 15.2mm (7-Wire) 1860 MPa', type: ResourceType.MATERIAL, unit: 'kg', rate: 155, gstRate: 18, hsn: '7312', category: 'Bridge', brandOrSpec: 'IS 14268' },
  { name: 'HDPE Duct for Post-Tensioning 75mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '3917', category: 'Bridge' },
  { name: 'Post-Tensioning Grout Pump', type: ResourceType.EQUIPMENT, unit: 'day', rate: 8500, gstRate: 18, hsn: '8413', category: 'Bridge' },
  { name: 'Hydraulic Prestressing Jack 200T', type: ResourceType.EQUIPMENT, unit: 'day', rate: 12000, gstRate: 18, hsn: '8412', category: 'Bridge' },
  { name: 'Cable Stay Anchorage Assembly', type: ResourceType.MATERIAL, unit: 'set', rate: 85000, gstRate: 18, hsn: '7312', category: 'Bridge' },

  // ════════════════════════════════════════════════════════════════
  // 48. FORMWORK SYSTEMS (Advanced)
  // ════════════════════════════════════════════════════════════════
  { name: 'Aluminum Formwork Panel 600x2700mm (Mivan)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 2800, gstRate: 18, hsn: '7610', category: 'Formwork', brandOrSpec: 'Mivan/Walls & Floors' },
  { name: 'Aluminum Formwork Panel 1200x2700mm (Mivan)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 2500, gstRate: 18, hsn: '7610', category: 'Formwork', brandOrSpec: 'Mivan/Walls & Floors' },
  { name: 'Plastic Formwork Panel 600x600mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '3925', category: 'Formwork' },
  { name: 'Plastic Formwork Panel 1200x600mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 780, gstRate: 18, hsn: '3925', category: 'Formwork' },
  { name: 'Doka Proprietary Tie Rod DW15', type: ResourceType.MATERIAL, unit: 'rmt', rate: 280, gstRate: 18, hsn: '7315', category: 'Formwork' },
  { name: 'Doka Wing Nut for Tie Rod DW15', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '7318', category: 'Formwork' },
  { name: 'PERI Wall Tie System', type: ResourceType.MATERIAL, unit: 'set', rate: 1200, gstRate: 18, hsn: '7318', category: 'Formwork' },
  { name: 'Formwork Accessories Kit (Mixed)', type: ResourceType.MATERIAL, unit: 'ls', rate: 3500, gstRate: 18, hsn: '7318', category: 'Formwork' },
  { name: 'GI Stud & Track Set', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Door Hardware Set', type: ResourceType.MATERIAL, unit: 'set', rate: 3500, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Charcoal & Salt Mix', type: ResourceType.MATERIAL, unit: 'kg', rate: 12, gstRate: 5, hsn: '4402', category: 'Electrical' },
  { name: 'Formwork Release Agent (Bio-Degradable)', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3405', category: 'Formwork' },
  // MISC items used in rate analyses (so every component has a proper name)
  { name: 'Water for Mixing', type: ResourceType.MATERIAL, unit: 'litre', rate: 5, gstRate: 0, category: 'Consumables' },
  { name: 'Shuttering', type: ResourceType.MATERIAL, unit: 'ls', rate: 700, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Shuttering & Formwork', type: ResourceType.MATERIAL, unit: 'ls', rate: 1100, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Shuttering (SCC Pressure)', type: ResourceType.MATERIAL, unit: 'ls', rate: 1400, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Electricity & Water', type: ResourceType.MATERIAL, unit: 'ls', rate: 55, gstRate: 18, category: 'Consumables' },
  { name: 'LPG Gas for Torch', type: ResourceType.MATERIAL, unit: 'cylinder', rate: 1500, gstRate: 18, hsn: '2711', category: 'Consumables' },
  { name: 'Explosives (Controlled Blasting)', type: ResourceType.MATERIAL, unit: 'ls', rate: 200, gstRate: 18, hsn: '3602', category: 'Consumables' },
  { name: 'Water for Dilution', type: ResourceType.MATERIAL, unit: 'litre', rate: 5, gstRate: 0, category: 'Consumables' },
  { name: 'Colour Oxide (Red/Green)', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '3206', category: 'Flooring' },
  { name: 'Epoxy Primer', type: ResourceType.MATERIAL, unit: 'kg', rate: 450, gstRate: 18, hsn: '3907', category: 'Flooring' },
  { name: 'Brass Divider Strip', type: ResourceType.MATERIAL, unit: 'rmt', rate: 85, gstRate: 18, hsn: '7411', category: 'Flooring' },
  { name: 'Laminate Accessories (T-Molding)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '3916', category: 'Flooring' },
  { name: 'Wood Flooring Adhesive', type: ResourceType.MATERIAL, unit: 'kg', rate: 280, gstRate: 18, hsn: '3506', category: 'Flooring' },
  { name: 'EPDM Bonding Adhesive', type: ResourceType.MATERIAL, unit: 'litre', rate: 380, gstRate: 18, hsn: '3506', category: 'Waterproofing' },
  { name: 'DBM Mix Material (per ton)', type: ResourceType.MATERIAL, unit: 'ton', rate: 8500, gstRate: 18, hsn: '2715', category: 'Road Materials' },
  { name: 'BC Mix Material (per ton)', type: ResourceType.MATERIAL, unit: 'ton', rate: 9500, gstRate: 18, hsn: '2715', category: 'Road Materials' },
  { name: 'Precast RCC Pile 300x300', type: ResourceType.MATERIAL, unit: 'rmt', rate: 2800, gstRate: 18, hsn: '6810', category: 'Piling' },
  { name: 'Steel Sheet Pile Section', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7216', category: 'Piling' },

  // ════════════════════════════════════════════════════════════════
  // 49. PRECAST ELEMENTS (Structural)
  // ════════════════════════════════════════════════════════════════
  { name: 'Precast Beam 300x600mm (RCC)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 4500, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Column 400x400mm (RCC)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 5200, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Hollow Core Slab 1200x200mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 3200, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Hollow Core Slab 1200x300mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 4200, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Wall Panel 3.0 x 2.5 x 0.15m', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Staircase Flight (L-Shaped)', type: ResourceType.MATERIAL, unit: 'nos', rate: 22000, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Lintel 1200mm (RCC)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '6810', category: 'Precast' },
  { name: 'Precast Sunshade 900mm Cantilever', type: ResourceType.MATERIAL, unit: 'rmt', rate: 1200, gstRate: 18, hsn: '6810', category: 'Precast' },

  // ════════════════════════════════════════════════════════════════
  // 50. RETAINING WALL / GEO-TECHNICAL
  // ════════════════════════════════════════════════════════════════
  { name: 'Geo-grid (Biaxial) 30x30 kN/m', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '7019', category: 'Geotech', brandOrSpec: 'MSE Wall' },
  { name: 'Geo-grid (Uniaxial) 60 kN/m', type: ResourceType.MATERIAL, unit: 'sqm', rate: 450, gstRate: 18, hsn: '7019', category: 'Geotech' },
  { name: 'Gabion Box 1x1x1m (PVC Coated)', type: ResourceType.MATERIAL, unit: 'nos', rate: 2800, gstRate: 18, hsn: '7314', category: 'Geotech' },
  { name: 'Gabion Box 2x1x0.5m (PVC Coated)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '7314', category: 'Geotech' },
  { name: 'MSE Wall Panel 1.5 x 1.5m (Precast)', type: ResourceType.MATERIAL, unit: 'nos', rate: 4500, gstRate: 18, hsn: '6810', category: 'Geotech' },
  { name: 'Soil Nail 25mm x 4m (Hollow Bar)', type: ResourceType.MATERIAL, unit: 'nos', rate: 2200, gstRate: 18, hsn: '7308', category: 'Geotech' },
  { name: 'Soil Nail Bearing Plate 150x150x10mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '7308', category: 'Geotech' },

  // ════════════════════════════════════════════════════════════════
  // 51. ACOUSTIC TREATMENT
  // ════════════════════════════════════════════════════════════════
  { name: 'Acoustic Panel 600x600x25mm (Fabric Wrapped)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '6806', category: 'Acoustic' },
  { name: 'Acoustic Panel 1200x600x50mm (Wood Wool)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '6806', category: 'Acoustic' },
  { name: 'Acoustic Baffle (Suspended) 1200x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 1500, gstRate: 18, hsn: '6806', category: 'Acoustic' },
  { name: 'Acoustic Sealant (Gun Grade)', type: ResourceType.MATERIAL, unit: 'tube', rate: 320, gstRate: 18, hsn: '3506', category: 'Acoustic' },
  { name: 'Acoustic Underlay 5mm (Floor)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 280, gstRate: 18, hsn: '3918', category: 'Acoustic' },
  { name: 'Mass Loaded Vinyl Barrier 5kg/sqm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '3920', category: 'Acoustic' },

  // ════════════════════════════════════════════════════════════════
  // 52. SPORTS INFRASTRUCTURE
  // ════════════════════════════════════════════════════════════════
  { name: 'PU Running Track Surface 13mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 1800, gstRate: 18, hsn: '3918', category: 'Sports', brandOrSpec: 'IAAF Certified' },
  { name: 'Acrylic Court Flooring 5-Layer', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '3907', category: 'Sports', brandOrSpec: 'Tennis/Basketball' },
  { name: 'Sports Vinyl Flooring 6.5mm (Indoor)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 2200, gstRate: 18, hsn: '3918', category: 'Sports', brandOrSpec: 'Badminton' },
  { name: 'Sports Lighting Floodlight 1200W LED', type: ResourceType.MATERIAL, unit: 'nos', rate: 45000, gstRate: 18, hsn: '9405', category: 'Sports' },
  { name: 'Sports Poles 12m (Octagonal Steel)', type: ResourceType.MATERIAL, unit: 'nos', rate: 85000, gstRate: 18, hsn: '7308', category: 'Sports' },
  { name: 'Artificial Turf Football Pitch 50mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 850, gstRate: 18, hsn: '5703', category: 'Sports' },

  // ════════════════════════════════════════════════════════════════
  // 53. SMART HOME / IoT
  // ════════════════════════════════════════════════════════════════
  { name: 'Smart Switch 1-Gang (Wi-Fi/Touch)', type: ResourceType.MATERIAL, unit: 'nos', rate: 2800, gstRate: 18, hsn: '8536', category: 'Smart Home' },
  { name: 'Smart Switch 2-Gang (Wi-Fi/Touch)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '8536', category: 'Smart Home' },
  { name: 'PIR Motion Sensor (Ceiling Mount)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '8531', category: 'Smart Home' },
  { name: 'Smart Door Lock (Fingerprint + RFID)', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '8301', category: 'Smart Home' },
  { name: 'Video Doorbell (Wi-Fi 1080p)', type: ResourceType.MATERIAL, unit: 'nos', rate: 12000, gstRate: 18, hsn: '8517', category: 'Smart Home' },
  { name: 'Smart Home Hub (Central Controller)', type: ResourceType.MATERIAL, unit: 'nos', rate: 15000, gstRate: 18, hsn: '8517', category: 'Smart Home' },
  { name: 'Smart Curtain Motor 35mm Tube', type: ResourceType.MATERIAL, unit: 'nos', rate: 8500, gstRate: 18, hsn: '8501', category: 'Smart Home' },
  { name: 'Smart Smoke Detector (Wi-Fi)', type: ResourceType.MATERIAL, unit: 'nos', rate: 3500, gstRate: 18, hsn: '8531', category: 'Smart Home' },

  // ════════════════════════════════════════════════════════════════
  // 54. PLUMBING VARIANTS (Additional Pipe Sizes & Fittings)
  // ════════════════════════════════════════════════════════════════
  { name: 'GI Pipe 15mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 95, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 20mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 115, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 32mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 180, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 40mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 220, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 65mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 380, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 80mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 450, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'GI Pipe 100mm (Class B)', type: ResourceType.MATERIAL, unit: 'metre', rate: 620, gstRate: 18, hsn: '7306', category: 'Plumbing' },
  { name: 'CPVC Pipe 20mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 75, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Pipe 32mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 120, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Pipe 40mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 150, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Pipe 65mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 280, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Pipe 80mm SDR 11', type: ResourceType.MATERIAL, unit: 'metre', rate: 350, gstRate: 18, hsn: '3917', category: 'Plumbing' },

  // ════════════════════════════════════════════════════════════════
  // 55. ADDITIONAL PIPE FITTINGS
  // ════════════════════════════════════════════════════════════════
  { name: 'CPVC Reducing Tee 25-20mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 28, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Cross Fitting 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 35, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Cap 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 12, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Bushing 25-20mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 18, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'CPVC Union 25mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '3917', category: 'Plumbing' },
  { name: 'GI Elbow 50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 180, gstRate: 18, hsn: '7307', category: 'Plumbing' },
  { name: 'GI Tee 50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 220, gstRate: 18, hsn: '7307', category: 'Plumbing' },
  { name: 'GI Socket 50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 150, gstRate: 18, hsn: '7307', category: 'Plumbing' },
  { name: 'GI Reducer 80-50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 380, gstRate: 18, hsn: '7307', category: 'Plumbing' },
  { name: 'GI Nipple 50mm', type: ResourceType.MATERIAL, unit: 'piece', rate: 120, gstRate: 18, hsn: '7307', category: 'Plumbing' },

  // ════════════════════════════════════════════════════════════════
  // 56. ADDITIONAL ELECTRICAL WIRES
  // ════════════════════════════════════════════════════════════════
  { name: 'Copper Wire 16 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 165, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 35 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 380, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 50 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 520, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 70 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 720, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 95 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 980, gstRate: 18, hsn: '8544', category: 'Electrical' },
  { name: 'Copper Wire 120 sqmm FR', type: ResourceType.MATERIAL, unit: 'metre', rate: 1250, gstRate: 18, hsn: '8544', category: 'Electrical' },

  // ════════════════════════════════════════════════════════════════
  // 57. ADDITIONAL SWITCHES & SOCKETS
  // ════════════════════════════════════════════════════════════════
  { name: 'Switch 6A 2-Way Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Switch 16A 2-Way Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 65, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Socket 3-Pin 6A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Socket 3-Pin 16A Modular with Switch', type: ResourceType.MATERIAL, unit: 'piece', rate: 95, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'USB Socket 2x2.1A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 380, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Switch Box (Modular) 3 Module', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 18, hsn: '8536', category: 'Electrical' },

  // ════════════════════════════════════════════════════════════════
  // 58. ADDITIONAL PAINTS, PRIMERS & COATINGS
  // ════════════════════════════════════════════════════════════════
  { name: 'Wood Primer (Pink)', type: ResourceType.MATERIAL, unit: 'litre', rate: 240, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Metal Primer (ETP Anti-Corrosive)', type: ResourceType.MATERIAL, unit: 'litre', rate: 320, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Cement Primer (Alkali Resistant)', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Anti-Graffiti Coating (Clear)', type: ResourceType.MATERIAL, unit: 'litre', rate: 850, gstRate: 18, hsn: '3209', category: 'Paints' },
  { name: 'Anti-Slip Floor Coating (Epoxy)', type: ResourceType.MATERIAL, unit: 'litre', rate: 680, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Intumescent Fire Retardant Coating', type: ResourceType.MATERIAL, unit: 'litre', rate: 1200, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Wood Lacquer (PU Based) Glossy', type: ResourceType.MATERIAL, unit: 'litre', rate: 480, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Wood Stain (Teak) Solvent Based', type: ResourceType.MATERIAL, unit: 'litre', rate: 350, gstRate: 18, hsn: '3208', category: 'Paints' },
  { name: 'Wood Sealer (NC)', type: ResourceType.MATERIAL, unit: 'litre', rate: 380, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Faux Finish Paint (Decorative)', type: ResourceType.MATERIAL, unit: 'litre', rate: 650, gstRate: 18, hsn: '3209', category: 'Paints' },

  // ════════════════════════════════════════════════════════════════
  // 59. LIFTING, RIGGING & TACKLES
  // ════════════════════════════════════════════════════════════════
  { name: 'Nylon Rope 12mm 3-Strand', type: ResourceType.MATERIAL, unit: 'metre', rate: 45, gstRate: 18, hsn: '5607', category: 'Lifting' },
  { name: 'Manila Rope 20mm Natural', type: ResourceType.MATERIAL, unit: 'metre', rate: 65, gstRate: 18, hsn: '5607', category: 'Lifting' },
  { name: 'Polypropylene Rope 16mm', type: ResourceType.MATERIAL, unit: 'metre', rate: 35, gstRate: 18, hsn: '5607', category: 'Lifting' },
  { name: 'Lifting Chain 8mm (Grade 80)', type: ResourceType.MATERIAL, unit: 'metre', rate: 450, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'Non-Lifting Chain 6mm (MS Galvanized)', type: ResourceType.MATERIAL, unit: 'metre', rate: 120, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'D-Shackle 6T (Galvanized)', type: ResourceType.MATERIAL, unit: 'piece', rate: 280, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'Bow Shackle 5T (Forged)', type: ResourceType.MATERIAL, unit: 'piece', rate: 320, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'Turnbuckle Jaw-Jaw 16mm (Forged)', type: ResourceType.MATERIAL, unit: 'piece', rate: 380, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'Wire Rope Clip 12mm (U-Bolt)', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'Wire Rope Thimble 12mm (Galvanized)', type: ResourceType.MATERIAL, unit: 'piece', rate: 65, gstRate: 18, hsn: '7315', category: 'Lifting' },
  { name: 'Wire Rope Sling 16mm x 3m (Eye-Eye)', type: ResourceType.MATERIAL, unit: 'piece', rate: 850, gstRate: 18, hsn: '7312', category: 'Lifting' },
  { name: 'Chain Pulley Block 5T', type: ResourceType.MATERIAL, unit: 'piece', rate: 18000, gstRate: 18, hsn: '8483', category: 'Lifting' },

  // ════════════════════════════════════════════════════════════════
  // 60. CONSTRUCTION CHEMICALS & ADHESIVES (Essential)
  // ════════════════════════════════════════════════════════════════
  { name: 'Epoxy Adhesive (Structural)', type: ResourceType.MATERIAL, unit: 'kg', rate: 1200, gstRate: 18, hsn: '3907', category: 'Admixtures' },
  { name: 'Non-Shrink Grout (Cementitious)', type: ResourceType.MATERIAL, unit: 'bag', rate: 950, gstRate: 18, hsn: '3214', category: 'Admixtures' },
  { name: 'Epoxy Mortar Repair Kit', type: ResourceType.MATERIAL, unit: 'kg', rate: 680, gstRate: 18, hsn: '3907', category: 'Admixtures' },
  { name: 'Construction Chemical (Bonding Aid)', type: ResourceType.MATERIAL, unit: 'litre', rate: 180, gstRate: 18, hsn: '3824', category: 'Admixtures' },
  { name: 'Tile Spacer (Cross) 3mm', type: ResourceType.MATERIAL, unit: 'packet', rate: 45, gstRate: 18, hsn: '3926', category: 'Admixtures' },
  { name: 'Tile Spacer (Cross) 5mm', type: ResourceType.MATERIAL, unit: 'packet', rate: 45, gstRate: 18, hsn: '3926', category: 'Admixtures' },
  { name: 'Tile Leveling Clip System', type: ResourceType.MATERIAL, unit: 'packet', rate: 280, gstRate: 18, hsn: '8205', category: 'Admixtures' },
  { name: 'Silicone Sealant (Weatherproof) Clear', type: ResourceType.MATERIAL, unit: 'tube', rate: 220, gstRate: 18, hsn: '3506', category: 'Admixtures' },
  { name: 'Silicone Sealant (Weatherproof) White', type: ResourceType.MATERIAL, unit: 'tube', rate: 220, gstRate: 18, hsn: '3506', category: 'Admixtures' },
  { name: 'Acrylic Bonding Agent', type: ResourceType.MATERIAL, unit: 'litre', rate: 150, gstRate: 18, hsn: '3907', category: 'Admixtures' },

  // ════════════════════════════════════════════════════════════════
  // 61. SAFETY PPE (Personal Protective Equipment)
  // ════════════════════════════════════════════════════════════════
  { name: 'Safety Harness (Full Body)', type: ResourceType.MATERIAL, unit: 'nos', rate: 1800, gstRate: 18, hsn: '6217', category: 'Fire Safety' },
  { name: 'Safety Gloves (Cut Resistant)', type: ResourceType.MATERIAL, unit: 'pair', rate: 180, gstRate: 18, hsn: '6116', category: 'Fire Safety' },
  { name: 'Safety Gloves (Leather)', type: ResourceType.MATERIAL, unit: 'pair', rate: 120, gstRate: 18, hsn: '4203', category: 'Fire Safety' },
  { name: 'Safety Goggles (Clear)', type: ResourceType.MATERIAL, unit: 'nos', rate: 85, gstRate: 18, hsn: '9004', category: 'Fire Safety' },
  { name: 'Ear Protection (Earmuffs)', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '3926', category: 'Fire Safety' },
  { name: 'Dust Mask (N95)', type: ResourceType.MATERIAL, unit: 'nos', rate: 45, gstRate: 18, hsn: '6307', category: 'Fire Safety' },
  { name: 'Respirator Mask (Half Face)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '9020', category: 'Fire Safety' },
  { name: 'Knee Pads (Gel)', type: ResourceType.MATERIAL, unit: 'pair', rate: 280, gstRate: 18, hsn: '6116', category: 'Fire Safety' },
  { name: 'Safety Cone Light (LED Beacon)', type: ResourceType.MATERIAL, unit: 'nos', rate: 450, gstRate: 18, hsn: '8512', category: 'Fire Safety' },
  { name: 'Safety Lanyard (2m Shock Absorbing)', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '5607', category: 'Fire Safety' },

  // ════════════════════════════════════════════════════════════════
  // 62. FORMWORK ACCESSORIES (Essential)
  // ════════════════════════════════════════════════════════════════
  { name: 'Adjustable Base Jack (Scaffolding)', type: ResourceType.MATERIAL, unit: 'nos', rate: 220, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'U-Head Jack (Formwork)', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Formwork Soldier (Steel)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 450, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Formwork Ledger (Steel)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 320, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Wall Form Bracket', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '7308', category: 'Formwork' },
  { name: 'Pin & Wedgpin Set (Cuplock)', type: ResourceType.MATERIAL, unit: 'set', rate: 45, gstRate: 18, hsn: '7318', category: 'Formwork' },

  // ════════════════════════════════════════════════════════════════
  // 63. DRYWALL & INTERIOR ACCESSORIES
  // ════════════════════════════════════════════════════════════════
  { name: 'Ceiling Rose (POP) 450mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '2520', category: 'Interiors' },
  { name: 'Ceiling Rose (POP) 600mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 280, gstRate: 18, hsn: '2520', category: 'Interiors' },
  { name: 'Drywall Screw (Bugle Head) 25mm', type: ResourceType.MATERIAL, unit: 'box', rate: 180, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Drywall Screw (Bugle Head) 45mm', type: ResourceType.MATERIAL, unit: 'box', rate: 220, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Chipboard Screw 4x35mm', type: ResourceType.MATERIAL, unit: 'box', rate: 150, gstRate: 18, hsn: '7318', category: 'Fasteners' },
  { name: 'Wall Plug (Universal Nylon) 8mm', type: ResourceType.MATERIAL, unit: 'box', rate: 85, gstRate: 18, hsn: '3926', category: 'Fasteners' },
  { name: 'Wall Plug (Universal Nylon) 12mm', type: ResourceType.MATERIAL, unit: 'box', rate: 120, gstRate: 18, hsn: '3926', category: 'Fasteners' },
  { name: 'POP Corbel (Decorative)', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '2520', category: 'Interiors' },
  { name: 'Wall Panelling (Fluted) MDF', type: ResourceType.MATERIAL, unit: 'sqft', rate: 220, gstRate: 18, hsn: '4412', category: 'Interiors' },

  // ════════════════════════════════════════════════════════════════
  // 64. DOOR HARDWARE (Additional)
  // ════════════════════════════════════════════════════════════════
  { name: 'Door Stopper (Floor Mounted) SS', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Door Stopper (Wall Mounted) Magnetic', type: ResourceType.MATERIAL, unit: 'nos', rate: 220, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Magnetic Catch (Cabinet) SS', type: ResourceType.MATERIAL, unit: 'nos', rate: 85, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Concealed Hinge (Soft Close)', type: ResourceType.MATERIAL, unit: 'pair', rate: 280, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Barrel Bolt (SS) 150mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 150, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Flush Bolt (SS) 200mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 220, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Door Viewer (Wide Angle) 14mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '8302', category: 'Doors' },

  // ════════════════════════════════════════════════════════════════
  // 65. COMMON CONSUMABLES & SITE SUPPLIES
  // ════════════════════════════════════════════════════════════════
  { name: 'Plastic Bucket 15L', type: ResourceType.MATERIAL, unit: 'nos', rate: 85, gstRate: 18, hsn: '3923', category: 'Consumables' },
  { name: 'Plastic Bucket 20L', type: ResourceType.MATERIAL, unit: 'nos', rate: 120, gstRate: 18, hsn: '3923', category: 'Consumables' },
  { name: 'Plastic Jerry Can 20L', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '3923', category: 'Consumables' },
  { name: 'Spray Bottle (Trigger) 1L', type: ResourceType.MATERIAL, unit: 'nos', rate: 85, gstRate: 18, hsn: '3924', category: 'Consumables' },
  { name: 'Chalk Line Reel (100m)', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 18, hsn: '8205', category: 'Tools & Consumables' },
  { name: 'Chalk Powder (Blue)', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '2530', category: 'Consumables' },
  { name: 'Pencil Marker (Construction) Red', type: ResourceType.MATERIAL, unit: 'nos', rate: 12, gstRate: 18, hsn: '3609', category: 'Consumables' },
  { name: 'Masking Paper Roll 450mm', type: ResourceType.MATERIAL, unit: 'roll', rate: 85, gstRate: 18, hsn: '4811', category: 'Consumables' },
  { name: 'Sponges (Cleaning) Heavy Duty', type: ResourceType.MATERIAL, unit: 'nos', rate: 35, gstRate: 18, hsn: '3924', category: 'Consumables' },

  // ════════════════════════════════════════════════════════════════
  // 66. BUILDING EXTRAS (Commonly Used)
  // ════════════════════════════════════════════════════════════════
  { name: 'Skylight (Polycarbonate) Dome 600x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 2800, gstRate: 18, hsn: '3920', category: 'Roofing' },
  { name: 'Insect Mesh (Aluminium) per sqm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 120, gstRate: 18, hsn: '7616', category: 'Doors' },
  { name: 'Insect Mesh (Fibreglass) per sqm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 85, gstRate: 18, hsn: '7019', category: 'Doors' },
  { name: 'Ventilator Louvre (Aluminium) 600x600', type: ResourceType.MATERIAL, unit: 'nos', rate: 1200, gstRate: 18, hsn: '7610', category: 'Doors' },
  { name: 'MS Square Bar 12mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 72, gstRate: 18, hsn: '7214', category: 'Steel' },
  { name: 'MS Square Bar 16mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 74, gstRate: 18, hsn: '7214', category: 'Steel' },
  { name: 'MS Round Pipe 25mm (Medium)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 165, gstRate: 18, hsn: '7306', category: 'Steel' },
  { name: 'MS Round Pipe 40mm (Medium)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 220, gstRate: 18, hsn: '7306', category: 'Steel' },
  { name: 'MS Sheet 1.6mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 78, gstRate: 18, hsn: '7208', category: 'Steel' },
  { name: 'MS Sheet 3mm', type: ResourceType.MATERIAL, unit: 'kg', rate: 76, gstRate: 18, hsn: '7208', category: 'Steel' },

  // ════════════════════════════════════════════════════════════════
  // 67. INFRASTRUCTURE & ROAD SAFETY MATERIALS
  // ════════════════════════════════════════════════════════════════
  { name: 'W-Beam Crash Barrier (Galvanized) 3mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 850, gstRate: 18, hsn: '7314', category: 'Road Safety', brandOrSpec: '2-wave guardrail' },
  { name: 'Crash Barrier Post (MS) 140x70mm', type: ResourceType.MATERIAL, unit: 'nos', rate: 650, gstRate: 18, hsn: '7216', category: 'Road Safety' },
  { name: 'RCC Hume Pipe NP3 600mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 1800, gstRate: 5, hsn: '6810', category: 'Infrastructure' },
  { name: 'RCC Hume Pipe NP3 900mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 3500, gstRate: 5, hsn: '6810', category: 'Infrastructure' },
  { name: 'RCC Hume Pipe NP3 300mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 850, gstRate: 5, hsn: '6810', category: 'Infrastructure' },
  { name: 'Expansion Joint Filler Board (Bituminous) 12mm', type: ResourceType.MATERIAL, unit: 'sqm', rate: 180, gstRate: 18, hsn: '6807', category: 'Infrastructure' },
  { name: 'Z-Purlin (Galvanized) 200x50x20x2mm', type: ResourceType.MATERIAL, unit: 'rmt', rate: 320, gstRate: 18, hsn: '7216', category: 'Steel' },
  { name: 'GI Gutter 300mm (Pre-Coated)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 450, gstRate: 18, hsn: '7210', category: 'Roofing' },
  { name: 'EOT Crane Rail Clamps', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '7302', category: 'Industrial' },
  { name: 'Octagonal Steel Lighting Pole 9m', type: ResourceType.MATERIAL, unit: 'nos', rate: 18000, gstRate: 18, hsn: '7308', category: 'Road Safety' },
  { name: 'Energy Dissipater Block (Concrete)', type: ResourceType.MATERIAL, unit: 'nos', rate: 180, gstRate: 5, hsn: '6810', category: 'Infrastructure' },
  { name: 'Stone Pitching (Rubble)', type: ResourceType.MATERIAL, unit: 'cum', rate: 1200, gstRate: 5, hsn: '2517', category: 'Aggregates' },
  { name: 'Approach Embankment Fill (Soil)', type: ResourceType.MATERIAL, unit: 'cum', rate: 250, gstRate: 0, category: 'Aggregates' },

  // ════════════════════════════════════════════════════════════════
  // 68. ELECTRICAL INFRASTRUCTURE
  // ════════════════════════════════════════════════════════════════
  { name: 'Fire Alarm Panel (Addressable) 4 Zone', type: ResourceType.MATERIAL, unit: 'nos', rate: 22000, gstRate: 18, hsn: '8531', category: 'Fire Safety' },
  { name: 'AC Distribution Box (Surface) IP54', type: ResourceType.MATERIAL, unit: 'nos', rate: 4500, gstRate: 18, hsn: '8537', category: 'Electrical' },
  { name: 'DC Distribution Box (Surface) IP54', type: ResourceType.MATERIAL, unit: 'nos', rate: 5500, gstRate: 18, hsn: '8537', category: 'Electrical' },
  { name: 'Roof Penetration Sealing Kit', type: ResourceType.MATERIAL, unit: 'set', rate: 850, gstRate: 18, hsn: '3907', category: 'Solar' },
  { name: 'Oxygen Pipeline (Copper) 15mm Type L', type: ResourceType.MATERIAL, unit: 'rmt', rate: 320, gstRate: 18, hsn: '7411', category: 'HVAC' },
  { name: 'Vacuum Pipeline (Copper) 22mm Type L', type: ResourceType.MATERIAL, unit: 'rmt', rate: 450, gstRate: 18, hsn: '7411', category: 'HVAC' },
  { name: 'Nitrous Oxide Pipeline (Copper) 18mm Type L', type: ResourceType.MATERIAL, unit: 'rmt', rate: 380, gstRate: 18, hsn: '7411', category: 'HVAC' },

  // ════════════════════════════════════════════════════════════════
  // 69. SWIMMING POOL & WATERPROOFING EXTRAS
  // ════════════════════════════════════════════════════════════════
  { name: 'Float Valve 80mm (Brass)', type: ResourceType.MATERIAL, unit: 'nos', rate: 850, gstRate: 18, hsn: '8481', category: 'Plumbing' },
  { name: 'Epoxy Tile Grout (Pool Grade)', type: ResourceType.MATERIAL, unit: 'kg', rate: 280, gstRate: 18, hsn: '3214', category: 'Pool' },
  { name: 'Deck Drainage Channel (SS)', type: ResourceType.MATERIAL, unit: 'rmt', rate: 1200, gstRate: 18, hsn: '7323', category: 'Pool' },

  // ════════════════════════════════════════════════════════════════
  // 70. BITUMINOUS MIX MATERIALS
  // ════════════════════════════════════════════════════════════════
  { name: 'DBM Mix Material (per ton)', type: ResourceType.MATERIAL, unit: 'ton', rate: 8500, gstRate: 18, hsn: '2713', category: 'Road Materials' },
  { name: 'BC Mix Material (per ton)', type: ResourceType.MATERIAL, unit: 'ton', rate: 9500, gstRate: 18, hsn: '2713', category: 'Road Materials' },
  { name: 'Bentonite Clay Powder (Piling Grade) Bulk', type: ResourceType.MATERIAL, unit: 'kg', rate: 16, gstRate: 5, hsn: '2508', category: 'Infrastructure' },
  { name: 'Grout for Micro-Pile (Non-Shrink)', type: ResourceType.MATERIAL, unit: 'kg', rate: 17, gstRate: 18, hsn: '3824', category: 'Infrastructure' },
  { name: 'Micro-Pile Centralizer (Spacer)', type: ResourceType.MATERIAL, unit: 'piece', rate: 85, gstRate: 18, hsn: '7308', category: 'Infrastructure' },
  { name: 'Steel Sheet Pile Section', type: ResourceType.MATERIAL, unit: 'kg', rate: 85, gstRate: 18, hsn: '7308', category: 'Steel' },
  { name: 'Precast RCC Pile 300x300', type: ResourceType.MATERIAL, unit: 'rmt', rate: 2800, gstRate: 5, hsn: '6810', category: 'Infrastructure' },
  { name: 'Rotary Piling Rig 22T (Bored)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 85000, gstRate: 18, hsn: '8430', category: 'Equipment Hire' },
  { name: 'Diesel Pile Hammer (D30)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 18000, gstRate: 18, hsn: '8430', category: 'Equipment Hire' },
  { name: 'Hydraulic Pile Hammer (Driven)', type: ResourceType.EQUIPMENT, unit: 'day', rate: 35000, gstRate: 18, hsn: '8430', category: 'Equipment Hire' },
  { name: 'Micro-Pile Pressure Grouting Pump', type: ResourceType.EQUIPMENT, unit: 'day', rate: 4500, gstRate: 18, hsn: '8413', category: 'Equipment Hire' },
  { name: 'Switch Box (Modular) 3 Module', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Socket 3-Pin 6A Modular', type: ResourceType.MATERIAL, unit: 'piece', rate: 45, gstRate: 18, hsn: '8536', category: 'Electrical' },
  { name: 'Wood Sealer (NC)', type: ResourceType.MATERIAL, unit: 'litre', rate: 380, gstRate: 18, hsn: '3210', category: 'Paints' },
  { name: 'Charcoal & Salt Mix', type: ResourceType.MATERIAL, unit: 'kg', rate: 12, gstRate: 5, hsn: '3802', category: 'Electrical' },
  { name: 'GI Stud & Track Set', type: ResourceType.MATERIAL, unit: 'rmt', rate: 180, gstRate: 18, hsn: '7308', category: 'Flooring' },
  { name: 'Door Hardware Set', type: ResourceType.MATERIAL, unit: 'set', rate: 3500, gstRate: 18, hsn: '8302', category: 'Doors' },
  { name: 'Curing Mats (Hessian)', type: ResourceType.MATERIAL, unit: 'sqm', rate: 35, gstRate: 5, hsn: '6305', category: 'Consumables' },
];
