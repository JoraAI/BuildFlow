/**
 * Utility Estimate Templates - Water Tanks, STP, Swimming Pools, Solar
 */
import type { EstimateTemplate } from './types';

export const UTILITY_TEMPLATES: EstimateTemplate[] = [
  {
    id: 'overhead-water-tank',
    name: 'Overhead RCC Water Tank (1,00,000 Litres)',
    description: 'Elevated RCC water tank on staging - foundation, columns, tank bowl, waterproofing, pipework',
    category: 'Utilities',
    sections: [
      {
        name: '1. Foundation',
        items: [
          { itemCode: 'WT-P-001', description: 'Excavation for raft foundation', unit: 'cum', quantity: 85, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'WT-P-002', description: 'PCC M15 (100mm) blinding', unit: 'cum', quantity: 12, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'WT-P-003', description: 'RCC M30 raft foundation', unit: 'cum', quantity: 38, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'WT-P-004', description: 'Foundation reinforcement', unit: 'kg', quantity: 5700, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 20mm' },
        ],
      },
      {
        name: '2. Staging Columns & Beams',
        items: [
          { itemCode: 'WT-ST-001', description: 'RCC M30 staging columns (8 nos)', unit: 'cum', quantity: 22, rate: 10500, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'WT-ST-002', description: 'RCC M30 brace beams', unit: 'cum', quantity: 15, rate: 10500, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'WT-ST-003', description: 'Column reinforcement', unit: 'kg', quantity: 5500, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'WT-ST-004', description: 'Shuttering for columns & beams', unit: 'sqm', quantity: 280, rate: 450, type: 'MATERIAL', resourceName: 'Shuttering Plywood 18mm Waterproof' },
        ],
      },
      {
        name: '3. Tank Bowl (Bottom Dome, Walls, Top Dome)',
        items: [
          { itemCode: 'WT-BW-001', description: 'RCC M30 bottom dome (150mm)', unit: 'cum', quantity: 18, rate: 11000, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'WT-BW-002', description: 'RCC M30 cylindrical walls (200mm)', unit: 'cum', quantity: 28, rate: 11000, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'WT-BW-003', description: 'RCC M30 top dome (100mm)', unit: 'cum', quantity: 12, rate: 11000, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'WT-BW-004', description: 'Tank reinforcement (all)', unit: 'kg', quantity: 12000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'WT-BW-005', description: 'OPC cement for tank', unit: 'bag', quantity: 950, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'WT-BW-006', description: 'Superplasticizer (PCE)', unit: 'litre', quantity: 150, rate: 135, type: 'MATERIAL', resourceName: 'Superplasticizer (PCE Based)' },
        ],
      },
      {
        name: '4. Waterproofing & Internal Treatment',
        items: [
          { itemCode: 'WT-WP-001', description: 'Crystalline waterproofing (internal)', unit: 'sqm', quantity: 320, rate: 320, type: 'MATERIAL', resourceName: 'Crystalline Waterproofing' },
          { itemCode: 'WT-WP-002', description: 'SBR latex coating (2 coats)', unit: 'sqm', quantity: 320, rate: 280, type: 'MATERIAL', resourceName: 'SBR Latex Bonding Agent' },
          { itemCode: 'WT-WP-003', description: 'Integral waterproofing compound', unit: 'litre', quantity: 85, rate: 140, type: 'MATERIAL', resourceName: 'Integral Waterproofing Liquid' },
          { itemCode: 'WT-WP-004', description: 'External painting (epoxy)', unit: 'sqm', quantity: 180, rate: 520, type: 'MATERIAL', resourceName: 'Epoxy Paint (Industrial)' },
        ],
      },
      {
        name: '5. Pipework & Accessories',
        items: [
          { itemCode: 'WT-PP-001', description: 'Inlet pipe GI 80mm', unit: 'metre', quantity: 25, rate: 450, type: 'MATERIAL', resourceName: 'GI Pipe 80mm (Class B)' },
          { itemCode: 'WT-PP-002', description: 'Outlet pipe GI 80mm', unit: 'metre', quantity: 20, rate: 450, type: 'MATERIAL', resourceName: 'GI Pipe 80mm (Class B)' },
          { itemCode: 'WT-PP-003', description: 'Overflow pipe GI 100mm', unit: 'metre', quantity: 12, rate: 620, type: 'MATERIAL', resourceName: 'GI Pipe 100mm (Class B)' },
          { itemCode: 'WT-PP-004', description: 'Sluice valve 80mm', unit: 'nos', quantity: 3, rate: 3200, type: 'MATERIAL', resourceName: 'Sluice Valve 80mm (CI)' },
          { itemCode: 'WT-PP-005', description: 'Float valve 80mm', unit: 'nos', quantity: 1, rate: 4500, type: 'MATERIAL', resourceName: 'Float Valve 80mm (Brass)' },
          { itemCode: 'WT-PP-006', description: 'Water level indicator', unit: 'nos', quantity: 1, rate: 12000, type: 'SUBCONTRACTOR' },
          { itemCode: 'WT-PP-007', description: 'MS access ladder (galvanized)', unit: 'nos', quantity: 1, rate: 18000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '6. Lightning Protection & Testing',
        items: [
          { itemCode: 'WT-LP-001', description: 'Lightning arrester', unit: 'nos', quantity: 1, rate: 12000, type: 'MATERIAL', resourceName: 'Solar Lightning Arrester' },
          { itemCode: 'WT-LP-002', description: 'Copper earthing', unit: 'nos', quantity: 2, rate: 8500, type: 'SUBCONTRACTOR', rateAnalysisName: 'Earth Pit Installation' },
          { itemCode: 'WT-LP-003', description: 'GI earthing strip', unit: 'metre', quantity: 30, rate: 65, type: 'MATERIAL', resourceName: 'GI Earthing Strip 25x4mm' },
          { itemCode: 'WT-LP-004', description: 'Hydrostatic test & commissioning', unit: 'ls', quantity: 1, rate: 25000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
  {
    id: 'swimming-pool',
    name: 'Swimming Pool (Olympic, 25m x 12.5m)',
    description: 'RCC swimming pool with filtration system, underwater lights, tiling, deck',
    category: 'Utilities',
    sections: [
      {
        name: '1. Excavation & Earthwork',
        items: [
          { itemCode: 'SP-P-001', description: 'Pool excavation', unit: 'cum', quantity: 850, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'SP-P-002', description: 'JCB for excavation', unit: 'day', quantity: 6, rate: 12000, type: 'EQUIPMENT', resourceName: 'JCB Excavator 3DX' },
          { itemCode: 'SP-P-003', description: 'Dewatering', unit: 'day', quantity: 8, rate: 800, type: 'EQUIPMENT', resourceName: 'Dewatering Pump 5HP' },
        ],
      },
      {
        name: '2. RCC Pool Shell',
        items: [
          { itemCode: 'SP-RCC-001', description: 'PCC M15 (75mm) base', unit: 'cum', quantity: 28, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'SP-RCC-002', description: 'RCC M30 pool walls (250mm)', unit: 'cum', quantity: 85, rate: 11000, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'SP-RCC-003', description: 'RCC M30 pool floor (200mm)', unit: 'cum', quantity: 75, rate: 11000, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'SP-RCC-004', description: 'Pool reinforcement (8mm mesh)', unit: 'kg', quantity: 14000, rate: 75, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 8mm' },
          { itemCode: 'SP-RCC-005', description: 'OPC cement for pool', unit: 'bag', quantity: 1450, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'SP-RCC-006', description: 'Superplasticizer (PCE)', unit: 'litre', quantity: 200, rate: 135, type: 'MATERIAL', resourceName: 'Superplasticizer (PCE Based)' },
        ],
      },
      {
        name: '3. Waterproofing',
        items: [
          { itemCode: 'SP-WP-001', description: 'Crystalline waterproofing (internal)', unit: 'sqm', quantity: 435, rate: 320, type: 'MATERIAL', resourceName: 'Crystalline Waterproofing' },
          { itemCode: 'SP-WP-002', description: 'Epoxy coating (2 coats)', unit: 'sqm', quantity: 435, rate: 850, type: 'MATERIAL', rateAnalysisName: 'Swimming Pool Waterproofing' },
          { itemCode: 'SP-WP-003', description: 'PVC waterstop at construction joints', unit: 'rmt', quantity: 75, rate: 280, type: 'MATERIAL', resourceName: 'PVC Waterstop 230mm' },
        ],
      },
      {
        name: '4. Pool Tiling',
        items: [
          { itemCode: 'SP-TL-001', description: 'Glass mosaic tile (pool interior)', unit: 'sqft', quantity: 4200, rate: 85, type: 'MATERIAL', resourceName: 'Glass Mosaic Tile' },
          { itemCode: 'SP-TL-002', description: 'Tile adhesive (waterproof)', unit: 'bag', quantity: 120, rate: 420, type: 'MATERIAL', resourceName: 'Tile Adhesive (Premium)' },
          { itemCode: 'SP-TL-003', description: 'Epoxy tile grout', unit: 'kg', quantity: 150, rate: 450, type: 'MATERIAL', resourceName: 'Epoxy Tile Grout (Pool Grade)' },
        ],
      },
      {
        name: '5. Filtration & Circulation',
        items: [
          { itemCode: 'SP-FR-001', description: 'Pool sand filter 24 inch (2 nos)', unit: 'nos', quantity: 2, rate: 18000, type: 'MATERIAL', resourceName: 'Pool Sand Filter 24 inch' },
          { itemCode: 'SP-FR-002', description: 'Pool pump 1.5HP (2 nos)', unit: 'nos', quantity: 2, rate: 12000, type: 'MATERIAL', resourceName: 'Pool Pump 1.5HP' },
          { itemCode: 'SP-FR-003', description: 'Pool skimmer SS (4 nos)', unit: 'nos', quantity: 4, rate: 8500, type: 'MATERIAL', resourceName: 'Pool Skimmer (In-Ground) SS' },
          { itemCode: 'SP-FR-004', description: 'Pool main drain SS', unit: 'nos', quantity: 4, rate: 3500, type: 'MATERIAL', resourceName: 'Pool Main Drain (SS)' },
          { itemCode: 'SP-FR-005', description: 'Pool return inlets SS (8 nos)', unit: 'nos', quantity: 8, rate: 1200, type: 'MATERIAL', resourceName: 'Pool Return Inlet (SS)' },
          { itemCode: 'SP-FR-006', description: 'Pool chlorinator (salt water)', unit: 'nos', quantity: 1, rate: 28000, type: 'MATERIAL', resourceName: 'Pool Chlorinator (Salt Water Cell)' },
          { itemCode: 'SP-FR-007', description: 'CPVC piping for circulation', unit: 'metre', quantity: 180, rate: 220, type: 'MATERIAL', resourceName: 'CPVC Pipe 50mm SDR 11' },
        ],
      },
      {
        name: '6. Lighting & Accessories',
        items: [
          { itemCode: 'SP-LT-001', description: 'Underwater LED light RGB 12V (8 nos)', unit: 'nos', quantity: 8, rate: 6500, type: 'MATERIAL', resourceName: 'Pool Underwater Light (LED) 12V RGB' },
          { itemCode: 'SP-LT-002', description: 'SS pool ladder 316 (2 nos)', unit: 'nos', quantity: 2, rate: 12000, type: 'MATERIAL', resourceName: 'Pool Ladder (SS 316) 4 Step' },
          { itemCode: 'SP-LT-003', description: 'Starting blocks (competitive)', unit: 'nos', quantity: 8, rate: 18000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '7. Pool Deck',
        items: [
          { itemCode: 'SP-DK-001', description: 'RCC deck slab (surround)', unit: 'cum', quantity: 35, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'RCC Deck Slab M35' },
          { itemCode: 'SP-DK-002', description: 'Anti-skid deck tile 300x300', unit: 'sqft', quantity: 1800, rate: 42, type: 'MATERIAL', resourceName: 'Anti-skid Tile 300x300' },
          { itemCode: 'SP-DK-003', description: 'Deck drainage channel', unit: 'rmt', quantity: 50, rate: 850, type: 'MATERIAL', resourceName: 'Deck Drainage Channel (SS)' },
        ],
      },
    ],
  },
  {
    id: 'stp-100kld',
    name: 'Sewage Treatment Plant (100 KLD, MBBR)',
    description: 'Modular STP with MBBR technology - tanks, media, pumps, blowers, control system',
    category: 'Utilities',
    sections: [
      {
        name: '1. Civil Works - Tanks',
        items: [
          { itemCode: 'ST-P-001', description: 'Excavation for STP tanks', unit: 'cum', quantity: 280, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'ST-P-002', description: 'PCC M15 base (150mm)', unit: 'cum', quantity: 22, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'ST-P-003', description: 'RCC M30 tank walls (200mm)', unit: 'cum', quantity: 85, rate: 11000, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'ST-P-004', description: 'RCC M30 tank base slab', unit: 'cum', quantity: 38, rate: 9500, type: 'MATERIAL', rateAnalysisName: 'RCC M30 (Columns, Beams & Slabs)' },
          { itemCode: 'ST-P-005', description: 'Tank reinforcement', unit: 'kg', quantity: 14000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 12mm' },
          { itemCode: 'ST-P-006', description: 'PVC waterstop at joints', unit: 'rmt', quantity: 85, rate: 280, type: 'MATERIAL', resourceName: 'PVC Waterstop 230mm' },
        ],
      },
      {
        name: '2. Waterproofing',
        items: [
          { itemCode: 'ST-WP-001', description: 'Crystalline waterproofing (tank internal)', unit: 'sqm', quantity: 380, rate: 320, type: 'MATERIAL', resourceName: 'Crystalline Waterproofing' },
          { itemCode: 'ST-WP-002', description: 'Epoxy coating (effluent resistant)', unit: 'sqm', quantity: 380, rate: 850, type: 'MATERIAL', resourceName: 'Epoxy Paint (Industrial)' },
        ],
      },
      {
        name: '3. MBBR Media & Treatment',
        items: [
          { itemCode: 'ST-MB-001', description: 'MBBR media HDPE', unit: 'cum', quantity: 12, rate: 45000, type: 'MATERIAL', resourceName: 'MBBR Media (HDPE)' },
          { itemCode: 'ST-MB-002', description: 'Diffused aeration membrane discs', unit: 'nos', quantity: 24, rate: 1800, type: 'MATERIAL', resourceName: 'Diffused Aeration Membrane Disc' },
        ],
      },
      {
        name: '4. Mechanical Equipment',
        items: [
          { itemCode: 'ST-EQ-001', description: 'Raw sewage pump 3HP (2 nos)', unit: 'nos', quantity: 2, rate: 45000, type: 'SUBCONTRACTOR' },
          { itemCode: 'ST-EQ-002', description: 'Recirculation pump 2HP', unit: 'nos', quantity: 2, rate: 32000, type: 'SUBCONTRACTOR' },
          { itemCode: 'ST-EQ-003', description: 'Air blower 5HP (2 nos)', unit: 'nos', quantity: 2, rate: 85000, type: 'SUBCONTRACTOR' },
          { itemCode: 'ST-EQ-004', description: 'Sludge recirculation pump', unit: 'nos', quantity: 1, rate: 45000, type: 'SUBCONTRACTOR' },
          { itemCode: 'ST-EQ-005', description: 'Dosing pump (diaphragm)', unit: 'nos', quantity: 2, rate: 12000, type: 'MATERIAL', resourceName: 'Dosing Pump (Diaphragm)' },
        ],
      },
      {
        name: '5. Piping & Valves',
        items: [
          { itemCode: 'ST-PV-001', description: 'HDPE pipe 110mm (raw sewage)', unit: 'metre', quantity: 85, rate: 320, type: 'MATERIAL', resourceName: 'HDPE Pipe 110mm PN 6' },
          { itemCode: 'ST-PV-002', description: 'GI pipe 65mm (air distribution)', unit: 'metre', quantity: 120, rate: 380, type: 'MATERIAL', resourceName: 'GI Pipe 65mm (Class B)' },
          { itemCode: 'ST-PV-003', description: 'Sluice valve 80mm', unit: 'nos', quantity: 6, rate: 3200, type: 'MATERIAL', resourceName: 'Sluice Valve 80mm (CI)' },
          { itemCode: 'ST-PV-004', description: 'Non-return valve 80mm', unit: 'nos', quantity: 4, rate: 2800, type: 'MATERIAL', resourceName: 'Non-Return Valve (CI) 80mm' },
        ],
      },
      {
        name: '6. Electrical & Control',
        items: [
          { itemCode: 'ST-EL-001', description: 'MCC panel (PLC based)', unit: 'nos', quantity: 1, rate: 280000, type: 'SUBCONTRACTOR' },
          { itemCode: 'ST-EL-002', description: 'Flow meter (digital)', unit: 'nos', quantity: 2, rate: 8500, type: 'MATERIAL', resourceName: 'Flow Meter (Digital)' },
          { itemCode: 'ST-EL-003', description: 'DO/pH analyzers', unit: 'set', quantity: 1, rate: 180000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
  {
    id: 'solar-rooftop-100kw',
    name: 'Solar Power Plant (Rooftop, 100 kW)',
    description: 'Grid-tied rooftop solar plant with panels, inverters, mounting, cabling, commissioning',
    category: 'Utilities',
    sections: [
      {
        name: '1. Solar Panels',
        items: [
          { itemCode: 'SO-PV-001', description: 'Solar panel 540W mono PERC', unit: 'nos', quantity: 185, rate: 14000, type: 'MATERIAL', resourceName: 'Solar Panel 540W Mono PERC' },
          { itemCode: 'SO-PV-002', description: 'Panel transport & handling', unit: 'ls', quantity: 1, rate: 85000, type: 'MISC' },
        ],
      },
      {
        name: '2. Mounting Structure',
        items: [
          { itemCode: 'SO-MS-001', description: 'GI mounting structure (hot-dipped)', unit: 'ton', quantity: 6.5, rate: 120000, type: 'MATERIAL', resourceName: 'Solar Panel Mounting Structure (GI)' },
          { itemCode: 'SO-MS-002', description: 'Roof penetration sealing kits', unit: 'nos', quantity: 250, rate: 180, type: 'MATERIAL', resourceName: 'Roof Penetration Sealing Kit' },
          { itemCode: 'SO-MS-003', description: 'Anchor bolts M12 (chemical)', unit: 'nos', quantity: 500, rate: 22, type: 'MATERIAL', resourceName: 'Anchor Bolt M12 x 100mm (Chemical)' },
        ],
      },
      {
        name: '3. Inverters',
        items: [
          { itemCode: 'SO-IV-001', description: 'Solar inverter 50KVA (2 nos)', unit: 'nos', quantity: 2, rate: 450000, type: 'MATERIAL', resourceName: 'Solar Inverter 10KVA' },
          { itemCode: 'SO-IV-002', description: 'AC distribution box', unit: 'nos', quantity: 2, rate: 45000, type: 'MATERIAL', resourceName: 'AC Distribution Box (Surface) IP54' },
          { itemCode: 'SO-IV-003', description: 'DC distribution box', unit: 'nos', quantity: 2, rate: 35000, type: 'MATERIAL', resourceName: 'DC Distribution Box (Surface) IP54' },
        ],
      },
      {
        name: '4. Cabling',
        items: [
          { itemCode: 'SO-CB-001', description: 'Solar DC cable 6 sqmm', unit: 'metre', quantity: 2500, rate: 120, type: 'MATERIAL', resourceName: 'Solar DC Cable 6 sqmm' },
          { itemCode: 'SO-CB-002', description: 'AC cable 4 core 25 sqmm Al', unit: 'metre', quantity: 180, rate: 380, type: 'MATERIAL', resourceName: 'Aluminium Cable 4 Core 25 sqmm Armoured' },
          { itemCode: 'SO-CB-003', description: 'MC4 connectors', unit: 'pair', quantity: 185, rate: 85, type: 'MATERIAL', resourceName: 'MC4 Connector Pair' },
          { itemCode: 'SO-CB-004', description: 'Solar combiner box (4 string)', unit: 'nos', quantity: 12, rate: 3500, type: 'MATERIAL', resourceName: 'Solar Combiner Box (4 String)' },
        ],
      },
      {
        name: '5. Earthing & Protection',
        items: [
          { itemCode: 'SO-ER-001', description: 'Solar earthing kit', unit: 'set', quantity: 3, rate: 4500, type: 'MATERIAL', resourceName: 'Solar Earthing Kit' },
          { itemCode: 'SO-ER-002', description: 'Lightning arrester', unit: 'nos', quantity: 4, rate: 1800, type: 'MATERIAL', resourceName: 'Solar Lightning Arrester' },
          { itemCode: 'SO-ER-003', description: 'GI earthing strip 25x4mm', unit: 'metre', quantity: 250, rate: 65, type: 'MATERIAL', resourceName: 'GI Earthing Strip 25x4mm' },
        ],
      },
      {
        name: '6. Metering & Commissioning',
        items: [
          { itemCode: 'SO-CM-001', description: 'Net metering device', unit: 'nos', quantity: 1, rate: 6500, type: 'MATERIAL', resourceName: 'Net Metering Device' },
          { itemCode: 'SO-CM-002', description: 'SCADA monitoring system', unit: 'ls', quantity: 1, rate: 180000, type: 'SUBCONTRACTOR' },
          { itemCode: 'SO-CM-003', description: 'Testing & commissioning', unit: 'ls', quantity: 1, rate: 120000, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
];