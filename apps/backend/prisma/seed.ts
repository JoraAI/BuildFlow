/**
 * BuildFlow — Database seed.
 *
 * Creates the sample company "Reddy Constructions Pvt Ltd" + 4 users (one per role),
 * realistic resources, 5 rate analyses, and 3 projects.
 *
 * Idempotent-ish: uses upsert on unique fields. Re-running updates in place.
 */
import { PrismaClient, Role, ProjectType, ProjectStatus, ResourceType, InvoiceStatus, CostType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'BuildFlow@2025';

async function main(): Promise<void> {
  // ----------------------------------------------------------------
  // Reset — truncate all tables for a clean, idempotent seed run
  // ----------------------------------------------------------------
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
  if (tableNames) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`,
    );
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ----------------------------------------------------------------
  // Company + Users
  // ----------------------------------------------------------------
  const company = await prisma.company.upsert({
    where: { gstin: '36AABCR1234A1Z5' },
    update: {},
    create: {
      name: 'Reddy Constructions Pvt Ltd',
      gstin: '36AABCR1234A1Z5',
      pan: 'AABCR1234A',
      state: 'Telangana',
      address: 'Banjara Hills, Hyderabad, Telangana 500034',
    },
  });

  const users = await Promise.all(
    [
      { name: 'Sai Reddy', email: 'owner@reddyconst.com', role: Role.OWNER },
      { name: 'Ravi Kumar', email: 'pm@reddyconst.com', role: Role.PM },
      { name: 'Mahesh Singh', email: 'site@reddyconst.com', role: Role.SUPERVISOR },
      { name: 'Priya Sharma', email: 'accounts@reddyconst.com', role: Role.ACCOUNTANT },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, companyId: company.id, passwordHash },
      }),
    ),
  );
  const [owner, pm, supervisor] = users;

  // ----------------------------------------------------------------
  // Resources (realistic Indian 2025 rates)
  // ----------------------------------------------------------------
  const resourceSeed: Array<{ name: string; type: ResourceType; unit: string; rate: number; gstRate: number; hsn?: string; category: string }> = [
    { name: 'OPC Cement 53G', type: ResourceType.MATERIAL, unit: 'bag', rate: 420, gstRate: 28, hsn: '2523', category: 'Cement' },
    { name: 'TMT Steel Fe500', type: ResourceType.MATERIAL, unit: 'kg', rate: 72, gstRate: 18, hsn: '7213', category: 'Steel' },
    { name: 'River Sand', type: ResourceType.MATERIAL, unit: 'cum', rate: 1800, gstRate: 5, hsn: '2505', category: 'Aggregates' },
    { name: '20mm Aggregate', type: ResourceType.MATERIAL, unit: 'cum', rate: 1400, gstRate: 5, hsn: '2517', category: 'Aggregates' },
    { name: 'Fly Ash Bricks', type: ResourceType.MATERIAL, unit: 'piece', rate: 8, gstRate: 5, hsn: '6810', category: 'Bricks' },
    { name: 'Mason Grade 1', type: ResourceType.LABOUR, unit: 'day', rate: 750, gstRate: 0, category: 'Skilled' },
    { name: 'Mason Grade 2', type: ResourceType.LABOUR, unit: 'day', rate: 650, gstRate: 0, category: 'Skilled' },
    { name: 'Carpenter', type: ResourceType.LABOUR, unit: 'day', rate: 800, gstRate: 0, category: 'Skilled' },
    { name: 'Unskilled Labour', type: ResourceType.LABOUR, unit: 'day', rate: 450, gstRate: 0, category: 'Unskilled' },
    { name: 'Concrete Mixer 200L', type: ResourceType.EQUIPMENT, unit: 'day', rate: 1800, gstRate: 18, hsn: '8474', category: 'Mixing' },
    { name: 'Concrete Vibrator', type: ResourceType.EQUIPMENT, unit: 'day', rate: 600, gstRate: 18, hsn: '8474', category: 'Vibration' },
    { name: 'JCB Excavator', type: ResourceType.EQUIPMENT, unit: 'day', rate: 12000, gstRate: 18, hsn: '8429', category: 'Earthwork' },
  ];

  const resources: Record<string, { id: string }> = {};
  for (const r of resourceSeed) {
    const created = await prisma.resource.upsert({
      where: {
        companyId_name_type: { companyId: company.id, name: r.name, type: r.type },
      },
      update: { rate: r.rate, gstRate: r.gstRate, hsnSacCode: r.hsn, lastRateUpdatedAt: new Date() },
      create: {
        companyId: company.id,
        name: r.name,
        type: r.type,
        unit: r.unit,
        rate: r.rate,
        gstRate: r.gstRate,
        hsnSacCode: r.hsn,
        category: r.category,
        lastRateUpdatedAt: new Date(),
      },
    });
    resources[r.name] = created;
  }

  // ----------------------------------------------------------------
  // Rate Analyses (seed 3 of the 5 from spec)
  // ----------------------------------------------------------------
  type Component = {
    resourceName?: string;
    miscName?: string;
    quantityPerUnit: number;
    unit: string;
    rate: number;
    type: CostType;
  };

  async function seedRateAnalysis(name: string, unit: string, description: string, components: Component[]) {
    let total = 0;
    for (const c of components) total += c.quantityPerUnit * c.rate;
    return prisma.rateAnalysis.create({
      data: {
        companyId: company.id,
        name,
        unit,
        description,
        totalRate: total,
        components: {
          create: components.map((c) => ({
            resourceId: c.resourceName ? resources[c.resourceName]?.id : null,
            miscName: c.miscName ?? null,
            quantityPerUnit: c.quantityPerUnit,
            unit: c.unit,
            rate: c.rate,
            amount: c.quantityPerUnit * c.rate,
            type: c.type,
          })),
        },
      },
    });
  }

  await seedRateAnalysis(
    'RCC M25 with Fe500 TMT',
    'cum',
    'M25 grade RCC (1:1:2) with Fe500 TMT steel reinforcement',
    [
      { resourceName: 'OPC Cement 53G', quantityPerUnit: 6.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'TMT Steel Fe500', quantityPerUnit: 78, unit: 'kg', rate: 72, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1', quantityPerUnit: 0.8, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour', quantityPerUnit: 2.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Vibrator', quantityPerUnit: 0.5, unit: 'day', rate: 600, type: CostType.EQUIPMENT },
      { miscName: 'Shuttering', quantityPerUnit: 1, unit: 'ls', rate: 850, type: CostType.MISC },
    ],
  );

  await seedRateAnalysis(
    'PCC M15 (1:2:4)',
    'cum',
    'Plain cement concrete M15 grade',
    [
      { resourceName: 'OPC Cement 53G', quantityPerUnit: 3.4, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand', quantityPerUnit: 0.42, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: '20mm Aggregate', quantityPerUnit: 0.84, unit: 'cum', rate: 1400, type: CostType.MATERIAL },
      { resourceName: 'Unskilled Labour', quantityPerUnit: 1.5, unit: 'day', rate: 450, type: CostType.LABOUR },
      { resourceName: 'Concrete Mixer 200L', quantityPerUnit: 0.3, unit: 'day', rate: 1800, type: CostType.EQUIPMENT },
    ],
  );

  await seedRateAnalysis(
    'Brick Masonry 230mm CM 1:6',
    'sqm',
    '230mm thick brick masonry in cement mortar 1:6',
    [
      { resourceName: 'Fly Ash Bricks', quantityPerUnit: 56, unit: 'piece', rate: 8, type: CostType.MATERIAL },
      { resourceName: 'OPC Cement 53G', quantityPerUnit: 0.5, unit: 'bag', rate: 420, type: CostType.MATERIAL },
      { resourceName: 'River Sand', quantityPerUnit: 0.03, unit: 'cum', rate: 1800, type: CostType.MATERIAL },
      { resourceName: 'Mason Grade 1', quantityPerUnit: 0.35, unit: 'day', rate: 750, type: CostType.LABOUR },
      { resourceName: 'Unskilled Labour', quantityPerUnit: 0.5, unit: 'day', rate: 450, type: CostType.LABOUR },
    ],
  );

  // ----------------------------------------------------------------
  // Project 1 — NH-65 Road Widening
  // ----------------------------------------------------------------
  const project1 = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'NH-65 Road Widening',
      code: 'NH65',
      type: ProjectType.HEAVY,
      status: ProjectStatus.IN_PROGRESS,
      clientName: 'NHAI',
      clientContact: 'pi@nhai.gov.in',
      locationLat: 17.385,
      locationLng: 78.4867,
      locationAddress: 'NH-65, Hyderabad, Telangana',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2026-06-30'),
      budget: 24_500_000,
      createdBy: owner.id,
    },
  });

  // Simple WBS + a few tasks with a predecessor for a meaningful critical path.
  const wbs1 = await prisma.wBSItem.create({
    data: { projectId: project1.id, code: '1.0', name: 'Site Mobilization', level: 1, orderIndex: 1 },
  });
  const t1 = await prisma.task.create({
    data: { projectId: project1.id, wbsId: wbs1.id, name: 'Site survey', startDate: new Date('2025-01-15'), endDate: new Date('2025-01-20'), durationDays: 5, progressPct: 100, status: 'COMPLETED', assignedTo: supervisor.id },
  });
  const t2 = await prisma.task.create({
    data: { projectId: project1.id, wbsId: wbs1.id, name: 'Clear & grub', startDate: new Date('2025-01-21'), endDate: new Date('2025-01-30'), durationDays: 10, progressPct: 100, status: 'COMPLETED', assignedTo: supervisor.id },
  });
  await prisma.taskPredecessor.create({ data: { taskId: t2.id, predecessorId: t1.id, type: 'FS', lagDays: 0 } });
  const t3 = await prisma.task.create({
    data: { projectId: project1.id, wbsId: wbs1.id, name: 'Earthwork excavation', startDate: new Date('2025-02-01'), endDate: new Date('2025-03-15'), durationDays: 43, progressPct: 60, status: 'IN_PROGRESS', assignedTo: supervisor.id },
  });
  await prisma.taskPredecessor.create({ data: { taskId: t3.id, predecessorId: t2.id, type: 'FS', lagDays: 0 } });

  // Sample invoices
  await prisma.invoice.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      invoiceNumber: 'INV-2025-001',
      clientName: 'NHAI',
      clientGstin: '36AAAGN0534G1ZH',
      invoiceDate: new Date('2025-02-28'),
      dueDate: new Date('2025-03-30'),
      status: InvoiceStatus.PAID,
      subtotal: 3_813_559,
      gstRate: 18,
      gstAmount: 686_441,
      total: 4_500_000,
      paidAmount: 4_500_000,
    },
  });

  // ----------------------------------------------------------------
  // Project 2 — Greenview Residency Block-C (planning)
  // ----------------------------------------------------------------
  await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Greenview Residency Block-C',
      code: 'GVR-C',
      type: ProjectType.MID,
      status: ProjectStatus.PLANNING,
      clientName: 'Greenview Developers',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-12-31'),
      budget: 0,
      createdBy: pm.id,
    },
  });

  // ----------------------------------------------------------------
  // Project 3 — TechPark Office Renovation (completed)
  // ----------------------------------------------------------------
  await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'TechPark Office Renovation',
      code: 'TPK-RENO',
      type: ProjectType.MINI,
      status: ProjectStatus.COMPLETED,
      clientName: 'TechPark Infra',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-09-30'),
      budget: 1_200_000,
      createdBy: pm.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete. Login passwords for all users:', PASSWORD);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });