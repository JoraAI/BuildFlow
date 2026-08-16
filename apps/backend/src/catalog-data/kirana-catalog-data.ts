/**
 * BuildFlow - Kirana vertical starter catalog template
 * (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.1, K1–K4).
 *
 * Tenant-owned: `applyCatalogTemplate` COPIES these rows once into the
 * company's `Resource` table with `itemCode = templateKey` (stable). Re-apply /
 * "add missing" is insert-only - tenant edits to name/rate/GST/HSN/barcode/
 * reorder are never overwritten (K3).
 *
 * K4 rules honoured: generic pack-size variants; NO opening quantity; NO
 * volatile MRP/sale price as truth (`rate` left 0 - tenant sets price); NO
 * guessed barcodes; HSN + GST are SUGGESTED (tenant reviews before/after).
 */
export interface KiranaTemplateItem {
  /** Stable key - stored as `Resource.itemCode` (searchable). Never changes. */
  templateKey: string;
  /** Human name incl. pack size, e.g. "Wheat Atta 5 kg". */
  name: string;
  category: string;
  packSize: string;
  unit: string;
  /** Suggested HSN (GST lookup aid) - tenant may edit. */
  hsn: string;
  /** Suggested GST % - tenant may edit. */
  gstRate: number;
  /** Suggested low-stock threshold - tenant may edit. */
  reorderPoint: number;
}

/** Phase 11.5: dated, editable onboarding suggestion - never a live-price claim. */
export const KIRANA_MRP_AS_OF = '2026-08-16';
export const KIRANA_MRP_SOURCE =
  'Indicative Indian retail reference; verify the printed MRP on the package';

/**
 * Conservative Indian MRP suggestion for generic starter SKUs. The tenant
 * reviews this when selecting an SKU; it is never silently refreshed.
 */
export function suggestedIndianMrp(item: KiranaTemplateItem): number {
  const n = item.name.toLowerCase();
  const amount = (fallback: number, rules: Array<[RegExp, number]>) =>
    rules.find(([pattern]) => pattern.test(n))?.[1] ?? fallback;

  if (item.category === KIRANA_CATEGORIES.STAPLES) {
    return amount(80, [
      [/10 kg/, 650], [/5 kg/, 350], [/1 kg/, 85], [/5 l/, 750],
      [/1 l/, 170], [/500 g/, 180], [/200 g|200 ml/, 65], [/100 g/, 45],
    ]);
  }
  if (item.category === KIRANA_CATEGORIES.DAILY) {
    return amount(60, [
      [/milk pouch 500/, 32], [/curd 400/, 45], [/butter 100/, 60],
      [/ghee 1 l/, 680], [/paneer 200/, 95], [/bread 400/, 50],
      [/eggs/, 90], [/cheese/, 140], [/noodles/, 15], [/pasta 500/, 80],
      [/ketchup 1 kg/, 160], [/mayonnaise 500/, 135],
    ]);
  }
  if (item.category === KIRANA_CATEGORIES.SNACKS) {
    return amount(30, [[/500 g/, 120], [/200 g/, 60], [/100 g/, 35], [/5[02] g|60 g|70 g/, 20]]);
  }
  if (item.category === KIRANA_CATEGORIES.BISCUITS) {
    return amount(40, [[/500 g/, 90], [/250 g/, 45], [/200 g/, 50], [/120 g/, 35], [/75 g/, 20]]);
  }
  if (item.category === KIRANA_CATEGORIES.CONFECTIONERY) {
    return amount(20, [[/55 g/, 80], [/38 g|37 g|40 g/, 45], [/27 g/, 25]]);
  }
  if (item.category === KIRANA_CATEGORIES.BEVERAGES) {
    return amount(60, [[/2 l/, 100], [/1 l/, 70], [/750 ml/, 45], [/500 ml/, 40], [/250 ml|200 ml/, 20]]);
  }
  if (item.category === KIRANA_CATEGORIES.PERSONAL_CARE) {
    return amount(95, [[/500 ml/, 220], [/200 ml|200 g/, 130], [/100 ml|100 g/, 75], [/50 g/, 35]]);
  }
  return amount(95, [[/1 l|1 kg/, 190], [/500 ml|500 g/, 110], [/200 ml|200 g/, 65], [/100/, 40]]);
}

