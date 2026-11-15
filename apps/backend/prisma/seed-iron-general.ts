/**
 * Additive seed: Iron and General Stores (WHOLESALER) demo tenant.
 *
 * Never truncates. Skips if already present. Does not touch Creamy Kulfi / Frosty / Reddy / Kirana / Lumina.
 *
 *   cd apps/backend && pnpm exec tsx prisma/seed-iron-general.ts
 *
 * Login (add phone to OTP_TEST_PHONES for master OTP 111111):
 *   owner@ironandgeneral.com / +919900000020
 *   manager@ironandgeneral.com / +919900000021
 *   password Test@1234
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

const PASSWORD = 'Test@1234';
const OWNER_EMAIL = 'owner@ironandgeneral.com';
const OWNER_PHONE = '+919900000020';
const MANAGER_EMAIL = 'manager@ironandgeneral.com';
const MANAGER_PHONE = '+919900000021';
const COMPANY_NAME = 'Iron and General Stores';
const GSTIN = '36AABCI5555I1Z5';

const PROTECTED_NAMES = [
  'The creamy kulfi',
  'Frosty Cups Ice Creams',
  'Reddy Constructions Pvt Ltd',
  'Shri Ganesh Kirana & General Store',
  'Lumina Lighting & Event Electricals',
];

/** Neon from WSL often needs hostaddr; set before any PrismaClient is constructed. */
async function ensureReachableDatabaseUrl(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const u = new URL(raw);
  const hostname = u.hostname;
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return;
  }

  let ip: string | undefined;
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { accept: 'application/dns-json' } },
    );
    const data = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    ip = data.Answer?.find((a) => a.type === 1)?.data;
  } catch {
    ip = undefined;
  }
  if (!ip) throw new Error(`Could not resolve ${hostname} via Cloudflare DNS`);

  u.hostname = ip;
  if (!u.searchParams.get('options')) {
    u.searchParams.set('options', `endpoint=${hostname.split('.')[0]}`);
  }
  if (!u.searchParams.get('sslmode')) u.searchParams.set('sslmode', 'require');
  process.env.DATABASE_URL = u.toString();
}

let prisma: PrismaClient;

async function snapshotProtected(): Promise<string> {
  const rows = await prisma.company.findMany({
    where: { name: { in: PROTECTED_NAMES } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => `${r.name}:${r.id}`).join('|');
}

async function applyStockIn(
  locationId: string,
  referenceId: string,
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
        referenceType: 'OPENING',
        referenceId,
        notes: 'Iron & General opening stock',
      },
    });
  }
}

