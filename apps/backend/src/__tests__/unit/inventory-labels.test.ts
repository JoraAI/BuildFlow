/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 0) - unit tests for the terminology
 * map and inventory feature flags (pure shared helpers, no DB required).
 */
import {
  getInventoryLabel,
  getInventoryLabelMode,
  getIndentPlural,
  hasInventoryFeature,
  InventoryBusinessProfile,
  INVENTORY_LABELS,
  INVENTORY_PROFILE_LABELS,
} from '@buildflow/shared';

describe('getInventoryLabel (terminology map)', () => {
  it('returns generic wording for all keys in generic mode', () => {
    expect(getInventoryLabel('item', 'generic')).toBe('Item');
    expect(getInventoryLabel('item_plural', 'generic')).toBe('Items');
    expect(getInventoryLabel('catalog', 'generic')).toBe('Catalog');
    expect(getInventoryLabel('issue_bulk', 'generic')).toBe('Bulk issue');
    expect(getInventoryLabel('warehouse', 'generic')).toBe('Warehouse');
    expect(getInventoryLabel('indent', 'generic')).toBe('Purchase request');
    expect(getInventoryLabel('store', 'generic')).toBe('Store');
  });

  it('returns construction-style wording in materials mode', () => {
    expect(getInventoryLabel('item', 'materials')).toBe('Material');
    expect(getInventoryLabel('item_plural', 'materials')).toBe('Materials');
    expect(getInventoryLabel('indent', 'materials')).toBe('Indent');
  });

  it('every mode covers every label key (no missing aliases)', () => {
    const keys = [
      'item',
      'item_plural',
      'catalog',
      'issue_bulk',
      'warehouse',
      'indent',
      'store',
    ] as const;
    for (const mode of ['generic', 'materials'] as const) {
      for (const key of keys) {
        expect(INVENTORY_LABELS[mode][key].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getInventoryLabelMode / getIndentPlural', () => {
  it('MATERIAL_SUPPLIER keeps materials wording, everything else is generic', () => {
    expect(getInventoryLabelMode('MATERIAL_SUPPLIER')).toBe('materials');
    expect(getInventoryLabelMode('RETAIL')).toBe('generic');
    expect(getInventoryLabelMode('GENERAL')).toBe('generic');
    expect(getInventoryLabelMode(null)).toBe('generic');
    expect(getInventoryLabelMode(undefined)).toBe('generic');
  });

  it('plurals the indent label per mode', () => {
    expect(getIndentPlural('generic')).toBe('Purchase requests');
    expect(getIndentPlural('materials')).toBe('Indents');
  });
});

describe('InventoryBusinessProfile enum', () => {
  it('exposes all seven profiles with labels', () => {
    expect(Object.values(InventoryBusinessProfile)).toHaveLength(7);
    expect(InventoryBusinessProfile.GENERAL).toBe('GENERAL');
    expect(INVENTORY_PROFILE_LABELS[InventoryBusinessProfile.RETAIL]).toBe('Retail store');
    expect(INVENTORY_PROFILE_LABELS[InventoryBusinessProfile.MATERIAL_SUPPLIER]).toContain('Material');
  });
});

describe('hasInventoryFeature (feature flags)', () => {
  it('shipped Phase 1-3 flags are ON for INVENTORY', () => {
    // Phase 1.1 (parties) + Phase 1.3 (stock_adjustments) + Phase 2.1 (sales_orders)
    // + Phase 3.1 (multi_warehouse) + Phase 3.4 (barcode) all shipped.
    expect(hasInventoryFeature('INVENTORY', 'parties')).toBe(true);
    expect(hasInventoryFeature('INVENTORY', 'stock_adjustments')).toBe(true);
    expect(hasInventoryFeature('INVENTORY', 'sales_orders')).toBe(true);
    expect(hasInventoryFeature('INVENTORY', 'multi_warehouse')).toBe(true);
    expect(hasInventoryFeature('INVENTORY', 'barcode')).toBe(true);
  });

  it('construction plans never expose inventory-horizontal flags', () => {
    expect(hasInventoryFeature('STARTER', 'parties')).toBe(false);
    expect(hasInventoryFeature('PROFESSIONAL', 'multi_warehouse')).toBe(false);
    expect(hasInventoryFeature('ENTERPRISE', 'sales_orders')).toBe(false);
    expect(hasInventoryFeature('STARTER', 'barcode')).toBe(false);
    expect(hasInventoryFeature('STARTER', 'stock_adjustments')).toBe(false);
  });
});
