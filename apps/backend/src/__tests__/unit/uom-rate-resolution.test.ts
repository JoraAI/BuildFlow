/**
 * Unit coverage for shared multi-unit sell/buy blank scaling.
 * Mirrors packages/shared/src/__tests__/uom.test.ts for the backend Jest runner.
 */
import {
  mrpCapForUnit,
  resolveBuyCost,
  resolveSellRate,
  scaleFromBase,
  toBaseQty,
} from '@buildflow/shared';

const cement = {
  unit: 'kg',
  rate: 10,
  distributorRate: 8,
  customerRate: 12,
  costPrice: 5,
  units: [
    { unitName: 'kg', isBase: true, conversionToBase: 1 },
    { unitName: 'bag', isBase: false, conversionToBase: 50 },
  ],
};

describe('uom rate resolution (blank alts scale)', () => {
  it('scaleFromBase / toBaseQty', () => {
    expect(scaleFromBase(10, 50)).toBe(500);
    expect(toBaseQty(2, 50)).toBe(100);
  });

  it('resolveSellRate defaults walk-in to retailer and scales roles', () => {
    expect(resolveSellRate({ resource: cement, unitName: 'bag' })).toBe(600);
    expect(
      resolveSellRate({ resource: cement, unitName: 'bag', buyerRole: 'DISTRIBUTOR' }),
    ).toBe(400);
    expect(
      resolveSellRate({ resource: cement, unitName: 'bag', buyerRole: 'CUSTOMER' }),
    ).toBe(600);
  });

  it('resolveSellRate prefers unit role ₹ over generic unit.rate', () => {
    const withBoth = {
      ...cement,
      units: [
        cement.units[0],
        {
          unitName: 'bag',
          isBase: false,
          conversionToBase: 50,
          rate: 160,
          customerRate: 155,
          distributorRate: 145,
        },
      ],
    };
    expect(resolveSellRate({ resource: withBoth, unitName: 'bag' })).toBe(155);
    expect(
      resolveSellRate({ resource: withBoth, unitName: 'bag', buyerRole: 'DISTRIBUTOR' }),
    ).toBe(145);
  });

  it('blank unit role ₹ ignores generic unit.rate and scales base', () => {
    const withSellOnly = {
      ...cement,
      units: [
        cement.units[0],
        { unitName: 'bag', isBase: false, conversionToBase: 50, rate: 400 },
      ],
    };
    expect(resolveSellRate({ resource: withSellOnly, unitName: 'bag' })).toBe(600);
  });

  it('resolveBuyCost scales blank and honours unit costPrice', () => {
    expect(resolveBuyCost({ resource: cement, unitName: 'bag' })).toBe(250);
    expect(resolveBuyCost({ resource: cement, unitName: 'kg' })).toBe(5);
    const withCost = {
      ...cement,
      units: [
        cement.units[0],
        {
          unitName: 'bag',
          isBase: false,
          conversionToBase: 50,
          costPrice: 220,
        },
      ],
    };
    expect(resolveBuyCost({ resource: withCost, unitName: 'bag' })).toBe(220);
  });

  it('resolveSellRate scales base-unit price-list overrides for alt units', () => {
    expect(
      resolveSellRate({
        resource: cement,
        unitName: 'bag',
        priceListOverride: 9,
      }),
    ).toBe(450);
    expect(
      resolveSellRate({
        resource: cement,
        unitName: 'kg',
        priceListOverride: 9,
      }),
    ).toBe(9);
  });

  it('mrpCapForUnit scales base MRP to txn unit', () => {
    expect(mrpCapForUnit(3.2, 50)).toBe(160);
    expect(mrpCapForUnit(3.2, 1)).toBe(3.2);
    expect(mrpCapForUnit(null, 50)).toBeNull();
    expect(mrpCapForUnit(0, 50)).toBeNull();
  });
});
