import { demandsFromBoqItems } from '../../services/material-demand.service';

describe('demandsFromBoqItems', () => {
  it('returns remaining qty for MATERIAL lines with catalog resource', () => {
    const lines = demandsFromBoqItems([
      {
        id: 'boq-1',
        itemCode: 'MAT-001',
        description: 'Cement',
        unit: 'bag',
        quantity: 300,
        executedQty: 50,
        category: 'MATERIAL',
        resourceId: 'res-1',
      },
      {
        id: 'boq-2',
        itemCode: 'LAB-001',
        description: 'Masonry',
        unit: 'day',
        quantity: 10,
        executedQty: 0,
        category: 'LABOUR',
        resourceId: 'res-2',
      },
      {
        id: 'boq-3',
        itemCode: 'MAT-002',
        description: 'Sand',
        unit: 'cum',
        quantity: 20,
        executedQty: 25,
        category: 'MATERIAL',
        resourceId: 'res-3',
      },
    ]);

    expect(lines).toEqual([
      {
        resourceId: 'res-1',
        quantity: 250,
        unit: 'bag',
        boqItemId: 'boq-1',
      },
    ]);
  });
});