/** Steel + hardware wholesaler catalog with GST HSN codes. */
const CATALOG: Array<{
  name: string;
  unit: string;
  rate: number;
  costPrice: number;
  mrp: number;
  hsn: string;
  gstRate: number;
  category: string;
  sku: string;
  brandOrSpec: string;
  qty: number;
  reorderPoint: number;
}> = [
  // TMT & reinforcement (HSN 7213 / 7217)
  {
    name: 'TMT Bar Fe500 8mm',
    unit: 'kg',
    rate: 68,
    costPrice: 58,
    mrp: 75,
    hsn: '7213',
    gstRate: 18,
    category: 'TMT & reinforcement',
    sku: 'TMT-8MM',
    brandOrSpec: 'JSW / SAIL Fe500',
    qty: 8500,
    reorderPoint: 1500,
  },
  {
    name: 'TMT Bar Fe500 10mm',
    unit: 'kg',
    rate: 67,
    costPrice: 57,
    mrp: 74,
    hsn: '7213',
    gstRate: 18,
    category: 'TMT & reinforcement',
    sku: 'TMT-10MM',
    brandOrSpec: 'JSW / SAIL Fe500',
    qty: 12000,
    reorderPoint: 2000,
  },
  {
    name: 'TMT Bar Fe500 12mm',
    unit: 'kg',
    rate: 66,
    costPrice: 56,
    mrp: 73,
    hsn: '7213',
    gstRate: 18,
    category: 'TMT & reinforcement',
    sku: 'TMT-12MM',
    brandOrSpec: 'JSW / SAIL Fe500',
    qty: 15000,
    reorderPoint: 2500,
  },
  {
    name: 'TMT Bar Fe500 16mm',
    unit: 'kg',
    rate: 65,
    costPrice: 55,
    mrp: 72,
    hsn: '7213',
    gstRate: 18,
    category: 'TMT & reinforcement',
    sku: 'TMT-16MM',
    brandOrSpec: 'JSW / SAIL Fe500',
    qty: 10000,
    reorderPoint: 2000,
  },
  {
    name: 'TMT Bar Fe500 20mm',
    unit: 'kg',
    rate: 65,
    costPrice: 55,
    mrp: 72,
    hsn: '7213',
    gstRate: 18,
    category: 'TMT & reinforcement',
    sku: 'TMT-20MM',
    brandOrSpec: 'JSW / SAIL Fe500',
    qty: 8000,
    reorderPoint: 1500,
  },
  {
    name: 'Binding Wire 18 Gauge',
    unit: 'kg',
    rate: 72,
    costPrice: 60,
    mrp: 85,
    hsn: '7217',
    gstRate: 18,
    category: 'TMT & reinforcement',
    sku: 'BW-18G',
    brandOrSpec: 'Soft annealed 18G',
    qty: 2200,
    reorderPoint: 400,
  },
  // MS sections (HSN 7216 / 7208)
  {
    name: 'MS Angle 50x50x6mm',
    unit: 'kg',
    rate: 62,
    costPrice: 52,
    mrp: 70,
    hsn: '7216',
    gstRate: 18,
    category: 'MS sections',
    sku: 'ANG-50-6',
    brandOrSpec: 'IS 2062',
    qty: 4500,
    reorderPoint: 800,
  },
  {
    name: 'MS Angle 75x75x8mm',
    unit: 'kg',
    rate: 63,
    costPrice: 53,
    mrp: 72,
    hsn: '7216',
    gstRate: 18,
    category: 'MS sections',
    sku: 'ANG-75-8',
    brandOrSpec: 'IS 2062',
    qty: 3200,
    reorderPoint: 600,
  },
  {
    name: 'MS Channel 100x50mm',
    unit: 'kg',
    rate: 64,
    costPrice: 54,
    mrp: 73,
    hsn: '7216',
    gstRate: 18,
    category: 'MS sections',
    sku: 'CHN-100',
    brandOrSpec: 'ISMC 100',
    qty: 2800,
    reorderPoint: 500,
  },
  {
    name: 'MS Flat 40x6mm',
    unit: 'kg',
    rate: 61,
    costPrice: 51,
    mrp: 68,
    hsn: '7216',
    gstRate: 18,
    category: 'MS sections',
    sku: 'FLT-40-6',
    brandOrSpec: 'Mild steel flat',
    qty: 1800,
    reorderPoint: 300,
  },
  {
    name: 'MS Plate 6mm',
    unit: 'kg',
    rate: 66,
    costPrice: 56,
    mrp: 75,
    hsn: '7208',
    gstRate: 18,
    category: 'MS plates & sheets',
    sku: 'PLT-6MM',
    brandOrSpec: 'HR plate',
    qty: 3500,
    reorderPoint: 600,
  },
  {
    name: 'MS Plate 10mm',
    unit: 'kg',
    rate: 66,
    costPrice: 56,
    mrp: 75,
    hsn: '7208',
    gstRate: 18,
    category: 'MS plates & sheets',
    sku: 'PLT-10MM',
    brandOrSpec: 'HR plate',
    qty: 2400,
    reorderPoint: 500,
  },
  {
    name: 'GI Sheet 0.50mm (8x4 ft)',
    unit: 'sheet',
    rate: 820,
    costPrice: 680,
    mrp: 950,
    hsn: '7210',
    gstRate: 18,
    category: 'MS plates & sheets',
    sku: 'GI-050-84',
    brandOrSpec: 'Galvanised corrugated / plain',
    qty: 420,
    reorderPoint: 80,
  },
  // Pipes & fittings (HSN 7306 / 7307)
  {
    name: 'GI Pipe 1/2 inch Medium',
    unit: 'rmt',
    rate: 95,
    costPrice: 78,
    mrp: 115,
    hsn: '7306',
    gstRate: 18,
    category: 'Pipes & fittings',
    sku: 'GIP-05-M',
    brandOrSpec: 'IS 1239 Medium class',
    qty: 1600,
    reorderPoint: 300,
  },
  {
    name: 'GI Pipe 1 inch Medium',
    unit: 'rmt',
    rate: 185,
    costPrice: 155,
    mrp: 220,
    hsn: '7306',
    gstRate: 18,
    category: 'Pipes & fittings',
    sku: 'GIP-1-M',
    brandOrSpec: 'IS 1239 Medium class',
    qty: 1200,
    reorderPoint: 250,
  },
  {
    name: 'MS ERW Pipe 50mm NB',
    unit: 'rmt',
    rate: 310,
    costPrice: 260,
    mrp: 360,
    hsn: '7306',
    gstRate: 18,
    category: 'Pipes & fittings',
    sku: 'ERW-50',
    brandOrSpec: 'Black ERW pipe',
    qty: 900,
    reorderPoint: 150,
  },
  // Fasteners & general hardware (HSN 7318 / 8302)
  {
    name: 'Hex Bolt M12x50 with Nut (box of 50)',
    unit: 'box',
    rate: 480,
    costPrice: 360,
    mrp: 560,
    hsn: '7318',
    gstRate: 18,
    category: 'Fasteners',
    sku: 'BOLT-M12-50',
    brandOrSpec: 'Grade 4.6 zinc plated',
    qty: 180,
    reorderPoint: 40,
  },
  {
    name: 'Self-Tapping Screw 1.5 inch (box of 100)',
    unit: 'box',
    rate: 160,
    costPrice: 110,
    mrp: 190,
    hsn: '7318',
    gstRate: 18,
    category: 'Fasteners',
    sku: 'SCR-15-100',
    brandOrSpec: 'Phillips CSK',
    qty: 260,
    reorderPoint: 50,
  },
  {
    name: 'Hinge 4 inch MS (pair)',
    unit: 'pair',
    rate: 45,
    costPrice: 28,
    mrp: 55,
    hsn: '8302',
    gstRate: 18,
    category: 'General hardware',
    sku: 'HNG-4IN',
    brandOrSpec: 'Butt hinge',
    qty: 500,
    reorderPoint: 100,
  },
  {
    name: 'Tower Bolt 6 inch',
    unit: 'nos',
    rate: 55,
    costPrice: 35,
    mrp: 70,
    hsn: '8302',
    gstRate: 18,
    category: 'General hardware',
    sku: 'TB-6IN',
    brandOrSpec: 'MS aldrop / tower bolt',
    qty: 350,
    reorderPoint: 60,
  },
  {
    name: 'Padlock 50mm Brass',
    unit: 'nos',
    rate: 180,
    costPrice: 120,
    mrp: 220,
    hsn: '8301',
    gstRate: 18,
    category: 'General hardware',
    sku: 'PAD-50',
    brandOrSpec: '3 keys',
    qty: 140,
    reorderPoint: 30,
  },
  // Cement-adjacent general store (HSN 2523 / 3816)
  {
    name: 'OPC 53 Grade Cement 50 kg',
    unit: 'bag',
    rate: 420,
    costPrice: 380,
    mrp: 450,
    hsn: '2523',
    gstRate: 28,
    category: 'Cement & binders',
    sku: 'CEM-OPC53',
    brandOrSpec: 'UltraTech / ACC equivalent',
    qty: 600,
    reorderPoint: 120,
  },
  {
    name: 'White Cement 1 kg',
    unit: 'pack',
    rate: 85,
    costPrice: 65,
    mrp: 99,
    hsn: '2523',
    gstRate: 28,
    category: 'Cement & binders',
    sku: 'CEM-WHT-1',
    brandOrSpec: 'Birla White pack',
    qty: 220,
    reorderPoint: 40,
  },
  {
    name: 'Tile Adhesive 20 kg',
    unit: 'bag',
    rate: 380,
    costPrice: 290,
    mrp: 450,
    hsn: '3816',
    gstRate: 18,
    category: 'Cement & binders',
    sku: 'ADH-TILE-20',
    brandOrSpec: 'Polymer modified',
    qty: 160,
    reorderPoint: 30,
  },
];

