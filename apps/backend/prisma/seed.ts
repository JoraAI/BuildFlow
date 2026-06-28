/**
 * BuildFlow - Database seed.
 *
 * Creates the sample company "Reddy Constructions Pvt Ltd" + 4 users (one per role),
 * realistic resources, 5 rate analyses, and 3 projects.
 *
 * Idempotent-ish: uses upsert on unique fields. Re-running updates in place.
 */
import { PrismaClient, Role, ProjectType, ProjectStatus, ResourceType, InvoiceStatus, CostType, EstimateStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Test@1234';
const PLATFORM_ADMIN_PASSWORD = 'Admin@1234';
const COMPANY_LOGO =
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=200&fit=crop&auto=format';

async function main(): Promise<void> {
  // ----------------------------------------------------------------
  // Reset - truncate all tables for a clean, idempotent seed run
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
      logoUrl: COMPANY_LOGO,
      subscriptionPlan: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      trialStartsAt: new Date(Date.now() - 30 * 86_400_000),
      trialEndsAt: new Date(Date.now() + 335 * 86_400_000),
    },
  });

  const users = await Promise.all(
    [
      { name: 'Sai Reddy', email: 'owner@reddyconst.com', role: Role.OWNER, phone: '+919876543210' },
      { name: 'Ravi Kumar', email: 'pm@reddyconst.com', role: Role.PM, phone: '+919876543211' },
      { name: 'Mahesh Singh', email: 'site@reddyconst.com', role: Role.SUPERVISOR, phone: '+919876543212' },
      { name: 'Priya Sharma', email: 'accounts@reddyconst.com', role: Role.ACCOUNTANT, phone: '+919876543213' },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { phone: u.phone },
        create: { ...u, companyId: company.id, passwordHash },
      }),
    ),
  );
  const [owner, pm, supervisor] = users;

  // Platform admin (BuildFlow internal)
  await prisma.platformAdmin.upsert({
    where: { email: 'admin@buildflow.com' },
    update: { passwordHash: await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 10), isActive: true },
    create: {
      email: 'admin@buildflow.com',
      name: 'BuildFlow Admin',
      passwordHash: await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 10),
    },
  });

  // Sample support tickets
  await prisma.companyIntegration.create({
    data: {
      companyId: company.id,
      provider: 'TALLY',
      configuredBy: owner.id,
      settings: {
        sales: 'Sales Account',
        purchase: 'Purchase Account',
        cgst: 'CGST Payable',
        sgst: 'SGST Payable',
        igst: 'IGST Payable',
        tdsPayable: 'TDS Payable',
        bank: 'HDFC Bank',
      },
    },
  });

  await prisma.supportTicket.create({
    data: {
      companyId: company.id,
      requesterId: pm.id,
      scope: 'COMPANY',
      category: 'PROFILE_CHANGE',
      subject: 'Update my role to include estimation access',
      description: 'I need PM role confirmed for estimation module access on all projects.',
      payload: { requestedRole: 'PM' },
      status: 'OPEN',
    },
  });
  await prisma.supportTicket.create({
    data: {
      companyId: company.id,
      requesterId: owner.id,
      scope: 'PLATFORM',
      category: 'BILLING',
      subject: 'Extend trial for new branch office',
      description: 'We opened a second site and need 14 more trial days while onboarding users.',
      status: 'ESCALATED',
    },
  });

  // ----------------------------------------------------------------
  // Resources (realistic Indian 2025 rates)
  // ----------------------------------------------------------------
  const resourceSeed: Array<{
    name: string;
    type: ResourceType;
    unit: string;
    rate: number;
    gstRate: number;
    hsn?: string;
    category: string;
    imageUrl?: string;
  }> = [
    {
      name: 'OPC Cement 53G',
      type: ResourceType.MATERIAL,
      unit: 'bag',
      rate: 420,
      gstRate: 28,
      hsn: '2523',
      category: 'Cement',
      imageUrl: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=400&h=400&fit=crop',
    },
    {
      name: 'TMT Steel Fe500',
      type: ResourceType.MATERIAL,
      unit: 'kg',
      rate: 72,
      gstRate: 18,
      hsn: '7213',
      category: 'Steel',
      imageUrl: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=400&fit=crop',
    },
    {
      name: 'River Sand',
      type: ResourceType.MATERIAL,
      unit: 'cum',
      rate: 1800,
      gstRate: 5,
      hsn: '2505',
      category: 'Aggregates',
      imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=400&fit=crop',
    },
    {
      name: '20mm Aggregate',
      type: ResourceType.MATERIAL,
      unit: 'cum',
      rate: 1400,
      gstRate: 5,
      hsn: '2517',
      category: 'Aggregates',
    },
    {
      name: 'Fly Ash Bricks',
      type: ResourceType.MATERIAL,
      unit: 'piece',
      rate: 8,
      gstRate: 5,
      hsn: '6810',
      category: 'Bricks',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=400&fit=crop',
    },
    {
      name: 'PPC Cement 43G',
      type: ResourceType.MATERIAL,
      unit: 'bag',
      rate: 395,
      gstRate: 28,
      hsn: '2523',
      category: 'Cement',
    },
    {
      name: '10mm Aggregate',
      type: ResourceType.MATERIAL,
      unit: 'cum',
      rate: 1350,
      gstRate: 5,
      hsn: '2517',
      category: 'Aggregates',
    },
    {
      name: 'M-Sand (Manufactured)',
      type: ResourceType.MATERIAL,
      unit: 'cum',
      rate: 1650,
      gstRate: 5,
      hsn: '2505',
      category: 'Aggregates',
    },
    {
      name: 'Binding Wire 18G',
      type: ResourceType.MATERIAL,
      unit: 'kg',
      rate: 68,
      gstRate: 18,
      hsn: '7217',
      category: 'Steel',
    },
    {
      name: 'TMT Steel Fe550',
      type: ResourceType.MATERIAL,
      unit: 'kg',
      rate: 74,
      gstRate: 18,
      hsn: '7213',
      category: 'Steel',
    },
    {
      name: 'Red Clay Bricks',
      type: ResourceType.MATERIAL,
      unit: 'piece',
      rate: 9,
      gstRate: 5,
      hsn: '6901',
      category: 'Bricks',
    },
    {
      name: 'AAC Blocks 600mm',
      type: ResourceType.MATERIAL,
      unit: 'piece',
      rate: 95,
      gstRate: 12,
      hsn: '6810',
      category: 'Bricks',
    },
    {
      name: 'Ready Mix Concrete M25',
      type: ResourceType.MATERIAL,
      unit: 'cum',
      rate: 5200,
      gstRate: 18,
      hsn: '3824',
      category: 'Other',
    },
    {
      name: 'Plaster of Paris',
      type: ResourceType.MATERIAL,
      unit: 'bag',
      rate: 320,
      gstRate: 18,
      hsn: '2520',
      category: 'Other',
    },
    {
      name: 'Wall Putty',
      type: ResourceType.MATERIAL,
      unit: 'bag',
      rate: 580,
      gstRate: 18,
      hsn: '3214',
      category: 'Other',
    },
    {
      name: 'Exterior Emulsion Paint',
      type: ResourceType.MATERIAL,
      unit: 'litre',
      rate: 420,
      gstRate: 18,
      hsn: '3209',
      category: 'Other',
    },
    {
      name: 'Waterproofing Compound',
      type: ResourceType.MATERIAL,
      unit: 'kg',
      rate: 185,
      gstRate: 18,
      hsn: '3824',
      category: 'Other',
    },
    {
      name: 'Plywood 18mm Commercial',
      type: ResourceType.MATERIAL,
      unit: 'sqft',
      rate: 62,
      gstRate: 18,
      hsn: '4412',
      category: 'Other',
    },
    {
      name: 'Concrete Admixture',
      type: ResourceType.MATERIAL,
      unit: 'litre',
      rate: 95,
      gstRate: 18,
      hsn: '3824',
      category: 'Other',
    },
    {
      name: 'GI Pipe 25mm',
      type: ResourceType.MATERIAL,
      unit: 'metre',
      rate: 145,
      gstRate: 18,
      hsn: '7306',
      category: 'Other',
    },
    {
      name: 'UPVC Pipe 110mm',
      type: ResourceType.MATERIAL,
      unit: 'metre',
      rate: 320,
      gstRate: 18,
      hsn: '3917',
      category: 'Other',
    },
    {
      name: 'Ceramic Floor Tile 600x600',
      type: ResourceType.MATERIAL,
      unit: 'sqft',
      rate: 48,
      gstRate: 18,
      hsn: '6907',
      category: 'Other',
    },
    {
      name: 'Granite Slab 20mm',
      type: ResourceType.MATERIAL,
      unit: 'sqft',
      rate: 185,
      gstRate: 18,
      hsn: '6802',
      category: 'Other',
    },
    {
      name: 'Aluminium Window Section',
      type: ResourceType.MATERIAL,
      unit: 'kg',
      rate: 285,
      gstRate: 18,
      hsn: '7610',
      category: 'Other',
    },
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
      update: { rate: r.rate, gstRate: r.gstRate, hsnSacCode: r.hsn, lastRateUpdatedAt: new Date(), imageUrl: r.imageUrl ?? undefined },
      create: {
        companyId: company.id,
        name: r.name,
        type: r.type,
        unit: r.unit,
        rate: r.rate,
        gstRate: r.gstRate,
        hsnSacCode: r.hsn,
        category: r.category,
        imageUrl: r.imageUrl,
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
  // Rate regions (regional material rate books)
  // ----------------------------------------------------------------
  const regionHyderabad = await prisma.rateRegion.create({
    data: {
      companyId: company.id,
      name: 'Telangana (Hyderabad)',
      state: 'Telangana',
    },
  });

  const regionApTier2 = await prisma.rateRegion.create({
    data: {
      companyId: company.id,
      name: 'AP Tier-2',
      state: 'Andhra Pradesh',
    },
  });

  const effectiveDate = new Date('2025-01-01');
  await prisma.regionalMaterialRate.createMany({
    data: [
      {
        regionId: regionHyderabad.id,
        resourceId: resources['OPC Cement 53G'].id,
        rate: 418,
        unit: 'bag',
        effectiveDate,
      },
      {
        regionId: regionHyderabad.id,
        resourceId: resources['River Sand'].id,
        rate: 1780,
        unit: 'cum',
        effectiveDate,
      },
      {
        regionId: regionApTier2.id,
        resourceId: resources['OPC Cement 53G'].id,
        rate: 438,
        unit: 'bag',
        effectiveDate,
      },
      {
        regionId: regionApTier2.id,
        resourceId: resources['TMT Steel Fe500'].id,
        rate: 74,
        unit: 'kg',
        effectiveDate,
      },
    ],
  });

  // ----------------------------------------------------------------
  // Project 1 - NH-65 Road Widening
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
      rateRegionId: regionHyderabad.id,
      createdBy: owner.id,
    },
  });

  await prisma.projectMaterialRate.create({
    data: {
      projectId: project1.id,
      resourceId: resources['OPC Cement 53G'].id,
      rate: 435,
      unit: 'bag',
      notes: 'Remote haulage included',
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

  // Project-scoped access (PM + supervisor on NH-65)
  await prisma.projectMember.createMany({
    data: [
      { projectId: project1.id, userId: owner.id, role: Role.OWNER },
      { projectId: project1.id, userId: pm.id, role: Role.PM },
      { projectId: project1.id, userId: supervisor.id, role: Role.SUPERVISOR },
    ],
  });

  const boqEarth = await prisma.bOQItem.create({
    data: {
      projectId: project1.id,
      itemCode: 'BOQ-001',
      description: 'Earthwork excavation',
      unit: 'cum',
      quantity: 1000,
      rate: 450,
      amount: 450_000,
      category: 'EARTHWORK',
    },
  });

  const boqPcc = await prisma.bOQItem.create({
    data: {
      projectId: project1.id,
      itemCode: 'BOQ-002',
      description: 'PCC M15',
      unit: 'cum',
      quantity: 200,
      rate: 5200,
      amount: 1_040_000,
      category: 'CONCRETE',
    },
  });

  await prisma.changeOrder.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      number: 'VO-001',
      title: 'Additional drainage layer',
      reason: 'Client directive for extra drain excavation',
      status: 'APPROVED',
      costImpact: 22_500,
      scheduleImpactDays: 5,
      linkedTaskId: t3.id,
      createdBy: pm.id,
      approvedBy: owner.id,
      approvedAt: new Date('2025-02-10'),
      lines: {
        create: [
          {
            boqItemId: boqEarth.id,
            description: 'Extra excavation for drain',
            unit: 'cum',
            qtyDelta: 50,
            rate: 450,
            amount: 22_500,
          },
        ],
      },
    },
  });

  await prisma.bOQItem.update({
    where: { id: boqEarth.id },
    data: { quantity: 1050, amount: 472_500 },
  });
  await prisma.project.update({
    where: { id: project1.id },
    data: { budget: 24_522_500 },
  });

  await prisma.invoice.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      invoiceNumber: 'RA-2025-001',
      clientName: 'NHAI',
      clientGstin: '36AAAGN0534G1ZH',
      invoiceDate: new Date('2025-03-31'),
      dueDate: new Date('2025-04-30'),
      status: InvoiceStatus.SENT,
      invoiceType: 'RUNNING_ACCOUNT',
      raSequence: 1,
      retentionPct: 5,
      subtotal: 200_800,
      previousCertifiedTotal: 0,
      currentCertifiedTotal: 200_800,
      cumulativeCertifiedTotal: 200_800,
      retentionAmount: 10_040,
      gstRate: 18,
      gstAmount: 36_144,
      total: 226_904,
      lineItems: {
        create: [
          {
            boqItemId: boqEarth.id,
            description: 'Earthwork excavation',
            unit: 'cum',
            quantity: 400,
            rate: 450,
            amount: 180_000,
            previousQty: 0,
            currentQty: 400,
            cumulativeQty: 400,
            certifiedAmount: 180_000,
          },
          {
            boqItemId: boqPcc.id,
            description: 'PCC M15',
            unit: 'cum',
            quantity: 4,
            rate: 5200,
            amount: 20_800,
            previousQty: 0,
            currentQty: 4,
            cumulativeQty: 4,
            certifiedAmount: 20_800,
          },
        ],
      },
    },
  });

  const requisition = await prisma.materialRequisition.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      reqNumber: 'IND-001',
      status: 'APPROVED',
      requestedBy: supervisor.id,
      approvedBy: pm.id,
      lines: {
        create: [
          {
            resourceId: resources['OPC Cement 53G'].id,
            quantity: 500,
            unit: 'bag',
          },
        ],
      },
    },
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      requisitionId: requisition.id,
      poNumber: 'PO-001',
      vendorName: 'Hyderabad Cement Supply',
      status: 'APPROVED',
      totalAmount: 210_000,
      lines: {
        create: [
          {
            resourceId: resources['OPC Cement 53G'].id,
            quantity: 500,
            unit: 'bag',
            rate: 420,
            amount: 210_000,
          },
        ],
      },
    },
  });

  const stockLoc = await prisma.stockLocation.create({
    data: { companyId: company.id, projectId: project1.id, name: 'Site Store' },
  });

  await prisma.goodsReceiptNote.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      purchaseOrderId: po.id,
      grnNumber: 'GRN-001',
      receivedDate: new Date('2025-02-15'),
      lines: {
        create: [
          {
            resourceId: resources['OPC Cement 53G'].id,
            quantity: 500,
            unit: 'bag',
          },
        ],
      },
    },
  });

  await prisma.stockBalance.create({
    data: {
      locationId: stockLoc.id,
      resourceId: resources['OPC Cement 53G'].id,
      quantity: 500,
    },
  });

  const subbie = await prisma.subcontractor.create({
    data: {
      companyId: company.id,
      name: 'Sharma Earthworks',
      gstin: '36AABCS1234A1Z5',
      contactPhone: '+919876543299',
    },
  });

  const wo = await prisma.subcontractWorkOrder.create({
    data: {
      projectId: project1.id,
      subcontractorId: subbie.id,
      woNumber: 'WO-001',
      scope: 'Earthwork sub-contract',
      contractValue: 2_000_000,
      retentionPct: 5,
      status: 'ACTIVE',
      startDate: new Date('2025-02-01'),
    },
  });

  await prisma.changeOrder.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      number: 'VO-002',
      title: 'Extra cement for drainage PCC',
      reason: 'Additional PCC lining for drain',
      status: 'SUBMITTED',
      costImpact: 21_000,
      scheduleImpactDays: 3,
      linkedTaskId: t3.id,
      linkedWorkOrderId: wo.id,
      createdBy: pm.id,
      lines: {
        create: [
          {
            description: 'Extra OPC for drain PCC',
            unit: 'bag',
            qtyDelta: 50,
            rate: 420,
            amount: 21_000,
            resourceId: resources['OPC Cement 53G'].id,
          },
        ],
      },
    },
  });

  await prisma.materialRequisition.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      reqNumber: 'IND-AUTO-EST-001',
      status: 'DRAFT',
      sourceType: 'ESTIMATE_CONVERT',
      sourceRef: 'NH-65 Baseline Estimate',
      requestedBy: pm.id,
      notes: 'Auto-generated from estimate convert — review before submit.',
      lines: {
        create: [
          {
            resourceId: resources['OPC Cement 53G'].id,
            quantity: 200,
            unit: 'bag',
            boqItemId: boqPcc.id,
            expectedRate: 435,
            rateSource: 'PROJECT',
          },
        ],
      },
    },
  });

  await prisma.subcontractMeasurement.create({
    data: {
      workOrderId: wo.id,
      periodLabel: 'Feb 2025',
      status: 'APPROVED',
      totalAmount: 180_000,
      approvedBy: owner.id,
      approvedAt: new Date('2025-03-01'),
      lines: {
        create: [
          {
            description: 'Excavation completed',
            quantity: 400,
            unit: 'cum',
            rate: 450,
            amount: 180_000,
          },
        ],
      },
    },
  });

  await prisma.reportSchedule.create({
    data: {
      companyId: company.id,
      reportType: 'GST_SUMMARY',
      cronExpr: '0 9 1 * *',
      recipients: ['accounts@reddyconst.com'],
    },
  });

  // ----------------------------------------------------------------
  // Project 2 - Greenview Residency Block-C (planning + sample estimate)
  // ----------------------------------------------------------------
  const project2 = await prisma.project.create({
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
      rateRegionId: regionApTier2.id,
      createdBy: pm.id,
    },
  });

  const estimate2 = await prisma.estimate.create({
    data: {
      projectId: project2.id,
      companyId: company.id,
      name: 'GVR Block-C Baseline',
      status: EstimateStatus.APPROVED,
      grandTotal: 850_000,
      subtotal: 850_000,
      createdBy: pm.id,
      approvedBy: owner.id,
      approvedAt: new Date('2025-03-01'),
    },
  });

  const estSection = await prisma.estimateSection.create({
    data: {
      estimateId: estimate2.id,
      name: 'Structure',
      orderIndex: 1,
    },
  });

  await prisma.estimateItem.createMany({
    data: [
      {
        estimateId: estimate2.id,
        sectionId: estSection.id,
        description: 'OPC Cement supply',
        unit: 'bag',
        quantity: 300,
        rate: 445,
        amount: 133_500,
        type: CostType.MATERIAL,
        resourceId: resources['OPC Cement 53G'].id,
      },
      {
        estimateId: estimate2.id,
        sectionId: estSection.id,
        description: 'Masonry labour',
        unit: 'day',
        quantity: 120,
        rate: 750,
        amount: 90_000,
        type: CostType.LABOUR,
        resourceId: resources['Mason Grade 1'].id,
      },
    ],
  });

  // ----------------------------------------------------------------
  // Project 3 - TechPark Office Renovation (completed)
  // ----------------------------------------------------------------
  const _project3 = await prisma.project.create({
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
      rateRegionId: regionApTier2.id,
      createdBy: pm.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete.');
  // eslint-disable-next-line no-console
  console.log('   Tenant users (all roles): password', PASSWORD);
  // eslint-disable-next-line no-console
  console.log('   Platform admin: admin@buildflow.com /', PLATFORM_ADMIN_PASSWORD);
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