export const KIRANA_CATEGORIES = {
  STAPLES: 'Staples & grains',
  DAILY: 'Dairy & daily use',
  SNACKS: 'Snacks & namkeen',
  BISCUITS: 'Biscuits & cookies',
  CONFECTIONERY: 'Confectionery',
  BEVERAGES: 'Beverages',
  PERSONAL_CARE: 'Personal care',
  CLEANING: 'Cleaning & household',
} as const;

/** Bump when the template contents change materially (visible in Settings). */
export const KIRANA_TEMPLATE_VERSION = '2026-08-16';

export const KIRANA_TEMPLATE: KiranaTemplateItem[] = [
  // ── Staples & grains (KIR-001 … KIR-034) ─────────────────────────
  { templateKey: 'KIR-001', name: 'Wheat Atta 5 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '5 kg', unit: 'bag', hsn: '1101', gstRate: 5, reorderPoint: 20 },
  { templateKey: 'KIR-002', name: 'Wheat Atta 10 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '10 kg', unit: 'bag', hsn: '1101', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-003', name: 'Maida 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '1101', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-004', name: 'Suji (Rava) 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '1103', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-005', name: 'Basmati Rice 5 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '5 kg', unit: 'bag', hsn: '1006', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-006', name: 'Ponni Rice 5 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '5 kg', unit: 'bag', hsn: '1006', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-007', name: 'Sonam Masuri Rice 10 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '10 kg', unit: 'bag', hsn: '1006', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-008', name: 'Poha (Flattened Rice) 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '1904', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-009', name: 'Chana Dal 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '0713', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-010', name: 'Toor Dal 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '0713', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-011', name: 'Moong Dal 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '0713', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-012', name: 'Masoor Dal 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '0713', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-013', name: 'Rajma (Kidney Beans) 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '0713', gstRate: 5, reorderPoint: 8 },
  { templateKey: 'KIR-014', name: 'Chole (Chickpea) 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '0713', gstRate: 5, reorderPoint: 8 },
  { templateKey: 'KIR-015', name: 'Groundnut Oil 1 L', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 L', unit: 'bottle', hsn: '1517', gstRate: 5, reorderPoint: 12 },
  { templateKey: 'KIR-016', name: 'Sunflower Oil 1 L', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 L', unit: 'bottle', hsn: '1517', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-017', name: 'Palm Oil 1 L', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 L', unit: 'bottle', hsn: '1517', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-018', name: 'Refined Sunflower Oil 5 L', category: KIRANA_CATEGORIES.STAPLES, packSize: '5 L', unit: 'jar', hsn: '1517', gstRate: 5, reorderPoint: 6 },
  { templateKey: 'KIR-019', name: 'Sugar 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '1701', gstRate: 5, reorderPoint: 30 },
  { templateKey: 'KIR-020', name: 'Sugar 5 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '5 kg', unit: 'bag', hsn: '1701', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-021', name: 'Iodised Salt 1 kg', category: KIRANA_CATEGORIES.STAPLES, packSize: '1 kg', unit: 'pack', hsn: '2501', gstRate: 5, reorderPoint: 30 },
  { templateKey: 'KIR-022', name: 'Turmeric Powder 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '0910', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-023', name: 'Red Chilli Powder 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '0904', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-024', name: 'Coriander Powder 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '0910', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-025', name: 'Garam Masala 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '0910', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-026', name: 'Cumin Seeds (Jeera) 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '0909', gstRate: 5, reorderPoint: 10 },
  { templateKey: 'KIR-027', name: 'Mustard Seeds 200 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '200 g', unit: 'pack', hsn: '1207', gstRate: 5, reorderPoint: 8 },
  { templateKey: 'KIR-028', name: 'Black Pepper 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '0904', gstRate: 5, reorderPoint: 8 },
  { templateKey: 'KIR-029', name: 'Ready Masala Mix 200 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '200 g', unit: 'pack', hsn: '2103', gstRate: 12, reorderPoint: 8 },
  { templateKey: 'KIR-030', name: 'Ready Mix Powder 100 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '100 g', unit: 'pack', hsn: '2103', gstRate: 12, reorderPoint: 10 },
  { templateKey: 'KIR-031', name: 'Salted Snack Mix 200 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '200 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 15 },
  { templateKey: 'KIR-032', name: 'Coconut Oil 200 ml', category: KIRANA_CATEGORIES.STAPLES, packSize: '200 ml', unit: 'bottle', hsn: '1513', gstRate: 12, reorderPoint: 10 },
  { templateKey: 'KIR-033', name: 'Honey 500 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '500 g', unit: 'bottle', hsn: '0409', gstRate: 12, reorderPoint: 8 },
  { templateKey: 'KIR-034', name: 'Poha Chivda 200 g', category: KIRANA_CATEGORIES.STAPLES, packSize: '200 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 10 },

  // ── Dairy & daily use (KIR-035 … KIR-048) ────────────────────────
  { templateKey: 'KIR-035', name: 'Milk Pouch 500 ml', category: KIRANA_CATEGORIES.DAILY, packSize: '500 ml', unit: 'pouch', hsn: '0401', gstRate: 5, reorderPoint: 40 },
  { templateKey: 'KIR-036', name: 'Curd 400 g', category: KIRANA_CATEGORIES.DAILY, packSize: '400 g', unit: 'cup', hsn: '0403', gstRate: 5, reorderPoint: 20 },
  { templateKey: 'KIR-037', name: 'Butter 100 g', category: KIRANA_CATEGORIES.DAILY, packSize: '100 g', unit: 'pack', hsn: '0405', gstRate: 12, reorderPoint: 15 },
  { templateKey: 'KIR-038', name: 'Ghee 1 L', category: KIRANA_CATEGORIES.DAILY, packSize: '1 L', unit: 'bottle', hsn: '0405', gstRate: 12, reorderPoint: 8 },
  { templateKey: 'KIR-039', name: 'Paneer 200 g', category: KIRANA_CATEGORIES.DAILY, packSize: '200 g', unit: 'pack', hsn: '0406', gstRate: 12, reorderPoint: 12 },
  { templateKey: 'KIR-040', name: 'Milk Powder 500 g', category: KIRANA_CATEGORIES.DAILY, packSize: '500 g', unit: 'pack', hsn: '0402', gstRate: 12, reorderPoint: 8 },
  { templateKey: 'KIR-041', name: 'Brown Bread 400 g', category: KIRANA_CATEGORIES.DAILY, packSize: '400 g', unit: 'loaf', hsn: '1905', gstRate: 5, reorderPoint: 20 },
  { templateKey: 'KIR-042', name: 'Milk Bread 400 g', category: KIRANA_CATEGORIES.DAILY, packSize: '400 g', unit: 'loaf', hsn: '1905', gstRate: 5, reorderPoint: 20 },
  { templateKey: 'KIR-043', name: 'Eggs (Dozen)', category: KIRANA_CATEGORIES.DAILY, packSize: '12 pcs', unit: 'dozen', hsn: '0407', gstRate: 5, reorderPoint: 20 },
  { templateKey: 'KIR-044', name: 'Cheese Slices 200 g', category: KIRANA_CATEGORIES.DAILY, packSize: '200 g', unit: 'pack', hsn: '0406', gstRate: 12, reorderPoint: 10 },
  { templateKey: 'KIR-045', name: 'Instant Noodles 70 g', category: KIRANA_CATEGORIES.DAILY, packSize: '70 g', unit: 'pack', hsn: '1902', gstRate: 12, reorderPoint: 30 },
  { templateKey: 'KIR-046', name: 'Pasta 500 g', category: KIRANA_CATEGORIES.DAILY, packSize: '500 g', unit: 'pack', hsn: '1902', gstRate: 12, reorderPoint: 10 },
  { templateKey: 'KIR-047', name: 'Tomato Ketchup 1 kg', category: KIRANA_CATEGORIES.DAILY, packSize: '1 kg', unit: 'bottle', hsn: '2103', gstRate: 12, reorderPoint: 12 },
  { templateKey: 'KIR-048', name: 'Mayonnaise 500 g', category: KIRANA_CATEGORIES.DAILY, packSize: '500 g', unit: 'jar', hsn: '2103', gstRate: 18, reorderPoint: 8 },

  // ── Snacks & namkeen (KIR-049 … KIR-057) ─────────────────────────
  { templateKey: 'KIR-049', name: 'Potato Chips Classic 52 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '52 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 30 },
  { templateKey: 'KIR-050', name: 'Potato Chips Magic Masala 52 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '52 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 30 },
  { templateKey: 'KIR-051', name: 'Corn Puffs 52 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '52 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 20 },
  { templateKey: 'KIR-052', name: 'Potato Wafers 60 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '60 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 20 },
  { templateKey: 'KIR-053', name: 'Cheese Puffs 70 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '70 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 20 },
  { templateKey: 'KIR-054', name: 'Namkeen (Bhujia) 200 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '200 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 15 },
  { templateKey: 'KIR-055', name: 'Namkeen Mixture 500 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '500 g', unit: 'pack', hsn: '2106', gstRate: 12, reorderPoint: 10 },
  { templateKey: 'KIR-056', name: 'Roasted Peanuts 200 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '200 g', unit: 'pack', hsn: '2008', gstRate: 12, reorderPoint: 12 },
  { templateKey: 'KIR-057', name: 'Papad 100 g', category: KIRANA_CATEGORIES.SNACKS, packSize: '100 g', unit: 'pack', hsn: '1905', gstRate: 12, reorderPoint: 12 },

  // ── Biscuits & cookies (KIR-058 … KIR-065) ───────────────────────
  { templateKey: 'KIR-058', name: 'Glucose Biscuits 250 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '250 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 40 },
  { templateKey: 'KIR-059', name: 'Marie Biscuits 250 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '250 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 30 },
  { templateKey: 'KIR-060', name: 'Cashew Cookies 200 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '200 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 25 },
  { templateKey: 'KIR-061', name: 'Chocolate Sandwich 120 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '120 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 25 },
  { templateKey: 'KIR-062', name: 'Chocolate Cream 200 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '200 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-063', name: 'Cream Crackers 250 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '250 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-064', name: 'Glucose Biscuits 500 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '500 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-065', name: 'Chocolate Chip Cookies 75 g', category: KIRANA_CATEGORIES.BISCUITS, packSize: '75 g', unit: 'pack', hsn: '1905', gstRate: 18, reorderPoint: 12 },

  // ── Confectionery (KIR-066 … KIR-075) ────────────────────────────
  { templateKey: 'KIR-066', name: 'Milk Chocolate 38 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '38 g', unit: 'bar', hsn: '1806', gstRate: 18, reorderPoint: 40 },
  { templateKey: 'KIR-067', name: 'Milk Chocolate Silk 55 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '55 g', unit: 'bar', hsn: '1806', gstRate: 18, reorderPoint: 30 },
  { templateKey: 'KIR-068', name: 'Wafer Chocolate 37 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '37 g', unit: 'bar', hsn: '1806', gstRate: 18, reorderPoint: 25 },
  { templateKey: 'KIR-069', name: 'Caramel Chocolate 40 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '40 g', unit: 'bar', hsn: '1806', gstRate: 18, reorderPoint: 25 },
  { templateKey: 'KIR-070', name: 'Milk Chocolate Bites 37 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '37 g', unit: 'bar', hsn: '1806', gstRate: 18, reorderPoint: 25 },
  { templateKey: 'KIR-071', name: 'Peanut Chocolate 27 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '27 g', unit: 'bar', hsn: '1806', gstRate: 18, reorderPoint: 25 },
  { templateKey: 'KIR-072', name: 'Candy Jar 100 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '100 g', unit: 'jar', hsn: '1704', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-073', name: 'Chewing Gum 20 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '20 g', unit: 'pack', hsn: '1704', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-074', name: 'Lollipops 100 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '100 g', unit: 'pack', hsn: '1704', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-075', name: 'Toffee Rolls 120 g', category: KIRANA_CATEGORIES.CONFECTIONERY, packSize: '120 g', unit: 'pack', hsn: '1704', gstRate: 18, reorderPoint: 15 },

  // ── Beverages (KIR-076 … KIR-089) ────────────────────────────────
  { templateKey: 'KIR-076', name: 'Tea Leaf 250 g', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '250 g', unit: 'pack', hsn: '0902', gstRate: 5, reorderPoint: 20 },
  { templateKey: 'KIR-077', name: 'Tea Leaf 500 g', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '500 g', unit: 'pack', hsn: '0902', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-078', name: 'Coffee 50 g', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '50 g', unit: 'jar', hsn: '0901', gstRate: 5, reorderPoint: 15 },
  { templateKey: 'KIR-079', name: 'Instant Coffee 100 g', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '100 g', unit: 'jar', hsn: '0901', gstRate: 18, reorderPoint: 12 },
  { templateKey: 'KIR-080', name: 'Cola 750 ml', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '750 ml', unit: 'bottle', hsn: '2202', gstRate: 12, reorderPoint: 30 },
  { templateKey: 'KIR-081', name: 'Orange Soda 750 ml', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '750 ml', unit: 'bottle', hsn: '2202', gstRate: 12, reorderPoint: 30 },
  { templateKey: 'KIR-082', name: 'Lemon Soda 600 ml', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '600 ml', unit: 'bottle', hsn: '2202', gstRate: 12, reorderPoint: 20 },
  { templateKey: 'KIR-083', name: 'Packaged Drinking Water 1 L', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '1 L', unit: 'bottle', hsn: '2201', gstRate: 12, reorderPoint: 30 },
  { templateKey: 'KIR-084', name: 'Packaged Water 20 L Jar', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '20 L', unit: 'jar', hsn: '2201', gstRate: 12, reorderPoint: 5 },
  { templateKey: 'KIR-085', name: 'Mango Juice 1 L', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '1 L', unit: 'pack', hsn: '2009', gstRate: 12, reorderPoint: 15 },
  { templateKey: 'KIR-086', name: 'Orange Juice 1 L', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '1 L', unit: 'pack', hsn: '2009', gstRate: 12, reorderPoint: 15 },
  { templateKey: 'KIR-087', name: 'Lassi 200 ml', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '200 ml', unit: 'bottle', hsn: '2202', gstRate: 12, reorderPoint: 20 },
  { templateKey: 'KIR-088', name: 'Health Drink 500 g', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '500 g', unit: 'jar', hsn: '0404', gstRate: 18, reorderPoint: 10 },
  { templateKey: 'KIR-089', name: 'Energy Drink 250 ml', category: KIRANA_CATEGORIES.BEVERAGES, packSize: '250 ml', unit: 'can', hsn: '2202', gstRate: 18, reorderPoint: 15 },

  // ── Personal care (KIR-090 … KIR-104) ────────────────────────────
  { templateKey: 'KIR-090', name: 'Bathing Soap 75 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '75 g', unit: 'bar', hsn: '3401', gstRate: 18, reorderPoint: 40 },
  { templateKey: 'KIR-091', name: 'Beauty Soap 100 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '100 g', unit: 'bar', hsn: '3401', gstRate: 18, reorderPoint: 40 },
  { templateKey: 'KIR-092', name: 'Cream Soap 100 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '100 g', unit: 'bar', hsn: '3401', gstRate: 18, reorderPoint: 30 },
  { templateKey: 'KIR-093', name: 'Shampoo Sachet 8 ml', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '8 ml', unit: 'sachet', hsn: '3305', gstRate: 18, reorderPoint: 50 },
  { templateKey: 'KIR-094', name: 'Shampoo 180 ml', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '180 ml', unit: 'bottle', hsn: '3305', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-095', name: 'Toothpaste 100 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '100 g', unit: 'tube', hsn: '3306', gstRate: 18, reorderPoint: 30 },
  { templateKey: 'KIR-096', name: 'Toothbrush (single)', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '1 pc', unit: 'nos', hsn: '9603', gstRate: 18, reorderPoint: 40 },
  { templateKey: 'KIR-097', name: 'Face Cream 50 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '50 g', unit: 'jar', hsn: '3304', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-098', name: 'Hair Oil 200 ml', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '200 ml', unit: 'bottle', hsn: '3305', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-099', name: 'Body Lotion 250 ml', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '250 ml', unit: 'bottle', hsn: '3304', gstRate: 18, reorderPoint: 12 },
  { templateKey: 'KIR-100', name: 'Shaving Cream 100 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '100 g', unit: 'tube', hsn: '3307', gstRate: 18, reorderPoint: 12 },
  { templateKey: 'KIR-101', name: 'Sanitary Pads 10 pcs', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '10 pcs', unit: 'pack', hsn: '9619', gstRate: 12, reorderPoint: 20 },
  { templateKey: 'KIR-102', name: 'Baby Powder 100 g', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '100 g', unit: 'pack', hsn: '3305', gstRate: 18, reorderPoint: 12 },
  { templateKey: 'KIR-103', name: 'Baby Diaper M (8 pcs)', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '8 pcs', unit: 'pack', hsn: '9619', gstRate: 12, reorderPoint: 15 },
  { templateKey: 'KIR-104', name: 'Hand Sanitizer 100 ml', category: KIRANA_CATEGORIES.PERSONAL_CARE, packSize: '100 ml', unit: 'bottle', hsn: '3808', gstRate: 18, reorderPoint: 15 },

  // ── Cleaning & household (KIR-105 … KIR-122) ─────────────────────
  { templateKey: 'KIR-105', name: 'Detergent Powder 1 kg', category: KIRANA_CATEGORIES.CLEANING, packSize: '1 kg', unit: 'pack', hsn: '3402', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-106', name: 'Detergent Bar 200 g', category: KIRANA_CATEGORIES.CLEANING, packSize: '200 g', unit: 'bar', hsn: '3401', gstRate: 18, reorderPoint: 30 },
  { templateKey: 'KIR-107', name: 'Dishwash Liquid 500 ml', category: KIRANA_CATEGORIES.CLEANING, packSize: '500 ml', unit: 'bottle', hsn: '3402', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-108', name: 'Dishwash Bar 200 g', category: KIRANA_CATEGORIES.CLEANING, packSize: '200 g', unit: 'bar', hsn: '3401', gstRate: 18, reorderPoint: 30 },
  { templateKey: 'KIR-109', name: 'Liquid Detergent 1 L', category: KIRANA_CATEGORIES.CLEANING, packSize: '1 L', unit: 'bottle', hsn: '3402', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-110', name: 'Floor Cleaner 1 L', category: KIRANA_CATEGORIES.CLEANING, packSize: '1 L', unit: 'bottle', hsn: '3402', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-111', name: 'Toilet Cleaner 500 ml', category: KIRANA_CATEGORIES.CLEANING, packSize: '500 ml', unit: 'bottle', hsn: '3402', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-112', name: 'Phenyl 1 L', category: KIRANA_CATEGORIES.CLEANING, packSize: '1 L', unit: 'bottle', hsn: '3808', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-113', name: 'Scouring Powder 400 g', category: KIRANA_CATEGORIES.CLEANING, packSize: '400 g', unit: 'pack', hsn: '3405', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-114', name: 'Agarbatti (100 sticks)', category: KIRANA_CATEGORIES.CLEANING, packSize: '100 sticks', unit: 'pack', hsn: '3307', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-115', name: 'Mosquito Coil (10 pcs)', category: KIRANA_CATEGORIES.CLEANING, packSize: '10 pcs', unit: 'pack', hsn: '3808', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-116', name: 'Liquid Mosquito Repellent 200 ml', category: KIRANA_CATEGORIES.CLEANING, packSize: '200 ml', unit: 'bottle', hsn: '3808', gstRate: 18, reorderPoint: 12 },
  { templateKey: 'KIR-117', name: 'Garbage Bag Roll (30 pcs)', category: KIRANA_CATEGORIES.CLEANING, packSize: '30 pcs', unit: 'roll', hsn: '3923', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-118', name: 'Matchbox (12 boxes)', category: KIRANA_CATEGORIES.CLEANING, packSize: '12 boxes', unit: 'pack', hsn: '3605', gstRate: 12, reorderPoint: 25 },
  { templateKey: 'KIR-119', name: 'Candle (12 pcs)', category: KIRANA_CATEGORIES.CLEANING, packSize: '12 pcs', unit: 'pack', hsn: '3406', gstRate: 18, reorderPoint: 20 },
  { templateKey: 'KIR-120', name: 'Mop Refill (single)', category: KIRANA_CATEGORIES.CLEANING, packSize: '1 pc', unit: 'nos', hsn: '9603', gstRate: 18, reorderPoint: 10 },
  { templateKey: 'KIR-121', name: 'Scrub Pad 5 pcs', category: KIRANA_CATEGORIES.CLEANING, packSize: '5 pcs', unit: 'pack', hsn: '3924', gstRate: 18, reorderPoint: 15 },
  { templateKey: 'KIR-122', name: 'Cloth Wipes 3 pcs', category: KIRANA_CATEGORIES.CLEANING, packSize: '3 pcs', unit: 'pack', hsn: '6307', gstRate: 18, reorderPoint: 10 },
];

/** Grouped by category for the Settings preview screen. */
export function groupKiranaTemplateByCategory() {
  const groups = new Map<string, KiranaTemplateItem[]>();
  for (const item of KIRANA_TEMPLATE) {
    const arr = groups.get(item.category) ?? [];
    arr.push(item);
    groups.set(item.category, arr);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, itemCount: items.length }));
}
