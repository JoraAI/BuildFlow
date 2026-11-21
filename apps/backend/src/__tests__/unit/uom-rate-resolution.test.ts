/**
 * Unit coverage for shared multi-unit sell/buy blank scaling.
 * Mirrors packages/shared/src/__tests__/uom.test.ts for the backend Jest runner.
 */
import { resolveBuyCost, resolveSellRate, scaleFromBase, toBaseQty } from '@buildflow/shared';

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

  it('resolveSellRate scales blank bag from base', () => {
    expect(resolveSellRate({ resource: cement, unitName: 'bag' })).toBe(500);
    expect(
      resolveSellRate({ resource: cement, unitName: 'bag', buyerRole: 'DISTRIBUTOR' }),
    ).toBe(400);
    expect(
      resolveSellRate({ resource: cement, unitName: 'bag', buyerRole: 'CUSTOMER' }),
    ).toBe(600);
  });

  it('resolveSellRate prefers explicit unit rate', () => {
    const withBag = {
      ...cement,
      units: [
        cement.units[0],
        { unitName: 'bag', isBase: false, conversionToBase: 50, rate: 400 },
      ],
    };
    expect(resolveSellRate({ resource: withBag, unitName: 'bag' })).toBe(400);
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
});
