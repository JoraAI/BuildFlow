import { resolveBuyCost, resolveSellRate, scaleFromBase, toBaseQty } from '../uom';

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

describe('scaleFromBase / toBaseQty', () => {
  it('scales base amounts into txn units', () => {
    expect(scaleFromBase(10, 50)).toBe(500);
    expect(toBaseQty(2, 50)).toBe(100);
  });
});

describe('resolveSellRate', () => {
  it('uses explicit unit sell over scaled blank', () => {
    const withBagRate = {
      ...cement,
      units: [
        cement.units[0],
        { unitName: 'bag', isBase: false, conversionToBase: 50, rate: 400 },
      ],
    };
    expect(resolveSellRate({ resource: withBagRate, unitName: 'bag' })).toBe(400);
  });

  it('scales blank alternate from base sell', () => {
    expect(resolveSellRate({ resource: cement, unitName: 'bag' })).toBe(500);
  });

  it('scales blank alternate from base distributor rate', () => {
    expect(
      resolveSellRate({ resource: cement, unitName: 'bag', buyerRole: 'DISTRIBUTOR' }),
    ).toBe(400);
  });

  it('scales blank alternate from base customer rate', () => {
    expect(
      resolveSellRate({ resource: cement, unitName: 'bag', buyerRole: 'CUSTOMER' }),
    ).toBe(600);
  });

  it('scales base-unit price list override for alternate units', () => {
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
});

describe('resolveBuyCost', () => {
  it('scales blank alternate from base cost', () => {
    expect(resolveBuyCost({ resource: cement, unitName: 'bag' })).toBe(250);
  });

  it('uses explicit unit costPrice when set', () => {
    const withUnitCost = {
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
    expect(resolveBuyCost({ resource: withUnitCost, unitName: 'bag' })).toBe(220);
  });

  it('returns base cost for base unit', () => {
    expect(resolveBuyCost({ resource: cement, unitName: 'kg' })).toBe(5);
  });
});
