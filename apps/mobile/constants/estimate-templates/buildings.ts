/**
 * Building Estimate Templates - Residential, Commercial, Industrial, Institutional
 * Each template contains granular line items linked to catalog resources and rate analyses.
 */
import type { EstimateTemplate } from './types';

export const BUILDING_TEMPLATES: EstimateTemplate[] = [
  // ════════════════════════════════════════════════════════════════
  // 1. INDIVIDUAL RESIDENTIAL HOUSE (Single Storey, 1000 sqft)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'residential-house-1storey',
    name: 'Individual House (Single Storey, 1000 sqft)',
    description: 'Complete single-storey residential house with foundation, walls, roof, finishes, MEP',
    category: 'Buildings',
    sections: [
      {
        name: '1. Site Preparation & Foundation',
        items: [
          { itemCode: 'HS-P-001', description: 'Site clearing & leveling', unit: 'sqm', quantity: 120, rate: 35, type: 'LABOUR' },
          { itemCode: 'HS-P-002', description: 'Excavation for foundation (ordinary soil)', unit: 'cum', quantity: 45, rate: 320, type: 'LABOUR' },
          { itemCode: 'HS-P-003', description: 'PCC M10 (1:3:6) 100mm base', unit: 'cum', quantity: 5, rate: 4500, type: 'MATERIAL', rateAnalysisName: 'PCC M10 (1:3:6)' },
          { itemCode: 'HS-P-004', description: 'RCC M20 footing', unit: 'cum', quantity: 12, rate: 7500, type: 'MATERIAL', rateAnalysisName: 'RCC M20 Slabs & Beams' },
          { itemCode: 'HS-P-005', description: 'TMT steel Fe500 for footing', unit: 'kg', quantity: 720, rate: 72, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 12mm' },
          { itemCode: 'HS-P-006', description: 'OPC cement 53 grade', unit: 'bag', quantity: 85, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'HS-P-007', description: 'River sand', unit: 'cum', quantity: 6, rate: 1800, type: 'MATERIAL', resourceName: 'River Sand (Fine)' },
          { itemCode: 'HS-P-008', description: '20mm aggregate', unit: 'cum', quantity: 6, rate: 1400, type: 'MATERIAL', resourceName: '20mm Aggregate' },
          { itemCode: 'HS-P-009', description: 'Plinth beam RCC M20', unit: 'cum', quantity: 8, rate: 7500, type: 'MATERIAL' },
          { itemCode: 'HS-P-010', description: 'Plinth beam reinforcement', unit: 'kg', quantity: 480, rate: 72, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 12mm' },
          { itemCode: 'HS-P-011', description: 'Termite treatment (foundation)', unit: 'sqm', quantity: 100, rate: 85, type: 'MATERIAL', rateAnalysisName: 'Anti-Termite Treatment (Pre-Construction)' },
        ],
      },
      {
        name: '2. Superstructure - Walls',
        items: [
          { itemCode: 'HS-W-001', description: 'Brick masonry 230mm (CM 1:6)', unit: 'cum', quantity: 65, rate: 5800, type: 'MATERIAL', rateAnalysisName: 'Brick Masonry 230mm CM 1:6' },
          { itemCode: 'HS-W-002', description: 'Red clay bricks Class A', unit: 'piece', quantity: 6500, rate: 9, type: 'MATERIAL', resourceName: 'Red Clay Brick Class A 230x115x75' },
          { itemCode: 'HS-W-003', description: 'OPC cement for masonry', unit: 'bag', quantity: 150, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'HS-W-004', description: 'River sand for masonry mortar', unit: 'cum', quantity: 9, rate: 1800, type: 'MATERIAL', resourceName: 'River Sand (Fine)' },
          { itemCode: 'HS-W-005', description: 'Lintel beam RCC M20 over openings', unit: 'cum', quantity: 3, rate: 7500, type: 'MATERIAL' },
          { itemCode: 'HS-W-006', description: 'Lintel reinforcement', unit: 'kg', quantity: 180, rate: 72, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 12mm' },
          { itemCode: 'HS-W-007', description: 'Mason (Grade 1)', unit: 'day', quantity: 35, rate: 750, type: 'LABOUR', resourceName: 'Mason Grade 1 (Mistri)' },
          { itemCode: 'HS-W-008', description: 'Unskilled labour', unit: 'day', quantity: 70, rate: 450, type: 'LABOUR', resourceName: 'Unskilled Labour (Male)' },
        ],
      },
      {
        name: '3. RCC Roof Slab',
        items: [
          { itemCode: 'HS-R-001', description: 'RCC M25 roof slab (125mm)', unit: 'cum', quantity: 12, rate: 8200, type: 'MATERIAL' },
          { itemCode: 'HS-R-002', description: 'Roof slab reinforcement (8mm + 10mm)', unit: 'kg', quantity: 1080, rate: 74, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 10mm' },
          { itemCode: 'HS-R-003', description: 'OPC cement for slab', unit: 'bag', quantity: 95, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'HS-R-004', description: 'Shuttering plywood 18mm', unit: 'sqft', quantity: 1100, rate: 62, type: 'MATERIAL', resourceName: 'Shuttering Plywood 18mm Waterproof' },
          { itemCode: 'HS-R-005', description: 'Centering plates', unit: 'nos', quantity: 40, rate: 450, type: 'MATERIAL', resourceName: 'Centering Plate 60x60cm' },
          { itemCode: 'HS-R-006', description: 'Adjustable props', unit: 'nos', quantity: 35, rate: 850, type: 'MATERIAL', resourceName: 'Adjustable Prop 3-5m' },
          { itemCode: 'HS-R-007', description: 'Concrete mixer hire', unit: 'day', quantity: 3, rate: 2500, type: 'EQUIPMENT', resourceName: 'Concrete Mixer 350L' },
          { itemCode: 'HS-R-008', description: 'Needle vibrator', unit: 'day', quantity: 3, rate: 700, type: 'EQUIPMENT', resourceName: 'Needle Vibrator 40mm' },
          { itemCode: 'HS-R-009', description: 'Cover blocks 25mm', unit: 'piece', quantity: 200, rate: 3, type: 'MATERIAL', resourceName: 'Cover Blocks (PVC) 25mm' },
          { itemCode: 'HS-R-010', description: 'Binding wire', unit: 'kg', quantity: 12, rate: 68, type: 'MATERIAL', resourceName: 'Binding Wire 18G' },
        ],
      },
      {
        name: '4. Roof Waterproofing & Terracing',
        items: [
          { itemCode: 'HS-WR-001', description: 'Brick bat coba waterproofing 125mm', unit: 'sqm', quantity: 95, rate: 650, type: 'MATERIAL', rateAnalysisName: 'Terrace Waterproofing (Brick Bat Coba)' },
          { itemCode: 'HS-WR-002', description: 'Terrace tiles (kota stone 25mm)', unit: 'sqm', quantity: 95, rate: 850, type: 'MATERIAL', resourceName: 'Kota Stone 25mm' },
          { itemCode: 'HS-WR-003', description: 'Integral waterproofing compound', unit: 'litre', quantity: 25, rate: 140, type: 'MATERIAL', resourceName: 'Integral Waterproofing Liquid' },
        ],
      },
      {
        name: '5. Flooring & Tiling',
        items: [
          { itemCode: 'HS-FL-001', description: 'Vitrified tile 600x600 (living areas)', unit: 'sqft', quantity: 850, rate: 55, type: 'MATERIAL', resourceName: 'Vitrified Tile 600x600 Polished' },
          { itemCode: 'HS-FL-002', description: 'Anti-skid tiles 300x300 (bathrooms)', unit: 'sqft', quantity: 150, rate: 42, type: 'MATERIAL', resourceName: 'Anti-skid Tile 300x300' },
          { itemCode: 'HS-FL-003', description: 'Tile adhesive (premium)', unit: 'bag', quantity: 25, rate: 420, type: 'MATERIAL', resourceName: 'Tile Adhesive (Premium)' },
          { itemCode: 'HS-FL-004', description: 'Tile grout (white)', unit: 'kg', quantity: 15, rate: 85, type: 'MATERIAL', resourceName: 'Tile Grout (White)' },
          { itemCode: 'HS-FL-005', description: 'Tile spacer clips', unit: 'packet', quantity: 5, rate: 45, type: 'MATERIAL', resourceName: 'Tile Spacer (Cross) 3mm' },
          { itemCode: 'HS-FL-006', description: 'Tile / marble fixer', unit: 'day', quantity: 12, rate: 750, type: 'LABOUR', resourceName: 'Tile / Marble Fixer' },
        ],
      },
      {
        name: '6. Plastering & Painting',
        items: [
          { itemCode: 'HS-PT-001', description: 'Internal plaster 12mm (CM 1:4)', unit: 'sqm', quantity: 380, rate: 185, type: 'LABOUR', rateAnalysisName: 'Internal Plaster 12mm CM 1:4' },
          { itemCode: 'HS-PT-002', description: 'External plaster 18mm (waterproof)', unit: 'sqm', quantity: 180, rate: 220, type: 'LABOUR', rateAnalysisName: 'External Plaster 18mm (Waterproof)' },
          { itemCode: 'HS-PT-003', description: 'Wall putty (internal)', unit: 'bag', quantity: 15, rate: 580, type: 'MATERIAL', resourceName: 'Wall Putty (Cement Based)' },
          { itemCode: 'HS-PT-004', description: 'Primer (acrylic)', unit: 'litre', quantity: 15, rate: 220, type: 'MATERIAL', resourceName: 'Primer (Acrylic)' },
          { itemCode: 'HS-PT-005', description: 'Interior emulsion (premium) 2 coats', unit: 'litre', quantity: 35, rate: 380, type: 'MATERIAL', resourceName: 'Interior Emulsion (Premium)' },
          { itemCode: 'HS-PT-006', description: 'Exterior emulsion (premium) 2 coats', unit: 'litre', quantity: 18, rate: 420, type: 'MATERIAL', resourceName: 'Exterior Emulsion Paint (Premium)' },
          { itemCode: 'HS-PT-007', description: 'Painter (skilled)', unit: 'day', quantity: 15, rate: 700, type: 'LABOUR', resourceName: 'Painter (Skilled)' },
        ],
      },
      {
        name: '7. Doors & Windows',
        items: [
          { itemCode: 'HS-DW-001', description: 'Teak wood door frame 100x65mm', unit: 'rmt', quantity: 35, rate: 450, type: 'MATERIAL', resourceName: 'Teak Wood Door Frame 100x65mm' },
          { itemCode: 'HS-DW-002', description: 'Flush door shutter 35mm', unit: 'sqft', quantity: 180, rate: 180, type: 'MATERIAL', resourceName: 'Flush Door Shutter 35mm' },
          { itemCode: 'HS-DW-003', description: 'Mortice lock set', unit: 'set', quantity: 4, rate: 850, type: 'MATERIAL', resourceName: 'Mortice Lock Set (Godrej)' },
          { itemCode: 'HS-DW-004', description: 'SS hinges 100mm', unit: 'pair', quantity: 8, rate: 85, type: 'MATERIAL', resourceName: 'Stainless Steel Hinge 100mm (Pair)' },
          { itemCode: 'HS-DW-005', description: 'Door closer (hydraulic)', unit: 'nos', quantity: 3, rate: 650, type: 'MATERIAL', resourceName: 'Door Closer (Hydraulic)' },
          { itemCode: 'HS-DW-006', description: 'Aluminium sliding window section', unit: 'kg', quantity: 85, rate: 285, type: 'MATERIAL', resourceName: 'Aluminium Window Section' },
          { itemCode: 'HS-DW-007', description: 'Float glass 6mm clear', unit: 'sqft', quantity: 220, rate: 85, type: 'MATERIAL', resourceName: 'Float Glass 6mm Clear' },
          { itemCode: 'HS-DW-008', description: 'MS window grille (square bar)', unit: 'sqft', quantity: 180, rate: 85, type: 'MATERIAL', resourceName: 'Window Grille (MS Square Bar) per sqft' },
          { itemCode: 'HS-DW-009', description: 'Carpenter (skilled)', unit: 'day', quantity: 18, rate: 800, type: 'LABOUR', resourceName: 'Carpenter (Skilled)' },
        ],
      },
      {
        name: '8. Electrical Works',
        items: [
          { itemCode: 'HS-EL-001', description: 'PVC conduit 25mm (heavy)', unit: 'metre', quantity: 180, rate: 42, type: 'MATERIAL', resourceName: 'PVC Conduit Pipe 25mm Heavy' },
          { itemCode: 'HS-EL-002', description: 'Copper wire 2.5 sqmm FR (lighting)', unit: 'metre', quantity: 250, rate: 28, type: 'MATERIAL', resourceName: 'Copper Wire 2.5 sqmm FR' },
          { itemCode: 'HS-EL-003', description: 'Copper wire 4.0 sqmm FR (power)', unit: 'metre', quantity: 150, rate: 42, type: 'MATERIAL', resourceName: 'Copper Wire 4.0 sqmm FR' },
          { itemCode: 'HS-EL-004', description: 'Switch 6A modular', unit: 'piece', quantity: 25, rate: 35, type: 'MATERIAL', resourceName: 'Switch 6A Modular' },
          { itemCode: 'HS-EL-005', description: 'Socket 16A modular', unit: 'piece', quantity: 15, rate: 65, type: 'MATERIAL', resourceName: 'Socket 16A Modular' },
          { itemCode: 'HS-EL-006', description: 'Distribution board 8-way', unit: 'nos', quantity: 1, rate: 850, type: 'MATERIAL', resourceName: 'Distribution Board 8-Way Surface' },
          { itemCode: 'HS-EL-007', description: 'MCB 16A single pole', unit: 'nos', quantity: 6, rate: 185, type: 'MATERIAL', resourceName: 'MCB 16A Single Pole C-Curve' },
          { itemCode: 'HS-EL-008', description: 'RCCB 25A 30mA', unit: 'nos', quantity: 1, rate: 1200, type: 'MATERIAL', resourceName: 'RCCB 25A 30mA Double Pole' },
          { itemCode: 'HS-EL-009', description: 'Ceiling fan 48 inch', unit: 'nos', quantity: 4, rate: 1600, type: 'MATERIAL', resourceName: 'Ceiling Fan 48 inch' },
          { itemCode: 'HS-EL-010', description: 'LED tube light 20W', unit: 'nos', quantity: 12, rate: 280, type: 'MATERIAL', resourceName: 'LED Tube Light 20W' },
          { itemCode: 'HS-EL-011', description: 'Electrician', unit: 'day', quantity: 8, rate: 850, type: 'LABOUR', resourceName: 'Electrician' },
        ],
      },
      {
        name: '9. Plumbing & Sanitary',
        items: [
          { itemCode: 'HS-PL-001', description: 'CPVC pipe 25mm SDR 11', unit: 'metre', quantity: 60, rate: 95, type: 'MATERIAL', resourceName: 'CPVC Pipe 25mm SDR 11' },
          { itemCode: 'HS-PL-002', description: 'CPVC elbow 25mm', unit: 'piece', quantity: 25, rate: 18, type: 'MATERIAL', resourceName: 'CPVC Elbow 25mm' },
          { itemCode: 'HS-PL-003', description: 'CPVC tee 25mm', unit: 'piece', quantity: 12, rate: 22, type: 'MATERIAL', resourceName: 'CPVC Tee 25mm' },
          { itemCode: 'HS-PL-004', description: 'UPVC SWR pipe 110mm', unit: 'metre', quantity: 35, rate: 220, type: 'MATERIAL', resourceName: 'UPVC Pipe 110mm SWR' },
          { itemCode: 'HS-PL-005', description: 'Indian style WC (Orissa pan)', unit: 'nos', quantity: 2, rate: 2200, type: 'MATERIAL', resourceName: 'Indian Style WC (Orissa Pan)' },
          { itemCode: 'HS-PL-006', description: 'Wash basin (wall hung)', unit: 'nos', quantity: 2, rate: 1500, type: 'MATERIAL', resourceName: 'Wash Basin (Wall Hung)' },
          { itemCode: 'HS-PL-007', description: 'CP faucet (pillar cock)', unit: 'nos', quantity: 5, rate: 650, type: 'MATERIAL', resourceName: 'CP Brass Faucet (Pillar Cock)' },
          { itemCode: 'HS-PL-008', description: 'CP flush cistern', unit: 'nos', quantity: 2, rate: 1800, type: 'MATERIAL', resourceName: 'CP Flush Cistern (Half/Full)' },
          { itemCode: 'HS-PL-009', description: 'SS sink 24x18 inch', unit: 'nos', quantity: 1, rate: 2800, type: 'MATERIAL', resourceName: 'SS Sink 24x18 inch' },
          { itemCode: 'HS-PL-010', description: 'Sintex water tank 1000L', unit: 'nos', quantity: 1, rate: 8500, type: 'MATERIAL', resourceName: 'Sintex Water Tank 1000L (Triple Layer)' },
          { itemCode: 'HS-PL-011', description: 'Monoblock water pump 1HP', unit: 'nos', quantity: 1, rate: 8500, type: 'MATERIAL', resourceName: 'Monoblock Water Pump 1HP' },
          { itemCode: 'HS-PL-012', description: 'Plumber', unit: 'day', quantity: 10, rate: 850, type: 'LABOUR', resourceName: 'Plumber' },
        ],
      },
      {
        name: '10. Kitchen & Bathroom Finishes',
        items: [
          { itemCode: 'HS-KB-001', description: 'Kitchen platform granite 20mm', unit: 'sqft', quantity: 45, rate: 185, type: 'MATERIAL', resourceName: 'Granite Slab 20mm Polished' },
          { itemCode: 'HS-KB-002', description: 'Ceramic wall tile 300x600 (kitchen)', unit: 'sqft', quantity: 85, rate: 28, type: 'MATERIAL', resourceName: 'Ceramic Wall Tile 300x600' },
          { itemCode: 'HS-KB-003', description: 'Ceramic wall tile 250x375 (bathroom)', unit: 'sqft', quantity: 140, rate: 22, type: 'MATERIAL', resourceName: 'Ceramic Wall Tile 250x375' },
          { itemCode: 'HS-KB-004', description: 'Bathroom waterproofing (SBR)', unit: 'sqm', quantity: 35, rate: 450, type: 'MATERIAL', rateAnalysisName: 'Toilet Waterproofing (SBR + Tiles)' },
          { itemCode: 'HS-KB-005', description: 'P-trap 110mm UPVC', unit: 'nos', quantity: 3, rate: 180, type: 'MATERIAL', resourceName: 'P-Trap 110mm UPVC' },
          { itemCode: 'HS-KB-006', description: 'Floor trap 110mm UPVC', unit: 'nos', quantity: 3, rate: 150, type: 'MATERIAL', resourceName: 'Floor Trap 110mm UPVC' },
        ],
      },
      {
        name: '11. External Development',
        items: [
          { itemCode: 'HS-EX-001', description: 'Compound wall (brick 230mm)', unit: 'sqm', quantity: 45, rate: 1800, type: 'MATERIAL' },
          { itemCode: 'HS-EX-002', description: 'Compound wall foundation', unit: 'cum', quantity: 8, rate: 4500, type: 'MATERIAL' },
          { itemCode: 'HS-EX-003', description: 'MS gate 3.5x1.5m', unit: 'nos', quantity: 1, rate: 25000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HS-EX-004', description: 'Precast septic tank 2000L', unit: 'nos', quantity: 1, rate: 28000, type: 'MATERIAL', resourceName: 'Precast Septic Tank 2000L' },
          { itemCode: 'HS-EX-005', description: 'RCC sump pit 5000L', unit: 'nos', quantity: 1, rate: 18000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HS-EX-006', description: 'Paver block pathway', unit: 'sqm', quantity: 25, rate: 650, type: 'MATERIAL', resourceName: 'Interlocking Paver Block 60mm' },
          { itemCode: 'HS-EX-007', description: 'Rainwater harvesting pit', unit: 'nos', quantity: 1, rate: 15000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '12. Miscellaneous',
        items: [
          { itemCode: 'HS-M-001', description: 'Water for construction', unit: 'kL', quantity: 35, rate: 120, type: 'MATERIAL', resourceName: 'Water (Tanker Supply)' },
          { itemCode: 'HS-M-002', description: 'Diesel for mixer/pump', unit: 'litre', quantity: 85, rate: 88, type: 'MATERIAL', resourceName: 'Diesel (HSD)' },
          { itemCode: 'HS-M-003', description: 'Scaffolding hire', unit: 'month', quantity: 2, rate: 12000, type: 'EQUIPMENT' },
          { itemCode: 'HS-M-004', description: 'Safety equipment', unit: 'ls', quantity: 1, rate: 15000, type: 'MISC' },
          { itemCode: 'HS-M-005', description: 'Site cleanup', unit: 'ls', quantity: 1, rate: 12000, type: 'MISC' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 2. HIGH-RISE RESIDENTIAL (G+15)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'residential-highrise-g15',
    name: 'High-Rise Residential Tower (G+15)',
    description: '15-storey residential tower with basement parking, podium, lift cores, fire safety, STP/WTP',
    category: 'Buildings',
    sections: [
      {
        name: '1. Foundation (Piling + Raft)',
        items: [
          { itemCode: 'HR-P-001', description: 'Bored cast-in-situ pile 900mm dia x 25m', unit: 'rmt', quantity: 1500, rate: 6500, type: 'MATERIAL' },
          { itemCode: 'HR-P-002', description: 'Rotary piling rig 35T', unit: 'day', quantity: 120, rate: 145000, type: 'EQUIPMENT', resourceName: 'Rotary Piling Rig 35T (Bored)' },
          { itemCode: 'HR-P-003', description: 'Pile reinforcement (TMT Fe500)', unit: 'kg', quantity: 90000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'HR-P-004', description: 'Pile concrete M30 (tremie)', unit: 'cum', quantity: 950, rate: 8500, type: 'MATERIAL' },
          { itemCode: 'HR-P-005', description: 'Bentonite clay (piling grade)', unit: 'ton', quantity: 45, rate: 16000, type: 'MATERIAL', resourceName: 'Bentonite Clay Powder (Piling Grade) Bulk' },
          { itemCode: 'HR-P-006', description: 'Pile cap RCC M35 (3m thick raft)', unit: 'cum', quantity: 850, rate: 11000, type: 'MATERIAL' },
          { itemCode: 'HR-P-007', description: 'Raft reinforcement (25mm + 32mm)', unit: 'kg', quantity: 140000, rate: 74, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 25mm' },
          { itemCode: 'HR-P-008', description: 'Superplasticizer (PCE)', unit: 'litre', quantity: 2500, rate: 135, type: 'MATERIAL', resourceName: 'Superplasticizer (PCE Based)' },
        ],
      },
      {
        name: '2. Basement (2 levels)',
        items: [
          { itemCode: 'HR-BM-001', description: 'Basement excavation (rock)', unit: 'cum', quantity: 18000, rate: 650, type: 'MATERIAL', rateAnalysisName: 'Excavation in Hard Rock (Chiselling)' },
          { itemCode: 'HR-BM-002', description: 'Excavator 20T for basement', unit: 'day', quantity: 150, rate: 28000, type: 'EQUIPMENT', resourceName: 'Excavator 20T (PC200)' },
          { itemCode: 'HR-BM-003', description: 'Diaphragm wall RCC M40 (600mm)', unit: 'cum', quantity: 1200, rate: 15000, type: 'MATERIAL' },
          { itemCode: 'HR-BM-004', description: 'Diaphragm wall reinforcement', unit: 'kg', quantity: 180000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 20mm' },
          { itemCode: 'HR-BM-005', description: 'Basement waterproofing (membrane)', unit: 'sqm', quantity: 4500, rate: 650, type: 'MATERIAL', rateAnalysisName: 'Self-Adhesive Membrane Waterproofing' },
          { itemCode: 'HR-BM-006', description: 'Dewatering (24/7 pumps)', unit: 'month', quantity: 8, rate: 180000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '3. Superstructure (RCC Frame)',
        items: [
          { itemCode: 'HR-SS-001', description: 'RCC M40 columns (shear walls)', unit: 'cum', quantity: 1800, rate: 12500, type: 'MATERIAL' },
          { itemCode: 'HR-SS-002', description: 'RCC M35 beams', unit: 'cum', quantity: 2400, rate: 12000, type: 'MATERIAL' },
          { itemCode: 'HR-SS-003', description: 'Post-tensioned slab RCC M40', unit: 'cum', quantity: 3200, rate: 13500, type: 'MATERIAL' },
          { itemCode: 'HR-SS-004', description: 'Reinforcement steel (all sizes)', unit: 'kg', quantity: 850000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'HR-SS-005', description: 'Prestressing strands 15.2mm', unit: 'kg', quantity: 65000, rate: 155, type: 'MATERIAL', resourceName: 'Prestressing Strand 15.2mm (7-Wire) 1860 MPa' },
          { itemCode: 'HR-SS-006', description: 'Concrete pump 42m boom', unit: 'day', quantity: 250, rate: 25000, type: 'EQUIPMENT', resourceName: 'Concrete Pump 42m Boom' },
          { itemCode: 'HR-SS-007', description: 'Tower crane 10T (2 nos)', unit: 'month', quantity: 18, rate: 900000, type: 'EQUIPMENT', resourceName: 'Tower Crane 10T' },
          { itemCode: 'HR-SS-008', description: 'Aluminium formwork (Mivan) hire', unit: 'sqm', quantity: 8500, rate: 1800, type: 'EQUIPMENT', resourceName: 'Aluminum Formwork Panel 600x2700mm (Mivan)' },
          { itemCode: 'HR-SS-009', description: 'Batching plant 60 cum/hr', unit: 'month', quantity: 18, rate: 750000, type: 'EQUIPMENT', resourceName: 'Batching Plant 60 cum/hr' },
        ],
      },
      {
        name: '4. Masonry (AAC Blocks)',
        items: [
          { itemCode: 'HR-MS-001', description: 'AAC block wall 200mm (external)', unit: 'sqm', quantity: 12000, rate: 950, type: 'MATERIAL', rateAnalysisName: 'AAC Block Masonry 200mm' },
          { itemCode: 'HR-MS-002', description: 'AAC block wall 100mm (internal)', unit: 'sqm', quantity: 8000, rate: 650, type: 'MATERIAL', rateAnalysisName: 'AAC Block Masonry 150mm' },
          { itemCode: 'HR-MS-003', description: 'AAC blocks 200mm', unit: 'piece', quantity: 102000, rate: 95, type: 'MATERIAL', resourceName: 'AAC Block 600x200x200mm' },
          { itemCode: 'HR-MS-004', description: 'Block fixing adhesive', unit: 'bag', quantity: 3000, rate: 380, type: 'MATERIAL', resourceName: 'Block Fixing Adhesive' },
        ],
      },
      {
        name: '5. Lifts & Vertical Transport',
        items: [
          { itemCode: 'HR-LV-001', description: 'Passenger elevator 13 person (6 nos)', unit: 'nos', quantity: 6, rate: 1200000, type: 'MATERIAL', resourceName: 'Passenger Elevator 13 Person (Supply+Install)' },
          { itemCode: 'HR-LV-002', description: 'Service elevator 1T (2 nos)', unit: 'nos', quantity: 2, rate: 1450000, type: 'MATERIAL', resourceName: 'Service Elevator 1T (Supply+Install)' },
          { itemCode: 'HR-LV-003', description: 'Glass capsule elevator (lobby)', unit: 'nos', quantity: 1, rate: 1850000, type: 'MATERIAL', resourceName: 'Glass Capsule Elevator (Panoramic)' },
        ],
      },
      {
        name: '6. MEP - Mechanical',
        items: [
          { itemCode: 'HR-MEP-001', description: 'HVAC VRV system (per floor)', unit: 'floor', quantity: 15, rate: 850000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-MEP-002', description: 'Fire sprinkler system', unit: 'sqm', quantity: 12000, rate: 850, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-MEP-003', description: 'Fire hydrant system', unit: 'floor', quantity: 15, rate: 180000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-MEP-004', description: 'Smoke detection system', unit: 'nos', quantity: 450, rate: 6500, type: 'MATERIAL', resourceName: 'Smoke Detector (Conventional)' },
          { itemCode: 'HR-MEP-005', description: 'STP (500 KLD)', unit: 'ls', quantity: 1, rate: 4500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-MEP-006', description: 'WTP (200 KLD)', unit: 'ls', quantity: 1, rate: 2500000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '7. Electrical & ELV',
        items: [
          { itemCode: 'HR-EL-001', description: 'HT power supply & transformer', unit: 'ls', quantity: 1, rate: 3500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-EL-002', description: 'LT distribution (risers, panels)', unit: 'floor', quantity: 15, rate: 250000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-EL-003', description: 'DG set 250 KVA (standby)', unit: 'nos', quantity: 2, rate: 3200000, type: 'EQUIPMENT', resourceName: 'DG Set 250 KVA' },
          { itemCode: 'HR-EL-004', description: 'Solar panels (rooftop 100kW)', unit: 'nos', quantity: 185, rate: 14000, type: 'MATERIAL', resourceName: 'Solar Panel 540W Mono PERC' },
          { itemCode: 'HR-EL-005', description: 'BMS & home automation', unit: 'ls', quantity: 1, rate: 2800000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-EL-006', description: 'CCTV (120 cameras)', unit: 'nos', quantity: 120, rate: 3500, type: 'MATERIAL', resourceName: 'CCTV Camera (Dome) 4MP' },
          { itemCode: 'HR-EL-007', description: 'Access control system', unit: 'nos', quantity: 30, rate: 4500, type: 'MATERIAL', resourceName: 'Access Control Card Reader (RFID)' },
        ],
      },
      {
        name: '8. Finishes (per typical floor)',
        items: [
          { itemCode: 'HR-FN-001', description: 'Vitrified tile flooring 600x600', unit: 'sqft', quantity: 15000, rate: 55, type: 'MATERIAL', resourceName: 'Vitrified Tile 600x600 Polished' },
          { itemCode: 'HR-FN-002', description: 'Gypsum plaster 12mm', unit: 'sqm', quantity: 22000, rate: 280, type: 'MATERIAL', rateAnalysisName: 'Gypsum Plaster 12mm' },
          { itemCode: 'HR-FN-003', description: 'Interior emulsion paint', unit: 'sqm', quantity: 25000, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Emulsion paint per sqm' },
          { itemCode: 'HR-FN-004', description: 'Exterior texture & emulsion', unit: 'sqm', quantity: 6500, rate: 450, type: 'MATERIAL', rateAnalysisName: 'Exterior Emulsion Painting (Premium)' },
          { itemCode: 'HR-FN-005', description: 'UPVC windows with DGU glass', unit: 'sqm', quantity: 3800, rate: 3500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-FN-006', description: 'Flush doors with frames', unit: 'nos', quantity: 450, rate: 12000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '9. Amenities & External',
        items: [
          { itemCode: 'HR-AM-001', description: 'Swimming pool (clubhouse)', unit: 'ls', quantity: 1, rate: 2500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-AM-002', description: 'Gym equipment', unit: 'ls', quantity: 1, rate: 1500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-AM-003', description: 'Landscaping (podium garden)', unit: 'sqm', quantity: 2500, rate: 1200, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-AM-004', description: 'Children play area', unit: 'ls', quantity: 1, rate: 850000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HR-AM-005', description: 'Basement epoxy flooring', unit: 'sqm', quantity: 4500, rate: 850, type: 'MATERIAL', rateAnalysisName: 'Epoxy Flooring 3mm' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 3. COMMERCIAL OFFICE BUILDING (G+4)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'commercial-office-g4',
    name: 'Commercial Office Building (G+4)',
    description: 'RCC framed office building with curtain wall glazing, HVAC, lifts, parking, fire safety',
    category: 'Buildings',
    sections: [
      {
        name: '1. Foundation',
        items: [
          { itemCode: 'CO-P-001', description: 'Excavation for foundation', unit: 'cum', quantity: 1800, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'CO-P-002', description: 'PCC M15 (100mm) base', unit: 'cum', quantity: 85, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'CO-P-003', description: 'RCC M30 footings & tie beams', unit: 'cum', quantity: 450, rate: 9500, type: 'MATERIAL' },
          { itemCode: 'CO-P-004', description: 'Reinforcement steel Fe500', unit: 'kg', quantity: 67500, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 20mm' },
        ],
      },
      {
        name: '2. Superstructure',
        items: [
          { itemCode: 'CO-SS-001', description: 'RCC M30 columns', unit: 'cum', quantity: 320, rate: 11000, type: 'MATERIAL' },
          { itemCode: 'CO-SS-002', description: 'RCC M30 beams', unit: 'cum', quantity: 480, rate: 10500, type: 'MATERIAL' },
          { itemCode: 'CO-SS-003', description: 'RCC M30 slab (125mm)', unit: 'cum', quantity: 380, rate: 9500, type: 'MATERIAL' },
          { itemCode: 'CO-SS-004', description: 'Reinforcement steel (all)', unit: 'kg', quantity: 142500, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'CO-SS-005', description: 'Concrete pump hire', unit: 'day', quantity: 45, rate: 25000, type: 'EQUIPMENT', resourceName: 'Concrete Pump 42m Boom' },
          { itemCode: 'CO-SS-006', description: 'Tower crane 5T', unit: 'month', quantity: 12, rate: 285000, type: 'EQUIPMENT', resourceName: 'Tower Crane 5T' },
          { itemCode: 'CO-SS-007', description: 'AAC block wall 200mm', unit: 'sqm', quantity: 3200, rate: 950, type: 'MATERIAL', rateAnalysisName: 'AAC Block Masonry 200mm' },
        ],
      },
      {
        name: '3. Envelope - Glazing & Cladding',
        items: [
          { itemCode: 'CO-EN-001', description: 'Curtain wall glazing (unitized)', unit: 'sqm', quantity: 2800, rate: 6500, type: 'SUBCONTRACTOR' },
          { itemCode: 'CO-EN-002', description: 'DGU glass 6-12-6 Low-E', unit: 'sqft', quantity: 22000, rate: 350, type: 'MATERIAL', resourceName: 'Insulated Glass Unit (DGU) 6-12-6 Low-E' },
          { itemCode: 'CO-EN-003', description: 'Aluminium sections for glazing', unit: 'kg', quantity: 18500, rate: 285, type: 'MATERIAL', resourceName: 'Aluminium Window Section' },
          { itemCode: 'CO-EN-004', description: 'ACP cladding (facade)', unit: 'sqm', quantity: 850, rate: 2200, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '4. Interiors & Finishes',
        items: [
          { itemCode: 'CO-IN-001', description: 'Gypsum board ceiling', unit: 'sqm', quantity: 3200, rate: 650, type: 'SUBCONTRACTOR' },
          { itemCode: 'CO-IN-002', description: 'Gypsum board partition 75mm', unit: 'sqm', quantity: 1800, rate: 850, type: 'MATERIAL', rateAnalysisName: 'Gypsum Board Partition 75mm' },
          { itemCode: 'CO-IN-003', description: 'Vitrified tile flooring', unit: 'sqft', quantity: 28000, rate: 55, type: 'MATERIAL', resourceName: 'Vitrified Tile 600x600 Polished' },
          { itemCode: 'CO-IN-004', description: 'Interior emulsion paint', unit: 'sqm', quantity: 12000, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Emulsion paint per sqm' },
          { itemCode: 'CO-IN-005', description: 'Modular workstations (250)', unit: 'nos', quantity: 250, rate: 8500, type: 'MATERIAL', resourceName: 'Modular Workstation Desk' },
        ],
      },
      {
        name: '5. HVAC',
        items: [
          { itemCode: 'CO-HV-001', description: 'VRV system (10 floors)', unit: 'floor', quantity: 5, rate: 1200000, type: 'SUBCONTRACTOR' },
          { itemCode: 'CO-HV-002', description: 'VRV outdoor unit 8HP', unit: 'nos', quantity: 20, rate: 185000, type: 'MATERIAL', resourceName: 'VRV System 8HP Outdoor Unit' },
          { itemCode: 'CO-HV-003', description: 'GI ducting 0.8mm', unit: 'sqm', quantity: 4200, rate: 850, type: 'MATERIAL', resourceName: 'GI Duct Sheet 0.8mm' },
          { itemCode: 'CO-HV-004', description: 'Fire dampers', unit: 'nos', quantity: 85, rate: 4500, type: 'MATERIAL', resourceName: 'Fire Damper 600x300' },
        ],
      },
      {
        name: '6. Lifts & Fire Safety',
        items: [
          { itemCode: 'CO-LF-001', description: 'Passenger elevator 13 person (3 nos)', unit: 'nos', quantity: 3, rate: 1200000, type: 'MATERIAL', resourceName: 'Passenger Elevator 13 Person (Supply+Install)' },
          { itemCode: 'CO-LF-002', description: 'Service elevator 2T', unit: 'nos', quantity: 1, rate: 1850000, type: 'MATERIAL', resourceName: 'Goods Elevator 2T (Supply+Install)' },
          { itemCode: 'CO-LF-003', description: 'Fire sprinkler system', unit: 'sqm', quantity: 3200, rate: 850, type: 'SUBCONTRACTOR' },
          { itemCode: 'CO-LF-004', description: 'Fire alarm panel (addressable)', unit: 'nos', quantity: 5, rate: 65000, type: 'MATERIAL' },
          { itemCode: 'CO-LF-005', description: 'Fire pump 15HP (diesel)', unit: 'nos', quantity: 2, rate: 85000, type: 'MATERIAL', resourceName: 'Fire Pump 15HP (Diesel)' },
        ],
      },
      {
        name: '7. Parking & External',
        items: [
          { itemCode: 'CO-PK-001', description: 'Basement epoxy flooring', unit: 'sqm', quantity: 1800, rate: 850, type: 'MATERIAL', rateAnalysisName: 'Epoxy Flooring 3mm' },
          { itemCode: 'CO-PK-002', description: 'Boom barrier (entry/exit)', unit: 'nos', quantity: 2, rate: 65000, type: 'MATERIAL', resourceName: 'Boom Barrier (Automatic) 4m' },
          { itemCode: 'CO-PK-003', description: 'EV charging stations', unit: 'nos', quantity: 8, rate: 35000, type: 'MATERIAL', resourceName: 'EV AC Charger 7.4kW (Type 2)' },
          { itemCode: 'CO-PK-004', description: 'DG set 250 KVA', unit: 'nos', quantity: 1, rate: 3200000, type: 'EQUIPMENT', resourceName: 'DG Set 250 KVA' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 4. INDUSTRIAL WAREHOUSE / FACTORY (PEB Structure)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'industrial-warehouse',
    name: 'Industrial Warehouse / Factory (5000 sqm)',
    description: 'Pre-engineered building with steel columns, trusses, insulated roofing, VDF flooring, loading docks',
    category: 'Buildings',
    sections: [
      {
        name: '1. Foundation',
        items: [
          { itemCode: 'WH-P-001', description: 'Excavation for pedestals', unit: 'cum', quantity: 280, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'WH-P-002', description: 'PCC M15 base', unit: 'cum', quantity: 35, rate: 5200, type: 'MATERIAL', rateAnalysisName: 'PCC M15 (1:2:4)' },
          { itemCode: 'WH-P-003', description: 'RCC M30 pedestal foundations', unit: 'cum', quantity: 180, rate: 9500, type: 'MATERIAL' },
          { itemCode: 'WH-P-004', description: 'Foundation bolts M20 (chemical)', unit: 'nos', quantity: 240, rate: 120, type: 'MATERIAL', resourceName: 'Anchor Bolt M20 x 200mm (Chemical)' },
          { itemCode: 'WH-P-005', description: 'Reinforcement steel', unit: 'kg', quantity: 27000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 20mm' },
        ],
      },
      {
        name: '2. PEB Steel Structure',
        items: [
          { itemCode: 'WH-ST-001', description: 'Built-up columns (welded section)', unit: 'ton', quantity: 85, rate: 95000, type: 'SUBCONTRACTOR' },
          { itemCode: 'WH-ST-002', description: 'Built-up rafters (tapered)', unit: 'ton', quantity: 120, rate: 95000, type: 'SUBCONTRACTOR' },
          { itemCode: 'WH-ST-003', description: 'MS plate 12mm for fabrication', unit: 'kg', quantity: 155000, rate: 79, type: 'MATERIAL', resourceName: 'MS Plate 12mm' },
          { itemCode: 'WH-ST-004', description: 'Z-purlins & eave struts', unit: 'ton', quantity: 28, rate: 85000, type: 'MATERIAL' },
          { itemCode: 'WH-ST-005', description: 'Bracing rods (MS round)', unit: 'kg', quantity: 8500, rate: 68, type: 'MATERIAL', resourceName: 'Mild Steel Round Bar 16mm' },
          { itemCode: 'WH-ST-006', description: 'Mobile crane 50T (erection)', unit: 'day', quantity: 25, rate: 35000, type: 'EQUIPMENT', resourceName: 'Mobile Crane 50T' },
          { itemCode: 'WH-ST-007', description: 'Welding rod E7018', unit: 'kg', quantity: 450, rate: 280, type: 'MATERIAL', resourceName: 'Welding Rod E7018 3.15mm' },
          { itemCode: 'WH-ST-008', description: 'Red oxide primer', unit: 'litre', quantity: 850, rate: 220, type: 'MATERIAL', resourceName: 'Red Oxide Primer' },
          { itemCode: 'WH-ST-009', description: 'Enamel paint (structural)', unit: 'litre', quantity: 1200, rate: 350, type: 'MATERIAL', resourceName: 'Enamel Paint (Oil Based)' },
        ],
      },
      {
        name: '3. Roofing & Wall Cladding',
        items: [
          { itemCode: 'WH-RF-001', description: 'Insulated PUF panel roof 50mm', unit: 'sqm', quantity: 5200, rate: 850, type: 'MATERIAL', resourceName: 'Insulated Panel (PUF) 50mm' },
          { itemCode: 'WH-RF-002', description: 'Colour coated wall cladding 0.50mm', unit: 'sqm', quantity: 3800, rate: 420, type: 'MATERIAL', resourceName: 'Colour Coated Roofing Sheet 0.50mm' },
          { itemCode: 'WH-RF-003', description: 'Roofing screws with EPDM washer', unit: 'nos', quantity: 12000, rate: 8, type: 'MATERIAL', resourceName: 'Roofing Screw with EPDM Washer' },
          { itemCode: 'WH-RF-004', description: 'Ridge cap GI', unit: 'rmt', quantity: 120, rate: 180, type: 'MATERIAL', resourceName: 'Ridge Cap GI' },
          { itemCode: 'WH-RF-005', description: 'Polycarbonate skylight (5%)', unit: 'sqm', quantity: 260, rate: 550, type: 'MATERIAL', resourceName: 'Sky-light Panel Polycarbonate' },
          { itemCode: 'WH-RF-006', description: 'Turbo ventilators', unit: 'nos', quantity: 30, rate: 1800, type: 'MATERIAL', resourceName: 'Turbo Ventilator' },
          { itemCode: 'WH-RF-007', description: 'GI gutter 300mm', unit: 'rmt', quantity: 250, rate: 450, type: 'MATERIAL' },
        ],
      },
      {
        name: '4. Industrial Flooring (VDF)',
        items: [
          { itemCode: 'WH-FL-001', description: 'VDF flooring 150mm M30', unit: 'sqm', quantity: 5000, rate: 1850, type: 'MATERIAL', rateAnalysisName: 'VDF Industrial Flooring 150mm' },
          { itemCode: 'WH-FL-002', description: 'OPC cement for flooring', unit: 'bag', quantity: 32500, rate: 420, type: 'MATERIAL', resourceName: 'OPC Cement 53 Grade' },
          { itemCode: 'WH-FL-003', description: 'Concrete densifier (lithium)', unit: 'litre', quantity: 1000, rate: 280, type: 'MATERIAL', resourceName: 'Concrete Densifier (Lithium)' },
          { itemCode: 'WH-FL-004', description: 'Laser screed machine', unit: 'day', quantity: 12, rate: 25000, type: 'EQUIPMENT', resourceName: 'Laser Screed Machine' },
        ],
      },
      {
        name: '5. Loading Docks',
        items: [
          { itemCode: 'WH-LD-001', description: 'Hydraulic dock leveler', unit: 'nos', quantity: 8, rate: 85000, type: 'MATERIAL', resourceName: 'Loading Dock Leveler (Hydraulic)' },
          { itemCode: 'WH-LD-002', description: 'Dock bumper (rubber)', unit: 'nos', quantity: 16, rate: 850, type: 'MATERIAL', resourceName: 'Loading Dock Bumper (Rubber)' },
          { itemCode: 'WH-LD-003', description: 'Industrial rolling shutter motorized', unit: 'nos', quantity: 8, rate: 85000, type: 'MATERIAL' },
        ],
      },
      {
        name: '6. EOT Crane Rails',
        items: [
          { itemCode: 'WH-CR-001', description: 'EOT crane rail 25kg/m', unit: 'rmt', quantity: 200, rate: 2800, type: 'MATERIAL', resourceName: 'EOT Crane Rail 25kg/m' },
          { itemCode: 'WH-CR-002', description: 'Crane rail clamps', unit: 'nos', quantity: 150, rate: 850, type: 'MATERIAL' },
        ],
      },
      {
        name: '7. Electrical & Fire Safety',
        items: [
          { itemCode: 'WH-EL-001', description: 'LED highbay lighting 200W', unit: 'nos', quantity: 80, rate: 8500, type: 'MATERIAL', resourceName: 'LED Flood Light 100W' },
          { itemCode: 'WH-EL-002', description: 'Fire sprinkler system', unit: 'sqm', quantity: 5000, rate: 850, type: 'SUBCONTRACTOR' },
          { itemCode: 'WH-EL-003', description: 'Fire hydrant system', unit: 'ls', quantity: 1, rate: 1500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'WH-EL-004', description: 'DG set 125 KVA', unit: 'nos', quantity: 1, rate: 1800000, type: 'EQUIPMENT', resourceName: 'DG Set 125 KVA' },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // 5. HOSPITAL BUILDING
  // ════════════════════════════════════════════════════════════════
  {
    id: 'hospital-building',
    name: 'Hospital Building (100-bed, G+3)',
    description: 'Multi-specialty hospital with OT, ICU, labs, pharmacy, medical gas pipeline, HVAC, sterilization',
    category: 'Buildings',
    sections: [
      {
        name: '1. Foundation & Structure',
        items: [
          { itemCode: 'HP-P-001', description: 'Excavation & earthwork', unit: 'cum', quantity: 3500, rate: 320, type: 'MATERIAL', rateAnalysisName: 'Excavation in Ordinary Soil' },
          { itemCode: 'HP-P-002', description: 'RCC M35 footings', unit: 'cum', quantity: 650, rate: 12000, type: 'MATERIAL' },
          { itemCode: 'HP-P-003', description: 'RCC M35 columns', unit: 'cum', quantity: 450, rate: 12500, type: 'MATERIAL' },
          { itemCode: 'HP-P-004', description: 'RCC M35 beams & slabs', unit: 'cum', quantity: 1200, rate: 12000, type: 'MATERIAL' },
          { itemCode: 'HP-P-005', description: 'Reinforcement steel Fe500', unit: 'kg', quantity: 285000, rate: 73, type: 'MATERIAL', resourceName: 'TMT Steel Fe500 16mm' },
          { itemCode: 'HP-P-006', description: 'AAC block walls', unit: 'sqm', quantity: 8500, rate: 950, type: 'MATERIAL', rateAnalysisName: 'AAC Block Masonry 200mm' },
        ],
      },
      {
        name: '2. Operation Theatre (OT)',
        items: [
          { itemCode: 'HP-OT-001', description: 'Modular OT panels (SS 304)', unit: 'sqm', quantity: 850, rate: 8500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-OT-002', description: 'OT seamless flooring (PU)', unit: 'sqm', quantity: 280, rate: 3500, type: 'MATERIAL', resourceName: 'PU Flooring 3mm' },
          { itemCode: 'HP-OT-003', description: 'OT HVAC (laminar flow)', unit: 'ls', quantity: 4, rate: 2500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-OT-004', description: 'HEPA filters', unit: 'nos', quantity: 24, rate: 45000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-OT-005', description: 'OT lighting (shadowless)', unit: 'nos', quantity: 4, rate: 850000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-OT-006', description: 'Stainless steel sheet 304', unit: 'sqm', quantity: 1200, rate: 850, type: 'MATERIAL', resourceName: 'Stainless Steel Sheet 304 1mm' },
        ],
      },
      {
        name: '3. Medical Gas Pipeline',
        items: [
          { itemCode: 'HP-MG-001', description: 'Oxygen pipeline (copper)', unit: 'rmt', quantity: 2800, rate: 450, type: 'MATERIAL' },
          { itemCode: 'HP-MG-002', description: 'Medical gas outlets (bedhead)', unit: 'nos', quantity: 300, rate: 8500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-MG-003', description: 'Vacuum pipeline', unit: 'rmt', quantity: 1800, rate: 380, type: 'MATERIAL' },
          { itemCode: 'HP-MG-004', description: 'Nitrous oxide pipeline', unit: 'rmt', quantity: 850, rate: 450, type: 'MATERIAL' },
          { itemCode: 'HP-MG-005', description: 'Manifold room setup', unit: 'ls', quantity: 1, rate: 1200000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '4. HVAC & Ventilation',
        items: [
          { itemCode: 'HP-HV-001', description: 'Chiller plant (200 TR)', unit: 'nos', quantity: 2, rate: 4500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-HV-002', description: 'AHUs (per floor)', unit: 'nos', quantity: 12, rate: 450000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-HV-003', description: 'GI ducting', unit: 'sqm', quantity: 8500, rate: 850, type: 'MATERIAL', resourceName: 'GI Duct Sheet 0.8mm' },
          { itemCode: 'HP-HV-004', description: 'Cooling tower 50 TR', unit: 'nos', quantity: 4, rate: 180000, type: 'MATERIAL', resourceName: 'Cooling Tower 50 TR' },
        ],
      },
      {
        name: '5. Electrical & BMS',
        items: [
          { itemCode: 'HP-EL-001', description: 'UPS system 200 KVA', unit: 'nos', quantity: 2, rate: 2500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-EL-002', description: 'DG set 250 KVA (standby)', unit: 'nos', quantity: 2, rate: 3200000, type: 'EQUIPMENT', resourceName: 'DG Set 250 KVA' },
          { itemCode: 'HP-EL-003', description: 'Nurse call system', unit: 'ls', quantity: 1, rate: 1800000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-EL-004', description: 'BMS & access control', unit: 'ls', quantity: 1, rate: 2200000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '6. Lifts',
        items: [
          { itemCode: 'HP-LV-001', description: 'Patient bed elevator (4 nos)', unit: 'nos', quantity: 4, rate: 1800000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-LV-002', description: 'Service elevator 2T (2 nos)', unit: 'nos', quantity: 2, rate: 1850000, type: 'MATERIAL', resourceName: 'Goods Elevator 2T (Supply+Install)' },
          { itemCode: 'HP-LV-003', description: 'Passenger elevator (2 nos)', unit: 'nos', quantity: 2, rate: 1200000, type: 'MATERIAL', resourceName: 'Passenger Elevator 13 Person (Supply+Install)' },
        ],
      },
      {
        name: '7. STP, WTP & Incinerator',
        items: [
          { itemCode: 'HP-ST-001', description: 'STP 200 KLD (biomedical)', unit: 'ls', quantity: 1, rate: 3500000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-ST-002', description: 'RO water treatment 5000 LPH', unit: 'ls', quantity: 1, rate: 2200000, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-ST-003', description: 'Biomedical waste incinerator', unit: 'nos', quantity: 1, rate: 3500000, type: 'SUBCONTRACTOR' },
        ],
      },
      {
        name: '8. Finishes',
        items: [
          { itemCode: 'HP-FN-001', description: 'Anti-bacterial vinyl flooring', unit: 'sqm', quantity: 4200, rate: 1200, type: 'MATERIAL', resourceName: 'Vinyl Flooring 2mm' },
          { itemCode: 'HP-FN-002', description: 'Hygienic wall cladding (PVC)', unit: 'sqm', quantity: 6500, rate: 1500, type: 'SUBCONTRACTOR' },
          { itemCode: 'HP-FN-003', description: 'Hygienic ceiling (clean room)', unit: 'sqm', quantity: 4200, rate: 850, type: 'SUBCONTRACTOR' },
        ],
      },
    ],
  },
];