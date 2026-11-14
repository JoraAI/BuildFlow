/**
 * Additive seed: create Kirana + Lumina demo tenants ONLY.
 *
 * Never truncates. Skips if already present. Does not touch creamy kulfi / Frosty / Reddy.
 *
 *   cd apps/backend && pnpm exec tsx prisma/seed-kirana-lumina.ts
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
const KIRANA_COMPANY_ID = '00000000-0000-4000-8000-000000000000';
const PROTECTED_NAMES = ['The creamy kulfi', 'Frosty Cups Ice Creams', 'Reddy Constructions Pvt Ltd'];

/** Neon from WSL often needs hostaddr; set before any PrismaClient is constructed. */
async function ensureReachableDatabaseUrl(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const u = new URL(raw);
  const hostname = u.hostname;
  if (!hostname || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return;

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
        referenceType: 'GRN',
        referenceId,
      },
    });
  }
}

async function snapshotProtected(): Promise<string> {
  const rows = await prisma.company.findMany({
    where: { name: { in: PROTECTED_NAMES } },
    select: {
      name: true,
      inventoryVertical: true,
      users: { where: { isActive: true }, select: { email: true, phone: true } },
    },
  });
  return JSON.stringify(
    rows
      .map((c) => ({
        name: c.name,
        vertical: c.inventoryVertical,
        users: c.users.map((u) => `${u.email}|${u.phone}`).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

async function patchKiranaHsn(companyId: string): Promise<void> {
  const patches: Array<{ itemCode: string; hsn: string; gstRate: number; name?: string }> = [
    { itemCode: 'KIR-001', hsn: '1101', gstRate: 5 },
    { itemCode: 'KIR-005', hsn: '1006', gstRate: 5, name: 'Basmati Rice 5 kg' },
    { itemCode: 'KIR-015', hsn: '1517', gstRate: 5, name: 'Groundnut Oil 1 L' },
    { itemCode: 'KIR-019', hsn: '1701', gstRate: 5 },
    { itemCode: 'KIR-021', hsn: '2501', gstRate: 5, name: 'Iodised Salt 1 kg' },
    { itemCode: 'KIR-035', hsn: '0401', gstRate: 5, name: 'Milk Pouch 500 ml' },
  ];
  for (const p of patches) {
    await prisma.resource.updateMany({
      where: { companyId, itemCode: p.itemCode },
      data: {
        hsnSacCode: p.hsn,
        gstRate: p.gstRate,
        ...(p.name ? { name: p.name } : {}),
      },
    });
  }
}

async function patchLuminaHsn(companyId: string): Promise<void> {
  const bySku: Record<string, { hsn: string; gstRate: number }> = {
    'BULB-9W-WW': { hsn: '8539', gstRate: 18 },
    'BULB-12W-CD': { hsn: '8539', gstRate: 18 },
    'BULB-ED-40W': { hsn: '8539', gstRate: 18 },
    'BULB-RGB-15W': { hsn: '8539', gstRate: 18 },
    'FLD-50W-IP65': { hsn: '9405', gstRate: 18 },
    'HB-100W': { hsn: '9405', gstRate: 18 },
    'STRIP-5M-RGB': { hsn: '9405', gstRate: 18 },
    'PAR-36-DMX': { hsn: '9405', gstRate: 18 },
    'HAL-500W': { hsn: '9405', gstRate: 18 },
    'CHAN-6ARM': { hsn: '9405', gstRate: 18 },
    'CBL-TRUSS-10M': { hsn: '8544', gstRate: 18 },
    'DIM-1000W': { hsn: '8536', gstRate: 18 },
    'FAIRY-20M-WW': { hsn: '9405', gstRate: 18 },
    'SPK-10W-GRN': { hsn: '9405', gstRate: 18 },
    'GU10-7W-WW': { hsn: '8539', gstRate: 18 },
    'TUBE-T8-20W': { hsn: '9405', gstRate: 18 },
    'EXT-16A-5M': { hsn: '8536', gstRate: 18 },
  };
  for (const [sku, meta] of Object.entries(bySku)) {
    await prisma.resource.updateMany({
      where: { companyId, OR: [{ sku }, { itemCode: sku }] },
      data: { hsnSacCode: meta.hsn, gstRate: meta.gstRate },
    });
  }
}

async function seedKirana(passwordHash: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: 'owner@kirana-demo.com' } });
  if (existing) {
    await patchKiranaHsn(existing.companyId);
    // eslint-disable-next-line no-console
    console.log('Kirana already present — patched HSN/GST on items');
    return;
  }

  const company = await prisma.company.upsert({
    where: { id: KIRANA_COMPANY_ID },
    update: {},
    create: {
      id: KIRANA_COMPANY_ID,
      name: 'Shri Ganesh Kirana & General Store',
      gstin: '36AABCK7777K1Z7',
      pan: 'AABCK7777K',
      state: 'Telangana',
      address: 'Charminar, Hyderabad',
      subscriptionPlan: 'INVENTORY',
      subscriptionStatus: 'ACTIVE',
      inventoryProfile: InventoryBusinessProfile.RETAIL,
      inventoryVertical: InventoryVertical.RETAILER,
      trialStartsAt: new Date(Date.now() - 7 * 86_400_000),
      trialEndsAt: new Date(Date.now() + 358 * 86_400_000),
      lastPaymentAt: new Date(),
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@kirana-demo.com' },
    update: { companyId: company.id, phone: '+919900000010', passwordHash },
    create: {
      companyId: company.id,
      name: 'Ganesh Kirana',
      email: 'owner@kirana-demo.com',
      role: Role.OWNER,
      phone: '+919900000010',
      passwordHash,
    },
  });

  const project = await prisma.project.upsert({
    where: { companyId_code: { code: 'KIRANA', companyId: company.id } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Main Store',
      code: 'KIRANA',
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

  const stockedItemCount = await prisma.stockBalance.count({
    where: { location: { companyId: company.id }, quantity: { gt: 0 } },
  });
  if (stockedItemCount === 0) {
    // HSN/GST aligned with kirana-catalog-data.ts (suggested codes).
    const samples = [
      { name: 'Wheat Atta 5 kg', itemCode: 'KIR-001', unit: 'bag', rate: 335, mrp: 350, qty: 12, hsn: '1101', gstRate: 5, category: 'Staples & grains' },
      { name: 'Basmati Rice 5 kg', itemCode: 'KIR-005', unit: 'bag', rate: 499, mrp: 520, qty: 10, hsn: '1006', gstRate: 5, category: 'Staples & grains' },
      { name: 'Groundnut Oil 1 L', itemCode: 'KIR-015', unit: 'bottle', rate: 180, mrp: 190, qty: 18, hsn: '1517', gstRate: 5, category: 'Staples & grains' },
      { name: 'Sugar 1 kg', itemCode: 'KIR-019', unit: 'pack', rate: 52, mrp: 55, qty: 30, hsn: '1701', gstRate: 5, category: 'Staples & grains' },
      { name: 'Iodised Salt 1 kg', itemCode: 'KIR-021', unit: 'pack', rate: 26, mrp: 28, qty: 40, hsn: '2501', gstRate: 5, category: 'Staples & grains' },
      { name: 'Milk Pouch 500 ml', itemCode: 'KIR-035', unit: 'pouch', rate: 30, mrp: 32, qty: 35, hsn: '0401', gstRate: 5, category: 'Daily essentials', trackingMode: ResourceTrackingMode.BATCH_EXPIRY },
    ];
    const loc = await prisma.stockLocation.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        name: 'Main Store',
        code: 'MAIN',
        isDefault: true,
      },
    });
    for (const [i, s] of samples.entries()) {
      const r = await prisma.resource.create({
        data: {
          companyId: company.id,
          name: s.name,
          type: ResourceType.MATERIAL,
          unit: s.unit,
          rate: s.rate,
          mrp: s.mrp,
          costPrice: Math.round(s.rate * 0.85),
          avgCost: Math.round(s.rate * 0.85),
          gstRate: s.gstRate,
          hsnSacCode: s.hsn,
          itemCode: s.itemCode,
          sku: s.itemCode,
          category: s.category,
          trackingMode: s.trackingMode ?? ResourceTrackingMode.NONE,
          lastRateUpdatedAt: new Date(),
        },
      });
      await applyStockIn(loc.id, `seed-KIRANA-open-${i}`, [{ resourceId: r.id, quantity: s.qty }]);
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seeded Kirana: owner@kirana-demo.com / +919900000010');
}

async function seedLumina(passwordHash: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: 'owner@luminalighting.com' } });
  if (existing) {
    await patchLuminaHsn(existing.companyId);
    // eslint-disable-next-line no-console
    console.log('Lumina already present — patched HSN/GST on items');
    return;
  }

  const gstinTaken = await prisma.company.findFirst({ where: { gstin: '36AABCL9999L1Z8' } });
  if (gstinTaken) {
    throw new Error(`Lumina GSTIN already used by company ${gstinTaken.name} — aborting`);
  }

  const company = await prisma.company.create({
    data: {
      name: 'Lumina Lighting & Event Electricals',
      gstin: '36AABCL9999L1Z8',
      pan: 'AABCL9999L',
      state: 'Telangana',
      address: 'Plot 42, Hitec City Main Road, Madhapur, Hyderabad, Telangana 500081',
      subscriptionPlan: 'INVENTORY',
      subscriptionStatus: 'ACTIVE',
      inventoryProfile: InventoryBusinessProfile.WHOLESALE,
      inventoryVertical: InventoryVertical.WHOLESALER,
      trialStartsAt: new Date(Date.now() - 7 * 86_400_000),
      trialEndsAt: new Date(Date.now() + 358 * 86_400_000),
      lastPaymentAt: new Date(),
    },
  });

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Ananya Sharma',
      email: 'owner@luminalighting.com',
      role: Role.OWNER,
      phone: '+919900000011',
      passwordHash,
    },
  });
  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Karthik Rao',
      email: 'manager@luminalighting.com',
      role: Role.INVENTORY_MANAGER,
      phone: '+919900000012',
      passwordHash,
    },
  });

  const storeProject = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Main Store',
      code: 'LUMINA',
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

  // HSN: bulbs/lamps 8539, luminaires/fixtures 9405, cables 8544, switches 8536.
  const catalog = [
    { name: 'Warm White LED Bulb 9W (B22)', unit: 'nos', rate: 110, costPrice: 65, mrp: 140, category: 'Bulbs & Lamps', sku: 'BULB-9W-WW', brandOrSpec: 'Havells B22 3000K', reorderPoint: 50, hsn: '8539', gstRate: 18 },
    { name: 'Cool Daylight LED Bulb 12W (E27)', unit: 'nos', rate: 145, costPrice: 85, mrp: 180, category: 'Bulbs & Lamps', sku: 'BULB-12W-CD', brandOrSpec: 'Philips E27 6500K', reorderPoint: 40, hsn: '8539', gstRate: 18 },
    { name: 'Vintage Edison Filament Bulb 40W (ST64)', unit: 'nos', rate: 280, costPrice: 150, mrp: 350, category: 'Decorative Bulbs', sku: 'BULB-ED-40W', brandOrSpec: 'Amber Glow Warm ST64', reorderPoint: 20, hsn: '8539', gstRate: 18 },
    { name: 'RGB Smart WiFi Dimmable Bulb 15W', unit: 'nos', rate: 650, costPrice: 380, mrp: 799, category: 'Smart Lighting', sku: 'BULB-RGB-15W', brandOrSpec: 'Syska Smart 16M Colors', reorderPoint: 15, hsn: '8539', gstRate: 18 },
    { name: '50W Outdoor Waterproof LED Flood Light IP65', unit: 'nos', rate: 1250, costPrice: 750, mrp: 1600, category: 'Outdoor & Stage', sku: 'FLD-50W-IP65', brandOrSpec: 'IP65 Die-Cast Aluminum', reorderPoint: 10, hsn: '9405', gstRate: 18 },
    { name: '100W High-Bay Industrial LED Light', unit: 'nos', rate: 2800, costPrice: 1800, mrp: 3400, category: 'Industrial Fixtures', sku: 'HB-100W', brandOrSpec: 'UFO High Bay 140 lm/W', reorderPoint: 5, hsn: '9405', gstRate: 18 },
    { name: '5m RGB LED Strip Light with Controller', unit: 'roll', rate: 480, costPrice: 260, mrp: 650, category: 'Strips & Accents', sku: 'STRIP-5M-RGB', brandOrSpec: 'SMD5050 Waterproof IP67', reorderPoint: 25, hsn: '9405', gstRate: 18 },
    { name: 'Stage Spot Par Can Light 36x3W DMX', unit: 'nos', rate: 3200, costPrice: 2100, mrp: 4000, category: 'Stage & Events', sku: 'PAR-36-DMX', brandOrSpec: 'RGBW DMX512 Master-Slave', reorderPoint: 8, hsn: '9405', gstRate: 18 },
    { name: 'Halogen Studio Flood Light 500W', unit: 'nos', rate: 850, costPrice: 480, mrp: 1100, category: 'Outdoor & Stage', sku: 'HAL-500W', brandOrSpec: 'Heavy Duty Metal Reflector', reorderPoint: 12, hsn: '9405', gstRate: 18 },
    { name: 'Modern Crystal Chandelier 6-Arm E14', unit: 'nos', rate: 14500, costPrice: 9500, mrp: 18000, category: 'Chandeliers', sku: 'CHAN-6ARM', brandOrSpec: 'K9 Crystal Chrome Finish', reorderPoint: 2, hsn: '9405', gstRate: 18 },
    { name: 'Heavy-Duty Stage Truss Cable 10m', unit: 'nos', rate: 750, costPrice: 420, mrp: 950, category: 'Cables & Accessories', sku: 'CBL-TRUSS-10M', brandOrSpec: '3-Core 2.5 sq mm Rubber', reorderPoint: 15, hsn: '8544', gstRate: 18 },
    { name: 'Rotary Dimmer Switch 1000W', unit: 'nos', rate: 390, costPrice: 210, mrp: 499, category: 'Switches & Dimmers', sku: 'DIM-1000W', brandOrSpec: 'Smooth Triac Dimmer', reorderPoint: 20, hsn: '8536', gstRate: 18 },
    { name: 'Fairy Decorative Rice Lights 20m Warm White', unit: 'nos', rate: 220, costPrice: 110, mrp: 299, category: 'Decorative Bulbs', sku: 'FAIRY-20M-WW', brandOrSpec: 'Copper Wire 200 LEDs', reorderPoint: 30, hsn: '9405', gstRate: 18 },
    { name: 'Spike Garden Spotlight 10W', unit: 'nos', rate: 580, costPrice: 320, mrp: 750, category: 'Outdoor & Stage', sku: 'SPK-10W-GRN', brandOrSpec: 'IP67 Ground Spike Warm', reorderPoint: 15, hsn: '9405', gstRate: 18 },
    { name: 'GU10 Warm White Spotlight 7W', unit: 'nos', rate: 160, costPrice: 90, mrp: 210, category: 'Bulbs & Lamps', sku: 'GU10-7W-WW', brandOrSpec: '38-degree Beam 3000K', reorderPoint: 35, hsn: '8539', gstRate: 18 },
    { name: 'T8 LED Tube Light 4ft 20W', unit: 'nos', rate: 240, costPrice: 130, mrp: 300, category: 'Commercial Fixtures', sku: 'TUBE-T8-20W', brandOrSpec: 'Batten Tube Fixture', reorderPoint: 40, hsn: '9405', gstRate: 18 },
    { name: '16A Extension Power Strip 5m', unit: 'nos', rate: 620, costPrice: 350, mrp: 799, category: 'Cables & Accessories', sku: 'EXT-16A-5M', brandOrSpec: 'Surge Protected 4-Socket', reorderPoint: 20, hsn: '8536', gstRate: 18 },
  ];
  const openingQtys = [250, 180, 80, 60, 45, 20, 100, 24, 30, 6, 50, 60, 120, 40, 90, 150, 60];

  const resources: { id: string }[] = [];
  for (const m of catalog) {
    const distributorRate = Math.round(m.rate * 0.9 * 100) / 100;
    const r = await prisma.resource.create({
      data: {
        companyId: company.id,
        name: m.name,
        type: ResourceType.MATERIAL,
        unit: m.unit,
        rate: m.rate,
        costPrice: m.costPrice,
        mrp: m.mrp,
        distributorRate,
        customerRate: m.rate,
        brandOrSpec: m.brandOrSpec,
        avgCost: m.costPrice,
        gstRate: m.gstRate,
        hsnSacCode: m.hsn,
        category: m.category,
        sku: m.sku,
        itemCode: m.sku,
        reorderPoint: m.reorderPoint,
        trackingMode: ResourceTrackingMode.NONE,
        lastRateUpdatedAt: new Date(),
      },
    });
    resources.push({ id: r.id });
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
    if (!resources[i]) continue;
    await applyStockIn(mainLoc.id, `seed-LUMINA-open-${i}`, [
      { resourceId: resources[i]!.id, quantity: qty },
    ]);
  }

  const staging = await prisma.stockLocation.create({
    data: {
      companyId: company.id,
      projectId: storeProject.id,
      name: 'Event Staging & Rental Depot',
      code: 'STAGING',
      address: 'Madhapur Near HITEX Exhibition Centre, Hyderabad',
      isDefault: false,
    },
  });
  for (const st of [
    { itemIndex: 0, quantity: 100 },
    { itemIndex: 2, quantity: 50 },
    { itemIndex: 4, quantity: 25 },
    { itemIndex: 6, quantity: 40 },
    { itemIndex: 7, quantity: 18 },
  ]) {
    await applyStockIn(staging.id, `seed-LUMINA-staging-${st.itemIndex}`, [
      { resourceId: resources[st.itemIndex]!.id, quantity: st.quantity },
    ]);
  }

  await prisma.customer.createMany({
    data: [
      {
        companyId: company.id,
        name: 'Grand Royale Events & Decors',
        businessName: 'Grand Royale Events Private Limited',
        gstin: '36AABCG9999G1Z1',
        phone: '+919876500001',
        email: 'events@grandroyale.com',
        paymentTerms: 'Net 30',
        creditLimit: 350000,
        isActive: true,
      },
      {
        companyId: company.id,
        name: 'Skyline Convention & Banquet Centre',
        businessName: 'Skyline Hospitality Hubs LLP',
        gstin: '36AABCS8888S1Z2',
        phone: '+919876500002',
        email: 'banquets@skylinehub.com',
        paymentTerms: 'Net 15',
        creditLimit: 500000,
        isActive: true,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seeded Lumina: owner@luminalighting.com / +919900000011, manager@luminalighting.com / +919900000012');
}

async function main(): Promise<void> {
  await ensureReachableDatabaseUrl();
  prisma = new PrismaClient();

  const before = await snapshotProtected();
  // eslint-disable-next-line no-console
  console.log('Protected tenants before:', before);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await seedKirana(passwordHash);
  await seedLumina(passwordHash);

  const after = await snapshotProtected();
  if (before !== after) {
    throw new Error('Protected tenant snapshot changed — abort investigation needed');
  }
  // eslint-disable-next-line no-console
  console.log('Protected tenants unchanged after seed.');
  // eslint-disable-next-line no-console
  console.log('Done. OTP 111111 · password', PASSWORD);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('seed-kirana-lumina failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
