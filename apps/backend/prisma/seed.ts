/**
 * BuildFlow - Database seed.
 *
 * Creates the sample company "Reddy Constructions Pvt Ltd" + 4 users (one per role),
 * realistic resources, 5 rate analyses, and 3 projects.
 *
 * Idempotent-ish: uses upsert on unique fields. Re-running updates in place.
 */
import { PrismaClient, Role, ProjectType, ProjectStatus, ResourceType, InvoiceStatus, CostType, EstimateStatus, StockMovementType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CATALOG_DATA, type CatalogItem } from './catalog-data';
import { RATE_ANALYSES } from './rate-analysis-data';
import { disconnectRedis } from '../src/lib/redis';

const prisma = new PrismaClient();

/** Mirror createGRN stock IN - balance + movement so Site stock Received matches On hand. */
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

/** Mirror daily report deductStock OUT - movement + balance decrement. */
async function applyStockOut(
  locationId: string,
  dailyReportId: string,
  lines: Array<{ resourceId: string; quantity: number }>,
): Promise<void> {
  for (const line of lines) {
    await prisma.stockBalance.update({
      where: { locationId_resourceId: { locationId, resourceId: line.resourceId } },
      data: { quantity: { decrement: line.quantity } },
    });
    await prisma.stockMovement.create({
      data: {
        locationId,
        resourceId: line.resourceId,
        quantity: line.quantity,
        type: StockMovementType.OUT,
        referenceType: 'DAILY_REPORT',
        referenceId: dailyReportId,
      },
    });
  }
}

const PASSWORD = 'Test@1234';
const PLATFORM_ADMIN_PASSWORD = 'Admin@1234';
const COMPANY_LOGO =
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=200&fit=crop&auto=format';

