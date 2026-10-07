/**
 * Reset ONLY the Frosty Cups (ICE_CREAM) demo tenant, then re-seed it.
 *
 * Does not truncate other companies. Safe for shared Neon / Render DB.
 *
 *   cd apps/backend && pnpm exec tsx prisma/reset-ice-cream.ts
 */
import {
  PrismaClient,
  Role,
  ProjectType,
  ProjectStatus,
  ResourceType,
  StockMovementType,
  InventoryBusinessProfile,
  InventoryVertical,
  ResourceTrackingMode,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { disconnectRedis } from '../src/lib/redis';

const prisma = new PrismaClient();

const PASSWORD = 'Test@1234';
const FROSTY_GSTIN = '36AABCF8888F1Z8';
const FROSTY_OWNER = 'owner@frostycups.com';
const FROSTY_MANAGER = 'manager@frostycups.com';

type CatalogItem = {
  name: string;
  unit: string;
  rate: number;
  costPrice: number;
  mrp: number;
  gstRate: number;
  hsn: string;
  brandOrSpec: string;
  category: string;
  sku: string;
  reorderPoint: number;
  trackingMode?: ResourceTrackingMode;
};

async function applyStockIn(
  locationId: string,
  grnId: string,
  lines: Array<{ resourceId: string; quantity: number }>,
): Promise<void> {
  for (const line of lines) {
    const existing = await prisma.stockBalance.findUnique({
      where: { locationId_resourceId: { locationId, resourceId: line.resourceId } },
    });
    if (existing) {
      await prisma.stockBalance.update({
        where: { id: existing.id },
        data: { quantity: { increment: line.quantity } },
      });
    } else {
      await prisma.stockBalance.create({
        data: { locationId, resourceId: line.resourceId, quantity: line.quantity },
      });
    }
    await prisma.stockMovement.create({
      data: {
        locationId,
        resourceId: line.resourceId,
        quantity: line.quantity,
        type: StockMovementType.IN,
        referenceType: 'GRN',
        referenceId: grnId,
      },
    });
  }
}

async function deleteFrostyCups(): Promise<void> {
  const company = await prisma.company.findFirst({
    where: { OR: [{ gstin: FROSTY_GSTIN }, { name: 'Frosty Cups Ice Creams' }] },
  });
  if (!company) {
    // eslint-disable-next-line no-console
    console.log('No existing Frosty Cups company found — will create fresh.');
    return;
  }

  const companyId = company.id;
  const locations = await prisma.stockLocation.findMany({
    where: { companyId },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);
  const resources = await prisma.resource.findMany({
    where: { companyId },
    select: { id: true },
  });
  const resourceIds = resources.map((r) => r.id);
  const recipes = await prisma.recipe.findMany({
    where: { companyId },
    select: { id: true },
  });
  const recipeIds = recipes.map((r) => r.id);

  // Resource FKs without onDelete:Cascade (stock, recipes, GRN/PO/SO lines, etc.).
  if (locationIds.length || resourceIds.length) {
    await prisma.stockBatchBalance.deleteMany({
      where: {
        OR: [
          ...(locationIds.length ? [{ locationId: { in: locationIds } }] : []),
          ...(resourceIds.length ? [{ resourceId: { in: resourceIds } }] : []),
        ],
      },
    });
    await prisma.stockMovement.deleteMany({
      where: {
        OR: [
          ...(locationIds.length ? [{ locationId: { in: locationIds } }] : []),
          ...(resourceIds.length ? [{ resourceId: { in: resourceIds } }] : []),
        ],
      },
    });
    await prisma.stockBalance.deleteMany({
      where: {
        OR: [
          ...(locationIds.length ? [{ locationId: { in: locationIds } }] : []),
          ...(resourceIds.length ? [{ resourceId: { in: resourceIds } }] : []),
        ],
      },
    });
  }
  if (resourceIds.length) {
    await prisma.recipeLine.deleteMany({ where: { inputResourceId: { in: resourceIds } } });
    await prisma.goodsReceiptLine.deleteMany({ where: { resourceId: { in: resourceIds } } });
    await prisma.purchaseOrderLine.deleteMany({ where: { resourceId: { in: resourceIds } } });
    await prisma.salesOrderLine.deleteMany({ where: { resourceId: { in: resourceIds } } });
    await prisma.deliveryChallanLine.deleteMany({ where: { resourceId: { in: resourceIds } } });
    await prisma.invoiceLineItem.deleteMany({ where: { resourceId: { in: resourceIds } } });
    await prisma.customerPrice.deleteMany({ where: { resourceId: { in: resourceIds } } });
  }
  if (recipeIds.length) {
    await prisma.productionBatch.deleteMany({ where: { recipeId: { in: recipeIds } } });
    await prisma.recipeLine.deleteMany({ where: { recipeId: { in: recipeIds } } });
    // Clear recipe → output resource FK before resource/company cascade.
    await prisma.recipe.deleteMany({ where: { id: { in: recipeIds } } });
  }
  await prisma.productionBatch.deleteMany({ where: { companyId } });
  await prisma.buyerInvite.deleteMany({ where: { companyId } });
  await prisma.buyerUser.deleteMany({ where: { companyId } });
  await prisma.salesOrder.deleteMany({ where: { companyId } });
  await prisma.deliveryChallan.deleteMany({ where: { companyId } });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.quote.deleteMany({ where: { companyId } });
  await prisma.transferOrder.deleteMany({ where: { companyId } });
  await prisma.stockCount.deleteMany({ where: { companyId } });

  // Delete resources now that blockers are gone (avoids mid-cascade FK failures).
  await prisma.resource.deleteMany({ where: { companyId } });

  // Break Company ↔ default Project cycle, then cascade-delete the tenant.
  await prisma.company.update({
    where: { id: companyId },
    data: { defaultProjectId: null },
  });
  await prisma.company.delete({ where: { id: companyId } });

  await prisma.user.deleteMany({
    where: { email: { in: [FROSTY_OWNER, FROSTY_MANAGER] } },
  });

  // eslint-disable-next-line no-console
  console.log(`Deleted company ${company.name} (${companyId})`);
}

async function seedFrostyCups(passwordHash: string): Promise<void> {
  const catalog: CatalogItem[] = [
    {
      name: 'Fresh Milk',
      unit: 'L',
      rate: 55,
      costPrice: 48,
      mrp: 60,
      gstRate: 5,
      hsn: '0401',
      brandOrSpec: 'Full cream toned milk',
      category: 'Raw materials',
      sku: 'RAW-MILK',
      reorderPoint: 200,
    },
    {
      name: 'Sugar',
      unit: 'kg',
      rate: 45,
      costPrice: 38,
      mrp: 52,
      gstRate: 5,
      hsn: '1701',
      brandOrSpec: 'S-30 refined sugar',
      category: 'Raw materials',
      sku: 'RAW-SUGAR',
      reorderPoint: 100,
    },
    {
      name: 'Dairy Cream',
      unit: 'kg',
      rate: 280,
      costPrice: 220,
      mrp: 320,
      gstRate: 5,
      hsn: '0401',
      brandOrSpec: '40% fat dairy cream',
      category: 'Raw materials',
      sku: 'RAW-CREAM',
      reorderPoint: 50,
    },
    {
      name: 'Vanilla Essence',
      unit: 'ml',
      rate: 2.5,
      costPrice: 1.8,
      mrp: 3,
      gstRate: 18,
      hsn: '3302',
      brandOrSpec: 'Food-grade vanilla flavour',
      category: 'Raw materials',
      sku: 'RAW-VAN',
      reorderPoint: 500,
    },
    {
      name: 'Cocoa Powder',
      unit: 'kg',
      rate: 420,
      costPrice: 340,
      mrp: 480,
      gstRate: 5,
      hsn: '1805',
      brandOrSpec: 'Alkalised cocoa 10/12',
      category: 'Raw materials',
      sku: 'RAW-COCOA',
      reorderPoint: 25,
    },
    {
      name: 'Stabilizer Mix',
      unit: 'kg',
      rate: 650,
      costPrice: 520,
      mrp: 720,
      gstRate: 18,
      hsn: '38249900',
      brandOrSpec: 'Ice cream stabilizer / emulsifier blend',
      category: 'Raw materials',
      sku: 'RAW-STAB',
      reorderPoint: 10,
    },
    {
      name: 'Wafer Cone',
      unit: 'nos',
      rate: 3,
      costPrice: 1.5,
      mrp: 4,
      gstRate: 12,
      hsn: '1905',
      brandOrSpec: 'Sugar wafer cone',
      category: 'Packaging',
      sku: 'PKG-CONE',
      reorderPoint: 1000,
    },
    {
      name: 'PP Cup 100ml + Lid',
      unit: 'nos',
      rate: 2.2,
      costPrice: 1.1,
      mrp: 3,
      gstRate: 18,
      hsn: '3923',
      brandOrSpec: 'Food-grade PP cup with lid',
      category: 'Packaging',
      sku: 'PKG-CUP-100',
      reorderPoint: 2000,
    },
    {
      name: 'Tub 1L Container',
      unit: 'nos',
      rate: 12,
      costPrice: 7,
      mrp: 15,
      gstRate: 18,
      hsn: '3923',
      brandOrSpec: 'Lock-lid HDPE tub',
      category: 'Packaging',
      sku: 'PKG-TUB-1L',
      reorderPoint: 400,
    },
    {
      name: 'Vanilla Cup 100ml',
      unit: 'nos',
      rate: 25,
      costPrice: 12,
      mrp: 30,
      gstRate: 18,
      hsn: '2105',
      brandOrSpec: 'Frosty Cups Vanilla',
      category: 'Finished goods',
      sku: 'FG-VAN-100',
      reorderPoint: 200,
      trackingMode: ResourceTrackingMode.BATCH_EXPIRY,
    },
    {
      name: 'Chocolate Cup 100ml',
      unit: 'nos',
      rate: 28,
      costPrice: 14,
      mrp: 35,
      gstRate: 18,
      hsn: '2105',
      brandOrSpec: 'Frosty Cups Chocolate',
      category: 'Finished goods',
      sku: 'FG-CHOC-100',
      reorderPoint: 200,
      trackingMode: ResourceTrackingMode.BATCH_EXPIRY,
    },
    {
      name: 'Chocolate Tub 1L',
      unit: 'nos',
      rate: 180,
      costPrice: 95,
      mrp: 220,
      gstRate: 18,
      hsn: '2105',
      brandOrSpec: 'Frosty Cups Family Tub',
      category: 'Finished goods',
      sku: 'FG-CHOC-1L',
      reorderPoint: 80,
      trackingMode: ResourceTrackingMode.BATCH_EXPIRY,
    },
    {
      name: 'Strawberry Cup 100ml',
      unit: 'nos',
      rate: 27,
      costPrice: 13,
      mrp: 32,
      gstRate: 18,
      hsn: '2105',
      brandOrSpec: 'Frosty Cups Strawberry',
      category: 'Finished goods',
      sku: 'FG-STRW-100',
      reorderPoint: 150,
      trackingMode: ResourceTrackingMode.BATCH_EXPIRY,
    },
  ];

  const openingQtys = [800, 400, 180, 5000, 60, 20, 4000, 5000, 600, 150, 0, 40, 0];

  const company = await prisma.company.create({
    data: {
      name: 'Frosty Cups Ice Creams',
      gstin: FROSTY_GSTIN,
      pan: 'AABCF8888F',
      state: 'Telangana',
      address: 'IDA Jeedimetla, Hyderabad',
      subscriptionPlan: 'INVENTORY',
      subscriptionStatus: 'ACTIVE',
      inventoryProfile: InventoryBusinessProfile.WHOLESALE,
      inventoryVertical: InventoryVertical.ICE_CREAM,
      trialStartsAt: new Date(Date.now() - 7 * 86_400_000),
      trialEndsAt: new Date(Date.now() + 358 * 86_400_000),
      lastPaymentAt: new Date(),
    },
  });

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Suresh Frosty',
      email: FROSTY_OWNER,
      role: Role.OWNER,
      phone: '+919900088801',
      passwordHash,
    },
  });

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Priya Plant',
      email: FROSTY_MANAGER,
      role: Role.INVENTORY_MANAGER,
      phone: '+919900088802',
      passwordHash,
    },
  });

  const storeProject = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Main Store',
      code: 'FROSTY',
      type: ProjectType.MINI,
      status: ProjectStatus.IN_PROGRESS,
      clientName: company.name,
      budget: 0,
      createdBy: owner.id,
    },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { defaultProjectId: storeProject.id },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: storeProject.id, userId: owner.id, role: Role.OWNER },
      { projectId: storeProject.id, userId: manager.id, role: Role.INVENTORY_MANAGER },
    ],
  });

  await prisma.companyIntegration.create({
    data: {
      companyId: company.id,
      provider: 'TALLY',
      configuredBy: owner.id,
      settings: {
        sales: 'Sales',
        purchase: 'Purchases',
        cgst: 'CGST',
        sgst: 'SGST',
        igst: 'IGST',
        tdsPayable: 'TDS Payable',
        retention: 'Retention Money',
        advanceRecovery: 'Advance Recovery',
        bank: 'SBI Current',
      },
    },
  });

  const resources: { id: string; sku: string }[] = [];
  for (const m of catalog) {
    const r = await prisma.resource.create({
      data: {
        companyId: company.id,
        name: m.name,
        type: ResourceType.MATERIAL,
        unit: m.unit,
        rate: m.rate,
        costPrice: m.costPrice,
        mrp: m.mrp,
        brandOrSpec: m.brandOrSpec,
        hsnSacCode: m.hsn,
        avgCost: m.costPrice,
        gstRate: m.gstRate,
        category: m.category,
        sku: m.sku,
        reorderPoint: m.reorderPoint,
        trackingMode: m.trackingMode ?? ResourceTrackingMode.NONE,
        lastRateUpdatedAt: new Date(),
      },
    });
    resources.push({ id: r.id, sku: m.sku });
  }

  const mainLoc = await prisma.stockLocation.create({
    data: {
      companyId: company.id,
      projectId: storeProject.id,
      name: 'Main Godown & Central Depot',
      code: 'MAIN',
      isDefault: true,
    },
  });

  for (const [i, qty] of openingQtys.entries()) {
    if (!resources[i] || qty <= 0) continue;
    await applyStockIn(mainLoc.id, `seed-FROSTY-open-${i}`, [
      { resourceId: resources[i]!.id, quantity: qty },
    ]);
  }

  const coldLoc = await prisma.stockLocation.create({
    data: {
      companyId: company.id,
      projectId: storeProject.id,
      name: 'Cold Store - Blast Freezer',
      code: 'COLD',
      address: 'IDA Jeedimetla Cold Chain Block B, Hyderabad',
      isDefault: false,
    },
  });
  await applyStockIn(coldLoc.id, 'seed-FROSTY-cold-0', [
    { resourceId: resources[0]!.id, quantity: 80 },
  ]);
  await applyStockIn(coldLoc.id, 'seed-FROSTY-cold-2', [
    { resourceId: resources[2]!.id, quantity: 40 },
  ]);

  // Demo customers (clean slate — no prior buyer invites)
  const cityScoop = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'City Scoop Retail Pvt Ltd',
      businessName: 'City Scoop',
      phone: '+919876509999',
      email: 'orders@cityscoop.com',
      paymentTerms: 'Net 15',
      creditLimit: 50000,
      isActive: true,
    },
  });

  await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Demo Parlour',
      businessName: 'Demo Parlour',
      phone: '+919876500001',
      email: 'parlour@demo.com',
      paymentTerms: 'Net 7',
      creditLimit: 20000,
      isActive: true,
    },
  });

  const bySku = new Map(resources.map((r) => [r.sku, r]));
  const milk = bySku.get('RAW-MILK')!;
  const sugar = bySku.get('RAW-SUGAR')!;
  const cream = bySku.get('RAW-CREAM')!;
  const vanilla = bySku.get('RAW-VAN')!;
  const cocoa = bySku.get('RAW-COCOA')!;
  const stab = bySku.get('RAW-STAB')!;
  const cupPkg = bySku.get('PKG-CUP-100')!;
  const tubPkg = bySku.get('PKG-TUB-1L')!;
  const vanCup = bySku.get('FG-VAN-100')!;
  const chocCup = bySku.get('FG-CHOC-100')!;
  const chocTub = bySku.get('FG-CHOC-1L')!;
  const strawCup = bySku.get('FG-STRW-100')!;

  const vanillaRecipe = await prisma.recipe.create({
    data: {
      companyId: company.id,
      name: 'Vanilla Cup Mix',
      outputResourceId: vanCup.id,
      outputQty: 100,
      notes: 'BOM for 100 × Vanilla Cup 100ml (includes cup+lid)',
      lines: {
        create: [
          { inputResourceId: milk.id, quantity: 40 },
          { inputResourceId: sugar.id, quantity: 8 },
          { inputResourceId: cream.id, quantity: 6 },
          { inputResourceId: vanilla.id, quantity: 200 },
          { inputResourceId: stab.id, quantity: 0.4 },
          { inputResourceId: cupPkg.id, quantity: 100 },
        ],
      },
    },
  });

  const chocTubRecipe = await prisma.recipe.create({
    data: {
      companyId: company.id,
      name: 'Chocolate Tub Mix',
      outputResourceId: chocTub.id,
      outputQty: 20,
      notes: 'BOM for 20 × Chocolate Tub 1L',
      lines: {
        create: [
          { inputResourceId: milk.id, quantity: 35 },
          { inputResourceId: sugar.id, quantity: 10 },
          { inputResourceId: cream.id, quantity: 12 },
          { inputResourceId: cocoa.id, quantity: 4 },
          { inputResourceId: stab.id, quantity: 0.5 },
          { inputResourceId: tubPkg.id, quantity: 20 },
        ],
      },
    },
  });

  await prisma.recipe.create({
    data: {
      companyId: company.id,
      name: 'Chocolate Cup Mix',
      outputResourceId: chocCup.id,
      outputQty: 100,
      notes: 'BOM for 100 × Chocolate Cup 100ml',
      lines: {
        create: [
          { inputResourceId: milk.id, quantity: 38 },
          { inputResourceId: sugar.id, quantity: 9 },
          { inputResourceId: cream.id, quantity: 7 },
          { inputResourceId: cocoa.id, quantity: 2.5 },
          { inputResourceId: cupPkg.id, quantity: 100 },
        ],
      },
    },
  });

  for (const fg of [vanCup, chocCup, chocTub, strawCup]) {
    await prisma.resource.update({
      where: { id: fg.id },
      data: { b2bPublished: true },
    });
  }

  await prisma.productionBatch.create({
    data: {
      companyId: company.id,
      recipeId: vanillaRecipe.id,
      locationId: mainLoc.id,
      outputQty: 100,
      batchCode: 'B-SEED-VAN-001',
      status: 'DRAFT',
      createdBy: owner.id,
      manufacturedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 86_400_000),
      notes: 'Draft — open Production → Batches and tap Complete',
    },
  });

  await prisma.productionBatch.create({
    data: {
      companyId: company.id,
      recipeId: chocTubRecipe.id,
      locationId: mainLoc.id,
      outputQty: 20,
      batchCode: 'B-SEED-CHOC-001',
      status: 'DRAFT',
      createdBy: owner.id,
      manufacturedAt: new Date(),
      expiresAt: new Date(Date.now() + 120 * 86_400_000),
      notes: 'Draft chocolate tub batch for plant trial',
    },
  });

  await prisma.buyerUser.create({
    data: {
      companyId: company.id,
      customerId: cityScoop.id,
      email: 'buyer@cityscoop.com',
      name: 'City Scoop Buyer',
      phone: '+919876509999',
      isActive: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Frosty Cups Ice Creams re-seeded');
  // eslint-disable-next-line no-console
  console.log(`   companyId=${company.id}`);
  // eslint-disable-next-line no-console
  console.log(`   Login: ${FROSTY_OWNER} / OTP 111111 (or password ${PASSWORD})`);
  // eslint-disable-next-line no-console
  console.log('   Buyer: buyer@cityscoop.com / OTP 111111');
  // eslint-disable-next-line no-console
  console.log('   Catalog: 13 SKUs, 3 recipes, 2 draft batches, City Scoop buyer linked');
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Resetting Ice cream inventory (Frosty Cups)…');
  await deleteFrostyCups();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await seedFrostyCups(passwordHash);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Ice cream reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectRedis();
    await prisma.$disconnect();
  });