async function seedIronGeneral(passwordHash: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(
      `Already present: ${COMPANY_NAME} — ${OWNER_EMAIL} / ${OWNER_PHONE} (company ${existing.companyId})`,
    );
    return;
  }

  const byName = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (byName) {
    throw new Error(`Company "${COMPANY_NAME}" exists without ${OWNER_EMAIL} — aborting`);
  }

  const gstinTaken = await prisma.company.findFirst({ where: { gstin: GSTIN } });
  if (gstinTaken) {
    throw new Error(`GSTIN ${GSTIN} already used by ${gstinTaken.name} — aborting`);
  }

  const company = await prisma.company.create({
    data: {
      name: COMPANY_NAME,
      gstin: GSTIN,
      pan: 'AABCI5555I',
      state: 'Telangana',
      address: 'Industrial Estate, Jeedimetla, Hyderabad, Telangana 500055',
      subscriptionPlan: 'INVENTORY',
      subscriptionStatus: 'ACTIVE',
      inventoryProfile: InventoryBusinessProfile.WHOLESALE,
      inventoryVertical: InventoryVertical.WHOLESALER,
      trialStartsAt: new Date(Date.now() - 3 * 86_400_000),
      trialEndsAt: new Date(Date.now() + 362 * 86_400_000),
      lastPaymentAt: new Date(),
    },
  });

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Ramesh Ironworks',
      email: OWNER_EMAIL,
      role: Role.OWNER,
      phone: OWNER_PHONE,
      passwordHash,
    },
  });

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Suresh Godown',
      email: MANAGER_EMAIL,
      role: Role.INVENTORY_MANAGER,
      phone: MANAGER_PHONE,
      passwordHash,
    },
  });

  const project = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Main Store',
      code: 'IRON',
      type: ProjectType.MINI,
      status: ProjectStatus.IN_PROGRESS,
      clientName: company.name,
      budget: 0,
      createdBy: owner.id,
    },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { defaultProjectId: project.id },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: owner.id, role: Role.OWNER },
      { projectId: project.id, userId: manager.id, role: Role.INVENTORY_MANAGER },
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

  const mainLoc = await prisma.stockLocation.create({
    data: {
      companyId: company.id,
      projectId: project.id,
      name: 'Main Godown',
      code: 'MAIN',
      isDefault: true,
      address: company.address,
    },
  });

  const yardLoc = await prisma.stockLocation.create({
    data: {
      companyId: company.id,
      projectId: project.id,
      name: 'Yard Stack',
      code: 'YARD',
      isDefault: false,
      address: 'Open yard — Jeedimetla IE',
    },
  });

  for (const [i, item] of CATALOG.entries()) {
    const distributorRate = Math.round(item.rate * 0.92 * 100) / 100;
    const r = await prisma.resource.create({
      data: {
        companyId: company.id,
        name: item.name,
        type: ResourceType.MATERIAL,
        unit: item.unit,
        rate: item.rate,
        costPrice: item.costPrice,
        mrp: item.mrp,
        avgCost: item.costPrice,
        distributorRate,
        customerRate: item.rate,
        brandOrSpec: item.brandOrSpec,
        hsnSacCode: item.hsn,
        gstRate: item.gstRate,
        category: item.category,
        sku: item.sku,
        itemCode: item.sku,
        reorderPoint: item.reorderPoint,
        trackingMode: ResourceTrackingMode.NONE,
        lastRateUpdatedAt: new Date(),
      },
    });

    // Heavy steel mostly in yard; hardware/cement in main godown.
    const yardCategories = new Set(['TMT & reinforcement', 'MS sections', 'MS plates & sheets']);
    if (yardCategories.has(item.category)) {
      const yardQty = Math.round(item.qty * 0.65);
      const mainQty = item.qty - yardQty;
      await applyStockIn(yardLoc.id, `seed-IRON-yard-${i}`, [{ resourceId: r.id, quantity: yardQty }]);
      if (mainQty > 0) {
        await applyStockIn(mainLoc.id, `seed-IRON-main-${i}`, [{ resourceId: r.id, quantity: mainQty }]);
      }
    } else {
      await applyStockIn(mainLoc.id, `seed-IRON-main-${i}`, [{ resourceId: r.id, quantity: item.qty }]);
    }
  }

  // Demo vendors + trade customers for wholesale flow.
  await prisma.vendor.createMany({
    data: [
      {
        companyId: company.id,
        name: 'Vizag Steel Depot',
        businessName: 'Vizag Steel Depot',
        phone: '+919876501111',
        gstin: '37AABCV1111V1Z1',
        billingAddress: 'Visakhapatnam, Andhra Pradesh',
        paymentTerms: 'Net 15',
        isActive: true,
      },
      {
        companyId: company.id,
        name: 'Hyderabad Fasteners Hub',
        businessName: 'Hyderabad Fasteners Hub',
        phone: '+919876501112',
        gstin: '36AABCH2222H1Z2',
        billingAddress: 'Kukatpally, Hyderabad',
        paymentTerms: 'Net 7',
        isActive: true,
      },
    ],
  });

  await prisma.customer.createMany({
    data: [
      {
        companyId: company.id,
        name: 'Deccan Builders Pvt Ltd',
        businessName: 'Deccan Builders Pvt Ltd',
        phone: '+919876501201',
        gstin: '36AABCD3333D1Z3',
        billingAddress: 'Gachibowli, Hyderabad',
        paymentTerms: 'Net 30',
        creditLimit: 750000,
        buyerRole: 'CUSTOMER',
        isActive: true,
      },
      {
        companyId: company.id,
        name: 'City Hardware Retail Chain',
        businessName: 'City Hardware Retail Chain',
        phone: '+919876501202',
        gstin: '36AABCR4444R1Z4',
        billingAddress: 'Secunderabad, Telangana',
        paymentTerms: 'Net 15',
        creditLimit: 400000,
        buyerRole: 'DISTRIBUTOR',
        isActive: true,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded ${COMPANY_NAME}`);
  // eslint-disable-next-line no-console
  console.log(`  Owner:   ${OWNER_EMAIL} / ${OWNER_PHONE}`);
  // eslint-disable-next-line no-console
  console.log(`  Manager: ${MANAGER_EMAIL} / ${MANAGER_PHONE}`);
  // eslint-disable-next-line no-console
  console.log(`  Items:   ${CATALOG.length} SKUs with HSN · 2 warehouses · 2 vendors · 2 customers`);
  // eslint-disable-next-line no-console
  console.log(`  Add to OTP_TEST_PHONES: ${OWNER_PHONE},${MANAGER_PHONE}`);
}

async function main(): Promise<void> {
  await ensureReachableDatabaseUrl();
  prisma = new PrismaClient();

  const before = await snapshotProtected();
  // eslint-disable-next-line no-console
  console.log('Protected tenants before:', before || '(none in DB)');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await seedIronGeneral(passwordHash);

  const after = await snapshotProtected();
  if (before !== after) {
    throw new Error('Protected tenant snapshot changed — abort investigation needed');
  }
  // eslint-disable-next-line no-console
  console.log('Protected tenants unchanged.');
  // eslint-disable-next-line no-console
  console.log('Done. OTP 111111 (if phone on OTP_TEST_PHONES) · password', PASSWORD);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('seed-iron-general failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
