/**
 * BuildFlow - Database seed.
 *
 * Creates the sample company "Reddy Constructions Pvt Ltd" + 9 users (all roles),
 * realistic resources, composite rate analyses, and 1 project (NH-45 Road Widening)
 * with complete lifecycle: estimate → BOQ → procurement → stock → subcontract →
 * invoices → change orders → daily reports.
 *
 * Catalog data (catalog-data.ts) and rate analyses (rate-analysis-data.ts) are
 * NOT changed — they remain the full ~500 item library.
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
  // Project 1 - NH-45 Road Widening (ONLY project — complete lifecycle)
  // ----------------------------------------------------------------
  const project1 = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'NH-45 Road Widening',
      code: 'NH45',
      type: ProjectType.HEAVY,
      status: ProjectStatus.IN_PROGRESS,
      clientName: 'NHAI',
      clientContact: 'pi@nhai.gov.in',
      locationLat: 17.385,
      locationLng: 78.4867,
      locationAddress: 'NH-45, Hyderabad, Telangana',
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
  const wbs2 = await prisma.wBSItem.create({
    data: { projectId: project1.id, code: '2.0', name: 'Earthwork & PCC', level: 1, orderIndex: 2 },
  });
  const t1 = await prisma.task.create({
    data: { projectId: project1.id, wbsId: wbs1.id, name: 'Site survey', startDate: new Date('2025-01-15'), endDate: new Date('2025-01-20'), durationDays: 5, progressPct: 100, status: 'COMPLETED', assignedTo: supervisor.id },
  });
  const t2 = await prisma.task.create({
    data: { projectId: project1.id, wbsId: wbs1.id, name: 'Clear & grub', startDate: new Date('2025-01-21'), endDate: new Date('2025-01-30'), durationDays: 10, progressPct: 100, status: 'COMPLETED', assignedTo: supervisor.id },
  });
  await prisma.taskPredecessor.create({ data: { taskId: t2.id, predecessorId: t1.id, type: 'FS', lagDays: 0 } });
  const t3 = await prisma.task.create({
    data: { projectId: project1.id, wbsId: wbs2.id, name: 'Earthwork excavation', startDate: new Date('2025-02-01'), endDate: new Date('2025-03-15'), durationDays: 43, progressPct: 60, status: 'IN_PROGRESS', assignedTo: supervisor.id },
  });
  await prisma.taskPredecessor.create({ data: { taskId: t3.id, predecessorId: t2.id, type: 'FS', lagDays: 0 } });

  // Project-scoped access (PM + supervisor on NH-45)
  await prisma.projectMember.createMany({
    data: [
      { projectId: project1.id, userId: owner.id, role: Role.OWNER },
      { projectId: project1.id, userId: pm.id, role: Role.PM },
      { projectId: project1.id, userId: supervisor.id, role: Role.SUPERVISOR },
      { projectId: project1.id, userId: storeIncharge.id, role: Role.STORE_INCHARGE },
    ],
  });

  // ----------------------------------------------------------------
  // ESTIMATE → BOQ → PROCUREMENT full chain on NH-45
  // ----------------------------------------------------------------

  // Look up RAs for estimate linking (from rate-analysis-data.ts via seed above)
  const raPccM15 = await prisma.rateAnalysis.findFirstOrThrow({
    where: { companyId: company.id, name: 'PCC M15 (1:2:4)' },
  });
  const raRccM30 = await prisma.rateAnalysis.findFirstOrThrow({
    where: { companyId: company.id, name: 'RCC M30' },
  });
  const raDistemper = await prisma.rateAnalysis.findFirstOrThrow({
    where: { companyId: company.id, name: 'Distemper Painting (2 Coats)' },
  });

  // ── Estimate: 3 sections, 8+ items, 3 RA-linked ──────────────
  // Section totals: 2,216,000 (earthwork) + 3,750,000 (pavement) + 380,000 (finishing)
  // Grand total: 6,346,000
  const estimate1 = await prisma.estimate.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      name: 'NH-45 Baseline Estimate',
      status: EstimateStatus.APPROVED,
      subtotal: 6_346_000,
      grandTotal: 6_346_000,
      createdBy: pm.id,
      approvedBy: owner.id,
      approvedAt: new Date('2025-01-20'),
    },
  });

  const estSec1 = await prisma.estimateSection.create({
    data: { estimateId: estimate1.id, name: 'Earthwork & Substructure', orderIndex: 1 },
  });
  const estSec2 = await prisma.estimateSection.create({
    data: { estimateId: estimate1.id, name: 'Pavement & Drainage', orderIndex: 2 },
  });
  const estSec3 = await prisma.estimateSection.create({
    data: { estimateId: estimate1.id, name: 'Finishing & Signage', orderIndex: 3 },
  });

  // Section 1: Earthwork & Substructure (4 items, 2 RA-linked)
  const estItemEarthwork = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec1.id, itemCode: 'O-001',
      description: 'Earthwork excavation in ordinary soil',
      unit: 'cum', quantity: 5000, rate: 145, amount: 725_000,
      type: CostType.MATERIAL,
      // Earthwork has no direct catalog resource — leave resourceId null (was wrongly cement before)
    },
  });

  const estItemDrain = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec1.id, itemCode: 'O-002',
      description: 'U-drain excavation & refilling',
      unit: 'cum', quantity: 800, rate: 180, amount: 144_000,
      type: CostType.MATERIAL,
      resourceId: resources['River Sand (Fine)'].id,
    },
  });

  const estItemPcc = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec1.id, itemCode: 'O-003',
      description: 'PCC M15 (1:2:4) in foundation',
      unit: 'cum', quantity: 150, rate: 5200, amount: 780_000,
      type: CostType.MATERIAL,
      rateAnalysisId: raPccM15.id,  // RA-linked
    },
  });

  const estItemRcc = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec1.id, itemCode: 'O-004',
      description: 'RCC M30 slab & retaining wall',
      unit: 'cum', quantity: 320, rate: 1772, amount: 567_000,
      type: CostType.MATERIAL,
      rateAnalysisId: raRccM30.id,  // RA-linked
    },
  });

  // Section 2: Pavement & Drainage (3 items, 1 RA-linked, 1 SUBCONTRACTOR)
  const estItemWmm = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec2.id, itemCode: 'O-010',
      description: 'WMM (Wet Mix Macadam) sub-base layer',
      unit: 'cum', quantity: 2000, rate: 1200, amount: 2_400_000,
      type: CostType.MATERIAL,
      resourceId: resources['WMM (Wet Mix Macadam)'].id,
    },
  });

  const estItemDbm = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec2.id, itemCode: 'O-011',
      description: 'DBM (Dense Bituminous Macadam) 40mm course',
      unit: 'sqm', quantity: 15000, rate: 650, amount: 975_000,
      type: CostType.MATERIAL,
      resourceId: resources['DBM Mix Material (per ton)'].id,
    },
  });

  const estItemRoadMark = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec2.id, itemCode: 'O-012',
      description: 'Road marking & thermoplastic signage',
      unit: 'lot', quantity: 1, rate: 375_000, amount: 375_000,
      type: CostType.SUBCONTRACTOR,
    },
  });

  // Section 3: Finishing & Signage (2 items, 1 RA-linked)
  const estItemDistemper = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec3.id, itemCode: 'O-020',
      description: 'Distemper painting on median walls',
      unit: 'sqm', quantity: 2000, rate: 85, amount: 170_000,
      type: CostType.MATERIAL,
      rateAnalysisId: raDistemper.id,  // RA-linked
    },
  });

  const estItemSignage = await prisma.estimateItem.create({
    data: {
      estimateId: estimate1.id, sectionId: estSec3.id, itemCode: 'O-021',
      description: 'Metal signage & retro-reflective boards',
      unit: 'Nos', quantity: 40, rate: 5250, amount: 210_000,
      type: CostType.MATERIAL,
    },
  });

  // BOQ items linked to estimate items (estimate→BOQ conversion chain)
  const boqEarth = await prisma.bOQItem.create({
    data: {
      projectId: project1.id, itemCode: 'BOQ-001',
      description: 'Earthwork excavation in ordinary soil',
      unit: 'cum', quantity: 5000, rate: 145, amount: 725_000,
      category: 'EARTHWORK',
      estimateItemId: estItemEarthwork.id,
    },
  });

  const boqPcc = await prisma.bOQItem.create({
    data: {
      projectId: project1.id, itemCode: 'BOQ-002',
      description: 'PCC M15 (1:2:4) in foundation',
      unit: 'cum', quantity: 150, rate: 5200, amount: 780_000,
      category: 'MATERIAL',
      resourceId: resources['OPC Cement 53 Grade'].id,
      estimateItemId: estItemPcc.id,
    },
  });

  // SUBCONTRACTOR BOQ item (needed for from-boq WO creation test)
  const boqSubcontractor = await prisma.bOQItem.create({
    data: {
      projectId: project1.id, itemCode: 'BOQ-003',
      description: 'Road marking & thermoplastic signage',
      unit: 'lot', quantity: 1, rate: 375_000, amount: 375_000,
      category: 'SUBCONTRACTOR',
      estimateItemId: estItemRoadMark.id,
    },
  });

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

  // Change orders (VO-001 approved + converted to BOQ; VO-002 submitted)
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

  // ----------------------------------------------------------------
  // PROCUREMENT: Requisition → PO → GRN → Stock
  // ----------------------------------------------------------------
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
            boqItemId: boqPcc.id,
            expectedRate: 435,
            rateSource: 'PROJECT',
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

  // Mark BOQ-002 as procured (500 bag received against 200 cum sanctioned)
  await prisma.bOQItem.update({
    where: { id: boqPcc.id },
    data: { procuredQty: 500 },
  });

  await applyStockIn(stockLoc.id, grn1.id, [
    { resourceId: resources['OPC Cement 53 Grade'].id, quantity: 500 },
  ]);

  // ----------------------------------------------------------------
  // SUBCONTRACT: Subcontractor → WO → Measurements → Bill
  // ----------------------------------------------------------------
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

  // Approved measurement → linked vendor bill (like Trail's pattern)
  const measApproved = await prisma.subcontractMeasurement.create({
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

  // Vendor bill linked to subcontractor measurement
  await prisma.bill.create({
    data: {
      projectId: project1.id,
      companyId: company.id,
      billNumber: 'SC-WO-001-FEB',
      vendorName: subbie.name,
      vendorGstin: subbie.gstin,
      billDate: new Date('2025-03-01'),
      status: 'APPROVED',
      approvedBy: pm.id,
      subtotal: 180_000,
      retentionAmount: 9_000,
      advanceRecoveryAmount: 5_000,
      tdsRate: 1,
      tdsAmount: 1_665,
      total: 164_335,
      paidAmount: 50_000,
      category: 'SUBCONTRACTOR',
      workOrderId: wo.id,
      measurementId: measApproved.id,
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
      estimateId: estimate1.id,
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
      sourceRef: 'NH-45 Baseline Estimate',
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

  // Second measurement is DRAFT (not duplicate APPROVED — spec §2.20.2.C nit #1)
  await prisma.subcontractMeasurement.create({
    data: {
      workOrderId: wo.id,
      periodLabel: 'Mar 2025',
      status: 'DRAFT',
      totalAmount: 220_000,
      lines: {
        create: [
          {
            description: 'Excavation - chainage 500m to 1km (draft)',
            quantity: 440,
            unit: 'cum',
            rate: 500,
            amount: 220_000,
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
  // Daily Reports (5 reports across the earthwork week)
  // Note: stockLoc has 500 bag OPC Cement on hand. Total drawn here = 90 bag.
  // ----------------------------------------------------------------
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

  // eslint-disable-next-line no-console
  console.log('   Seeded 5 daily reports on NH-45');

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