async function main(): Promise<void> {
  // ----------------------------------------------------------------
  // Reset - truncate all tables for a clean, idempotent seed run
  //
  // FIX (DAT-3.1): Refuse to TRUNCATE unless NODE_ENV !== 'production'
  // AND an explicit SEED_ALLOW_TRUNCATE=1 is set. This prevents accidental
  // data loss in production. The misleading "idempotent-ish" comment is
  // corrected: the seed TRUNCATES (not upserts) — it's a full reset.
  // ----------------------------------------------------------------
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_TRUNCATE !== '1') {
    throw new Error(
      'Seed refuses to TRUNCATE in production. Set SEED_ALLOW_TRUNCATE=1 to override.',
    );
  }
  if (process.env.SEED_ALLOW_TRUNCATE !== '1' && process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
    throw new Error(
      'Seed refuses to TRUNCATE without SEED_ALLOW_TRUNCATE=1. Set it explicitly to confirm data wipe.',
    );
  }

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
      { name: 'Arjun Naidu', email: 'dpm@reddyconst.com', role: Role.DPM, phone: '+919876543214' },
      { name: 'Vikram Patel', email: 'qc@reddyconst.com', role: Role.QC, phone: '+919876543215' },
      { name: 'Suresh Reddy', email: 'mechanical@reddyconst.com', role: Role.MECHANICAL_MANAGER, phone: '+919876543216' },
      { name: 'Anil Gupta', email: 'store@reddyconst.com', role: Role.STORE_INCHARGE, phone: '+919876543217' },
      { name: 'Karthik Rao', email: 'weighbridge@reddyconst.com', role: Role.WEIGHBRIDGE_INCHARGE, phone: '+919876543218' },
      { name: 'Mahesh Singh', email: 'site@reddyconst.com', role: Role.SITE_SUPERVISOR, phone: '+919876543212' },
      { name: 'Priya Sharma', email: 'accounts@reddyconst.com', role: Role.ACCOUNTANT, phone: '+919876543213' },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { phone: u.phone },
        create: { ...u, companyId: company.id, passwordHash },
      }),
    ),
  );
  const [owner, pm, dpm, qc, mechanicalMgr, storeIncharge, weighbridgeIncharge, supervisor] = users;

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
  // Resources — comprehensive catalog (~500+ items)
  // ----------------------------------------------------------------
  const resources: Record<string, { id: string }> = {};
  let resourceCount = 0;
  // Auto-assign SAC codes for services (LABOUR/EQUIPMENT) if no HSN provided
  // 9954 = Construction services | 9973 = Leasing/rental services without operator
  const resolveHsnSac = (item: CatalogItem): string | undefined => {
    // LABOUR and EQUIPMENT are services — always use SAC codes (not HSN)
    if (item.type === "LABOUR") return "9954";
    if (item.type === "EQUIPMENT") return "9973";
    // MATERIAL uses HSN codes from the catalog
    return item.hsn;
  };

  for (const item of CATALOG_DATA) {
    const hsnSac = resolveHsnSac(item);
    const created = await prisma.resource.upsert({
      where: {
        companyId_name_type: { companyId: company.id, name: item.name, type: item.type },
      },
      update: {
        rate: item.rate,
        gstRate: item.gstRate,
        hsnSacCode: hsnSac,
        category: item.category,
        brandOrSpec: item.brandOrSpec,
        lastRateUpdatedAt: new Date(),
      },
      create: {
        companyId: company.id,
        name: item.name,
        type: item.type,
        unit: item.unit,
        rate: item.rate,
        gstRate: item.gstRate,
        hsnSacCode: hsnSac,
        category: item.category,
        brandOrSpec: item.brandOrSpec,
        lastRateUpdatedAt: new Date(),
      },
    });
    resources[item.name] = created;
    resourceCount++;
  }
  // eslint-disable-next-line no-console
  console.log(`   Seeded ${resourceCount} catalog resources`);

  // Flush resource list cache so the newly seeded items appear immediately
  // (the API caches resource lists for 1 hour; seed runs outside the API
  // lifecycle so auto-invalidation never fires).
  try {
    const { invalidatePattern } = await import('../src/utils/cache');
    await invalidatePattern(`cache:${company.id}:resources:*`);
    await invalidatePattern(`cache:${company.id}:rate-analysis:*`);
    // eslint-disable-next-line no-console
    console.log('   Flushed Redis cache for resources + rate analyses');
  } catch {
    // eslint-disable-next-line no-console
    console.log('   (Redis not available — cache will expire via TTL)');
  }

  // ----------------------------------------------------------------
  // Daily report helper (defined here so it can close over `resources`)
  // ----------------------------------------------------------------
  type Weather = 'SUNNY' | 'CLOUDY' | 'RAIN' | 'STORM' | 'FOG';
  type SiteStatus = 'ON_SCHEDULE' | 'DELAYED' | 'BLOCKED';

  interface ReportMaterialInput {
    resourceName: string;
    quantity: number;
    notes?: string;
    taskId?: string;
    boqItemId?: string;
    boqMeasurementPosted?: boolean;
  }

  /**
   * Seed a DailyReport with optional material usages and task updates.
   * Returns the created report so the caller can apply stock deduction.
   */
  async function seedReport(
    projectId: string,
    reportedBy: string,
    reportDate: string,
    opts: {
      weather?: Weather;
      siteStatus?: SiteStatus;
      workDone?: string;
      issues?: string;
      workersCount?: number;
      materials?: ReportMaterialInput[];
      taskUpdates?: Array<{ taskId: string; progressPct: number }>;
    },
  ) {
    return prisma.dailyReport.create({
      data: {
        projectId,
        reportedBy,
        reportDate: new Date(reportDate),
        weather: opts.weather,
        siteStatus: opts.siteStatus,
        workDone: opts.workDone,
        issues: opts.issues,
        workersCount: opts.workersCount ?? 0,
        materialUsages: opts.materials?.length
          ? {
              create: opts.materials.map((m) => ({
                resourceId: resources[m.resourceName]!.id,
                quantityUsed: m.quantity,
                notes: m.notes,
                taskId: m.taskId ?? null,
                boqItemId: m.boqItemId ?? null,
                boqMeasurementPosted: m.boqMeasurementPosted ?? false,
              })),
            }
          : undefined,
        taskUpdates: opts.taskUpdates?.length
          ? {
              create: opts.taskUpdates.map((t) => ({
                taskId: t.taskId,
                progressPct: t.progressPct,
              })),
            }
          : undefined,
      },
    });
  }

  // ----------------------------------------------------------------
  // Rate Analyses (composite rates referencing catalog items)
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
    // Delete existing RA with same name (so re-seeding updates it)
    await prisma.rateAnalysis.deleteMany({ where: { name, companyId: company.id } });
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
            // MISC items must NEVER link to catalog resources — they are standalone labels.
            // Always store the name as miscName so the mobile MISC section displays it.
            resourceId: c.type === 'MISC' ? null : (c.resourceName ? (resources[c.resourceName]?.id ?? null) : null),
            miscName: c.type === 'MISC'
              ? (c.miscName ?? c.resourceName ?? null)
              : (c.miscName ?? (c.resourceName && !resources[c.resourceName]?.id ? c.resourceName : null)),
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

  // Seed all composite rate analyses from rate-analysis-data.ts (single source of truth)
  let raDataCount = 0;
  for (const ra of RATE_ANALYSES) {
    await seedRateAnalysis(ra.name, ra.unit, ra.description, ra.components);
    raDataCount++;
  }
  // eslint-disable-next-line no-console
  console.log(`   Seeded ${raDataCount} composite rate analyses from data file`);

  // Flush RA list cache so new RAs appear immediately after re-seed.
  try {
    const { invalidatePattern } = await import('../src/utils/cache');
    await invalidatePattern(`cache:${company.id}:rate-analysis:*`);
    // eslint-disable-next-line no-console
    console.log('   Flushed Redis cache for rate analyses (post-seed)');
  } catch {
    // Redis not available
  }

  // Look up the emulsion paint RA for estimate item linking (from data file)
  const emulsionPaintRa = await prisma.rateAnalysis.findFirst({
    where: { companyId: company.id, name: 'Distemper Painting (2 Coats)' },
  });

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
        resourceId: resources['OPC Cement 53 Grade'].id,
        rate: 418,
        unit: 'bag',
        effectiveDate,
      },
      {
        regionId: regionHyderabad.id,
        resourceId: resources['River Sand (Fine)'].id,
        rate: 1780,
        unit: 'cum',
        effectiveDate,
      },
      {
        regionId: regionApTier2.id,
        resourceId: resources['OPC Cement 53 Grade'].id,
        rate: 438,
        unit: 'bag',
        effectiveDate,
      },
      {
        regionId: regionApTier2.id,
        resourceId: resources['TMT Steel Fe500 12mm'].id,
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
      resourceId: resources['OPC Cement 53 Grade'].id,
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

  // EST-VO-11f: Approved estimate for NH-65 so VO-001 and VO-002 can link via estimateId
  const estimate1 = await prisma.estimate.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      name: 'NH-65 Baseline Estimate',
      status: EstimateStatus.APPROVED,
      subtotal: 1_490_000,
      grandTotal: 1_490_000,
      createdBy: pm.id,
      approvedBy: owner.id,
      approvedAt: new Date('2025-01-20'),
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
      estimateId: estimate1.id,
      boqAppliedAt: new Date('2025-02-10'),
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
            resourceId: resources['OPC Cement 53 Grade'].id,
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
            resourceId: resources['OPC Cement 53 Grade'].id,
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

  const grn1 = await prisma.goodsReceiptNote.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      purchaseOrderId: po.id,
      grnNumber: 'GRN-001',
      receivedDate: new Date('2025-02-15'),
      lines: {
        create: [
          {
            resourceId: resources['OPC Cement 53 Grade'].id,
            quantity: 500,
            unit: 'bag',
          },
        ],
      },
    },
  });

  await applyStockIn(stockLoc.id, grn1.id, [
    { resourceId: resources['OPC Cement 53 Grade'].id, quantity: 500 },
  ]);

  const subbie = await prisma.subcontractor.create({
    data: {
      companyId: company.id,
      name: 'Sharma Earthworks',
      gstin: '36AABCS1234A1Z5',
      contactPhone: '+919876543299',
      defaultTdsRate: 1,
    },
  });

  const wo = await prisma.subcontractWorkOrder.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      subcontractorId: subbie.id,
      woNumber: 'WO-001',
      scope: 'Earthwork sub-contract',
      contractValue: 2_000_000,
      retentionPct: 5,
      advanceAmount: 100_000,
      status: 'ACTIVE',
      startDate: new Date('2025-02-01'),
      contractLines: {
        create: [
          {
            description: 'Earthwork excavation & filling',
            unit: 'cum',
            contractQty: 4000,
            rate: 500,
            amount: 2_000_000,
          },
        ],
      },
    },
  });

  const woContractLine = await prisma.subcontractWorkOrderLine.findFirstOrThrow({
    where: { workOrderId: wo.id },
  });

  await prisma.subcontractMeasurement.create({
    data: {
      workOrderId: wo.id,
      periodLabel: 'Feb 2025 - Earthwork Phase 1',
      status: 'APPROVED',
      totalAmount: 180_000,
      approvedBy: pm.id,
      approvedAt: new Date('2025-02-28'),
      lines: {
        create: [
          {
            description: 'Earthwork excavation - chainage 0–500m',
            quantity: 360,
            unit: 'cum',
            rate: 500,
            amount: 180_000,
            workOrderLineId: woContractLine.id,
          },
        ],
      },
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
            resourceId: resources['OPC Cement 53 Grade'].id,
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
      notes: 'Auto-generated from estimate convert - review before submit.',
      lines: {
        create: [
          {
            resourceId: resources['OPC Cement 53 Grade'].id,
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
        resourceId: resources['OPC Cement 53 Grade'].id,
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
        resourceId: resources['Mason Grade 1 (Mistri)'].id,
      },
    ],
  });

  // ----------------------------------------------------------------
  // Project 3 - Trail Office Renovation (estimate → BOQ → procurement demo)
  // ----------------------------------------------------------------
  const project3 = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Trail Office Renovation',
      code: 'TRAIL',
      type: ProjectType.MINI,
      status: ProjectStatus.IN_PROGRESS,
      clientName: 'Trail Logistics Pvt Ltd',
      clientContact: 'facilities@trail.in',
      locationAddress: 'HITEC City, Hyderabad',
      startDate: new Date('2025-05-01'),
      endDate: new Date('2025-10-31'),
      budget: 828_000,
      rateRegionId: regionHyderabad.id,
      createdBy: pm.id,
    },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: project3.id, userId: owner.id, role: Role.OWNER },
      { projectId: project3.id, userId: pm.id, role: Role.PM },
      { projectId: project3.id, userId: supervisor.id, role: Role.SUPERVISOR },
    ],
  });

  const wbsTrail = await prisma.wBSItem.create({
    data: { projectId: project3.id, code: '1.0', name: 'Renovation Works', level: 1, orderIndex: 1 },
  });
  await prisma.task.createMany({
    data: [
      {
        projectId: project3.id,
        wbsId: wbsTrail.id,
        name: 'Carpet installation',
        startDate: new Date('2025-05-15'),
        endDate: new Date('2025-06-30'),
        durationDays: 45,
        progressPct: 20,
        status: 'IN_PROGRESS',
        assignedTo: supervisor.id,
      },
      {
        projectId: project3.id,
        wbsId: wbsTrail.id,
        name: 'Wall painting',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-08-31'),
        durationDays: 90,
        progressPct: 10,
        status: 'IN_PROGRESS',
        assignedTo: supervisor.id,
      },
      {
        projectId: project3.id,
        wbsId: wbsTrail.id,
        name: 'Ceiling paint & finish',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-09-15'),
        durationDays: 75,
        progressPct: 0,
        status: 'NOT_STARTED',
        assignedTo: supervisor.id,
      },
    ],
  });

  const estimate3 = await prisma.estimate.create({
    data: {
      projectId: project3.id,
      companyId: company.id,
      name: 'Office Renovation Baseline',
      status: EstimateStatus.APPROVED,
      subtotal: 828_000,
      grandTotal: 828_000,
      createdBy: pm.id,
      approvedBy: owner.id,
      approvedAt: new Date('2025-05-05'),
    },
  });

  const estSecFloor = await prisma.estimateSection.create({
    data: { estimateId: estimate3.id, name: 'Flooring & Paint', orderIndex: 1 },
  });

  const estItemCarpet = await prisma.estimateItem.create({
    data: {
      estimateId: estimate3.id,
      sectionId: estSecFloor.id,
      itemCode: 'O-020',
      description: 'Carpet tiles (commercial grade)',
      unit: 'sqm',
      quantity: 950,
      rate: 680,
      amount: 646_000,
      type: CostType.MATERIAL,
      resourceId: resources['Commercial Carpet Tile'].id,
    },
  });

  const estItemPaint = await prisma.estimateItem.create({
    data: {
      estimateId: estimate3.id,
      sectionId: estSecFloor.id,
      itemCode: 'O-021',
      description: 'Emulsion paint - walls & ceiling',
      unit: 'sqm',
      quantity: 2800,
      rate: 65,
      amount: 182_000,
      type: CostType.MATERIAL,
      rateAnalysisId: emulsionPaintRa?.id,
    },
  });

  const boqCarpet = await prisma.bOQItem.create({
    data: {
      projectId: project3.id,
      itemCode: 'O-020',
      description: 'Carpet tiles (commercial grade)',
      unit: 'sqm',
      quantity: 950,
      rate: 680,
      amount: 646_000,
      category: 'MATERIAL',
      estimateItemId: estItemCarpet.id,
      procuredQty: 950,
    },
  });

  const boqPaint = await prisma.bOQItem.create({
    data: {
      projectId: project3.id,
      itemCode: 'O-021',
      description: 'Emulsion paint - walls & ceiling',
      unit: 'sqm',
      quantity: 2800,
      rate: 65,
      amount: 182_000,
      category: 'MATERIAL',
      estimateItemId: estItemPaint.id,
    },
  });

  const paintLitres = Math.round(2800 * 0.12 * 1000) / 1000;

  const requisitionTrail = await prisma.materialRequisition.create({
    data: {
      projectId: project3.id,
      companyId: company.id,
      reqNumber: 'IND-002',
      status: 'APPROVED',
      requestedBy: supervisor.id,
      approvedBy: pm.id,
      notes: 'Flooring & paint - carpet line linked to BOQ O-020 for procured tracking',
      lines: {
        create: [
          {
            resourceId: resources['Commercial Carpet Tile'].id,
            quantity: 950,
            unit: 'sqm',
            boqItemId: boqCarpet.id,
            expectedRate: 680,
            rateSource: 'CATALOG',
          },
          {
            resourceId: resources['Exterior Emulsion Paint (Premium)'].id,
            quantity: paintLitres,
            unit: 'litre',
            expectedRate: 420,
            rateSource: 'CATALOG',
          },
        ],
      },
    },
  });

  const poTrail = await prisma.purchaseOrder.create({
    data: {
      projectId: project3.id,
      companyId: company.id,
      requisitionId: requisitionTrail.id,
      poNumber: 'PO-002',
      vendorName: 'Hyderabad Interiors Supply',
      status: 'APPROVED',
      totalAmount: 646_000 + paintLitres * 420,
      lines: {
        create: [
          {
            resourceId: resources['Commercial Carpet Tile'].id,
            quantity: 950,
            unit: 'sqm',
            rate: 680,
            amount: 646_000,
          },
          {
            resourceId: resources['Exterior Emulsion Paint (Premium)'].id,
            quantity: paintLitres,
            unit: 'litre',
            rate: 420,
            amount: paintLitres * 420,
          },
        ],
      },
    },
  });

  const stockLocTrail = await prisma.stockLocation.create({
    data: { companyId: company.id, projectId: project3.id, name: 'Office Site Store' },
  });

  const grnTrail = await prisma.goodsReceiptNote.create({
    data: {
      projectId: project3.id,
      companyId: company.id,
      purchaseOrderId: poTrail.id,
      grnNumber: 'GRN-002',
      receivedDate: new Date('2025-05-20'),
      lines: {
        create: [
          {
            resourceId: resources['Commercial Carpet Tile'].id,
            quantity: 950,
            unit: 'sqm',
          },
          {
            resourceId: resources['Exterior Emulsion Paint (Premium)'].id,
            quantity: paintLitres,
            unit: 'litre',
          },
        ],
      },
    },
  });

  await applyStockIn(stockLocTrail.id, grnTrail.id, [
    { resourceId: resources['Commercial Carpet Tile'].id, quantity: 950 },
    { resourceId: resources['Exterior Emulsion Paint (Premium)'].id, quantity: paintLitres },
  ]);

  const paintIssuedDemo = 36;
  const trailDailyReport = await prisma.dailyReport.create({
    data: {
      projectId: project3.id,
      reportedBy: supervisor.id,
      reportDate: new Date('2025-05-25'),
      workDone: 'Primer coat on corridor walls - paint drawn from site store',
      workersCount: 8,
      materialUsages: {
        create: {
          resourceId: resources['Exterior Emulsion Paint (Premium)'].id,
          quantityUsed: paintIssuedDemo,
          notes: 'Deduct from site stock (demo)',
        },
      },
    },
  });

  await applyStockOut(stockLocTrail.id, trailDailyReport.id, [
    { resourceId: resources['Exterior Emulsion Paint (Premium)'].id, quantity: paintIssuedDemo },
  ]);

  const boqCarpetInstall = await prisma.bOQItem.create({
    data: {
      projectId: project3.id,
      itemCode: 'O-SC-020',
      description: 'Carpet tile installation (subcontract)',
      unit: 'sqm',
      quantity: 950,
      rate: 120,
      amount: 114_000,
      category: 'SUBCONTRACTOR',
    },
  });

  const trailSubbie = await prisma.subcontractor.create({
    data: {
      companyId: company.id,
      name: 'FloorCraft Interiors',
      gstin: '36AABCF5678B1Z3',
      contactPhone: '+919876543210',
      defaultTdsRate: 2,
    },
  });

  const woTrail = await prisma.subcontractWorkOrder.create({
    data: {
      projectId: project3.id,
      companyId: company.id,
      subcontractorId: trailSubbie.id,
      boqItemId: boqCarpet.id,
      woNumber: 'WO-TRAIL-001',
      scope: 'Carpet tile installation - linked to BOQ O-020',
      contractValue: 114_000,
      retentionPct: 5,
      advanceAmount: 10_000,
      status: 'ACTIVE',
      startDate: new Date('2025-05-01'),
      contractLines: {
        create: [
          {
            description: 'Carpet tile installation',
            unit: 'sqm',
            contractQty: 950,
            rate: 120,
            amount: 114_000,
            boqItemId: boqCarpetInstall.id,
          },
        ],
      },
    },
    include: { contractLines: true },
  });

  const trailContractLine = woTrail.contractLines[0]!;

  const trailMeasApproved = await prisma.subcontractMeasurement.create({
    data: {
      workOrderId: woTrail.id,
      periodLabel: 'May 2025 - Phase 1',
      status: 'APPROVED',
      totalAmount: 28_800,
      approvedBy: pm.id,
      approvedAt: new Date('2025-05-20'),
      lines: {
        create: [
          {
            description: 'Carpet tile installation - reception & corridor',
            quantity: 240,
            unit: 'sqm',
            rate: 120,
            amount: 28_800,
            workOrderLineId: trailContractLine.id,
            boqItemId: boqCarpetInstall.id,
            boqMeasurementPosted: true,
          },
        ],
      },
    },
  });

  await prisma.boqMeasurement.create({
    data: {
      boqItemId: boqCarpetInstall.id,
      projectId: project3.id,
      quantity: 240,
      recordedBy: pm.id,
      notes: 'From subcontract measurement (seed)',
    },
  });

  await prisma.bOQItem.update({
    where: { id: boqCarpetInstall.id },
    data: { executedQty: 240 },
  });

  await prisma.subcontractMeasurement.create({
    data: {
      workOrderId: woTrail.id,
      periodLabel: 'Jun 2025 - Phase 2 (draft)',
      status: 'DRAFT',
      totalAmount: 36_000,
      lines: {
        create: [
          {
            description: 'Carpet tile installation - open office',
            quantity: 300,
            unit: 'sqm',
            rate: 120,
            amount: 36_000,
            workOrderLineId: trailContractLine.id,
            boqItemId: boqCarpetInstall.id,
          },
        ],
      },
    },
  });

  await prisma.bill.create({
    data: {
      projectId: project3.id,
      companyId: company.id,
      billNumber: 'SC-WO-TRAIL-001-MAY',
      vendorName: trailSubbie.name,
      vendorGstin: trailSubbie.gstin,
      billDate: new Date('2025-05-21'),
      status: 'APPROVED',
      approvedBy: pm.id,
      subtotal: 28_800,
      retentionAmount: 1_440,
      advanceRecoveryAmount: 2_880,
      tdsRate: 2,
      tdsAmount: 485.76,
      total: 23_994.24,
      paidAmount: 10_000,
      category: 'SUBCONTRACTOR',
      workOrderId: woTrail.id,
      measurementId: trailMeasApproved.id,
    },
  });

  // ----------------------------------------------------------------
  // Daily Reports (rich, multi-project) — exercises calendar, materials,
  // stock deduction, task progress, BOQ posting & issues.
  // ----------------------------------------------------------------
  // Resolve Trail (project3) task IDs (created via createMany above).
  const trailTasks = await prisma.task.findMany({ where: { projectId: project3.id } });
  const trailCarpetTask = trailTasks.find((t) => t.name === 'Carpet installation')!;
  const trailPaintTask = trailTasks.find((t) => t.name === 'Wall painting')!;

  // --- Project 1 (NH-65) — 5 reports across the earthwork week ---
  // Note: stockLoc has 500 bag OPC Cement on hand. Total drawn here = 90 bag.
  const p1r1 = await seedReport(project1.id, supervisor.id, '2025-02-03', {
    weather: 'SUNNY',
    siteStatus: 'ON_SCHEDULE',
    workDone:
      'Excavation started at chainage 0+000. Two excavators deployed. Soil is hard morum - good progress.',
    workersCount: 25,
    materials: [{ resourceName: 'OPC Cement 53 Grade', quantity: 20, boqItemId: boqPcc.id, notes: 'PCC bedding for drain' }],
    taskUpdates: [{ taskId: t3.id, progressPct: 20 }],
  });
  await applyStockOut(stockLoc.id, p1r1.id, [
    { resourceId: resources['OPC Cement 53 Grade'].id, quantity: 20 },
  ]);

  const p1r2 = await seedReport(project1.id, supervisor.id, '2025-02-04', {
    weather: 'CLOUDY',
    siteStatus: 'ON_SCHEDULE',
    workDone:
      'Continued excavation to chainage 0+200. PCC M15 pour for U-drain base completed (40 cum).',
    workersCount: 30,
    materials: [{ resourceName: 'OPC Cement 53 Grade', quantity: 40, boqItemId: boqPcc.id }],
    taskUpdates: [{ taskId: t3.id, progressPct: 35 }],
  });
  await applyStockOut(stockLoc.id, p1r2.id, [
    { resourceId: resources['OPC Cement 53 Grade'].id, quantity: 40 },
  ]);

  await seedReport(project1.id, supervisor.id, '2025-02-05', {
    weather: 'RAIN',
    siteStatus: 'DELAYED',
    workDone: 'Light rain after 11 AM. Dewatering pumps deployed. Excavation paused for safety.',
    issues: 'Water table high near chainage 0+180 - may need shoring before resuming.',
    workersCount: 15,
    materials: [],
  });

  const p1r4 = await seedReport(project1.id, supervisor.id, '2025-02-06', {
    weather: 'SUNNY',
    siteStatus: 'ON_SCHEDULE',
    workDone: 'Catch-up excavation 0+200 to 0+350. Drain PCC lining resumed.',
    workersCount: 28,
    materials: [{ resourceName: 'OPC Cement 53 Grade', quantity: 30, boqItemId: boqPcc.id }],
    taskUpdates: [{ taskId: t3.id, progressPct: 45 }],
  });
  await applyStockOut(stockLoc.id, p1r4.id, [
    { resourceId: resources['OPC Cement 53 Grade'].id, quantity: 30 },
  ]);

  await seedReport(project1.id, supervisor.id, '2025-02-07', {
    weather: 'STORM',
    siteStatus: 'BLOCKED',
    workDone: 'Overnight storm flooded the trench. Site inaccessible. Pumps running.',
    issues:
      'Storm water entered trench 0+150 to 0+350. Need 2 days to dewater. Subcontractor team sent home.',
    workersCount: 8,
    materials: [],
  });

  // --- Project 3 (Trail) — 4 reports for the renovation phase ---
  // Note: stockLocTrail has 950 sqm carpet + ~300 litre paint on hand.
  // R1 posts carpet usage to BOQ measurement (mirrors service behaviour).
  const p3r1 = await seedReport(project3.id, supervisor.id, '2025-05-15', {
    weather: 'SUNNY',
    siteStatus: 'ON_SCHEDULE',
    workDone: 'Carpet installation started in reception & corridor. Floor prepared, adhesive laid.',
    workersCount: 12,
    materials: [
      {
        resourceName: 'Commercial Carpet Tile',
        quantity: 240,
        boqItemId: boqCarpet.id,
        boqMeasurementPosted: true,
        notes: 'Reception + corridor carpet laid',
      },
    ],
    taskUpdates: [{ taskId: trailCarpetTask.id, progressPct: 25 }],
  });
  await applyStockOut(stockLocTrail.id, p3r1.id, [
    { resourceId: resources['Commercial Carpet Tile'].id, quantity: 240 },
  ]);
  await prisma.boqMeasurement.create({
    data: {
      boqItemId: boqCarpet.id,
      projectId: project3.id,
      quantity: 240,
      recordedBy: supervisor.id,
      notes: 'From daily report 2025-05-15 (seed)',
    },
  });
  await prisma.bOQItem.update({
    where: { id: boqCarpet.id },
    data: { executedQty: { increment: 240 } },
  });

  const p3r2 = await seedReport(project3.id, supervisor.id, '2025-05-18', {
    weather: 'CLOUDY',
    siteStatus: 'ON_SCHEDULE',
    workDone: 'Primer coat applied on corridor walls. Surface prep (putty) 60% complete.',
    workersCount: 10,
    materials: [
      { resourceName: 'Exterior Emulsion Paint (Premium)', quantity: 48, notes: 'Primer + first coat' },
    ],
    taskUpdates: [{ taskId: trailPaintTask.id, progressPct: 15 }],
  });
  await applyStockOut(stockLocTrail.id, p3r2.id, [
    { resourceId: resources['Exterior Emulsion Paint (Premium)'].id, quantity: 48 },
  ]);

  const p3r3 = await seedReport(project3.id, supervisor.id, '2025-05-22', {
    weather: 'FOG',
    siteStatus: 'ON_SCHEDULE',
    workDone:
      'Carpet extended to meeting rooms. Wall paint second coat started in corridor.',
    workersCount: 14,
    materials: [
      { resourceName: 'Commercial Carpet Tile', quantity: 200, boqItemId: boqCarpet.id },
      { resourceName: 'Exterior Emulsion Paint (Premium)', quantity: 40 },
    ],
    taskUpdates: [
      { taskId: trailCarpetTask.id, progressPct: 45 },
      { taskId: trailPaintTask.id, progressPct: 25 },
    ],
  });
  await applyStockOut(stockLocTrail.id, p3r3.id, [
    { resourceId: resources['Commercial Carpet Tile'].id, quantity: 200 },
    { resourceId: resources['Exterior Emulsion Paint (Premium)'].id, quantity: 40 },
  ]);
  await prisma.bOQItem.update({
    where: { id: boqCarpet.id },
    data: { executedQty: { increment: 200 } },
  });

  // (The pre-existing 2025-05-25 report above remains as the 4th Trail report.)

  // --- Project 2 (Greenview) — 2 planning-phase reports (no stock, no materials) ---
  await seedReport(project2.id, pm.id, '2025-04-02', {
    weather: 'SUNNY',
    siteStatus: 'ON_SCHEDULE',
    workDone: 'Site survey and benchmark marking completed. Soil testing samples collected.',
    workersCount: 5,
  });

  await seedReport(project2.id, pm.id, '2025-04-03', {
    weather: 'CLOUDY',
    siteStatus: 'ON_SCHEDULE',
    workDone: 'Soil test results received. Reviewing foundation design with structural consultant.',
    issues: 'Borehole 3 showed loose fill - may require deeper footing locally.',
    workersCount: 6,
  });

  // eslint-disable-next-line no-console
  console.log('   Seeded 11 daily reports (P1: 5, P2: 2, P3: 4 incl. pre-existing)');

  // ----------------------------------------------------------------
  // Project 4 - TechPark Office Renovation (completed archive)
  // ----------------------------------------------------------------
  const _project4 = await prisma.project.create({
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
    // FIX (DAT-1.1): Disconnect Redis too — otherwise the open ioredis
    // connection keeps the process alive and the seed never exits.
    await disconnectRedis();
    await prisma.$disconnect();
  });
