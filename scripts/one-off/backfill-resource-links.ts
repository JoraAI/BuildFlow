/**
 * One-time backfill: Link all EstimateItems to catalog Resources.
 * For items without resourceId: match by name or create new resource.
 *
 * Run: cd apps/backend && pnpm exec tsx prisma/backfill-resource-links.ts
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const DEFAULT_UNIT: Record<string, string> = {
  MATERIAL: 'unit', LABOUR: 'day', EQUIPMENT: 'day', SUBCONTRACTOR: 'lot',
};
const DEFAULT_HSN_SAC: Record<string, string> = {
  MATERIAL: '', LABOUR: '9985', EQUIPMENT: '9973', SUBCONTRACTOR: '9985',
};

async function main() {
  console.log('=== Backfill: Resource Links ===\n');

  const allResources = await prisma.resource.findMany({ select: { id: true, name: true, type: true, unit: true } });
  const resourcesByName = new Map<string, typeof allResources[0]>();
  for (const r of allResources) resourcesByName.set(r.name.toLowerCase().trim(), r);
  console.log(`Loaded ${allResources.length} resources for matching`);

  // ─── Estimate Items ──────────────────────────────────────────────
  console.log('\n--- Estimate Items ---');
  const items = await prisma.$queryRaw`
    SELECT ei.*, e.company_id
    FROM estimate_items ei
    JOIN estimates e ON ei.estimate_id = e.id
    WHERE ei.resource_id IS NULL AND ei.rate_analysis_id IS NULL
  ` as any[];
  console.log(`Found ${items.length} estimate items without resourceId or rateAnalysisId`);

  let linked = 0, created = 0, skipped = 0, errors = 0;

  for (const item of items) {
    const companyId = item.company_id;
    if (!companyId) { skipped++; continue; }

    // Map estimate item type → Resource type enum
    // (Resource type is an enum: MATERIAL, LABOUR, EQUIPMENT, SUBCONTRACTOR)
    const rawType = (item.type as string) || 'MATERIAL';
    const resourceType = rawType === 'MISC' ? 'MATERIAL' : rawType;
    const name = (item.description as string)?.trim();
    if (!name) { skipped++; continue; }

    const key = name.toLowerCase();
    const existing = resourcesByName.get(key);
    let resourceId: string;

    if (existing) {
      resourceId = existing.id;
      linked++;
    } else {
      const newResource = await prisma.resource.create({
        data: {
          id: uuidv4(), companyId, name, type: resourceType as any,
          unit: item.unit || DEFAULT_UNIT[resourceType] || 'unit',
          rate: Number(item.rate), gstRate: 0,
          hsnSacCode: DEFAULT_HSN_SAC[resourceType] || null, isActive: true,
        },
      });
      resourcesByName.set(key, newResource);
      resourceId = newResource.id;
      created++;
    }

    try {
      await prisma.$executeRaw`
        UPDATE estimate_items SET resource_id = ${resourceId}::uuid WHERE id = ${item.id}::uuid
      `;
    } catch (e) { console.error(`  Error: ${e}`); errors++; }
  }

  console.log(`  Linked: ${linked}, Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);

  // ─── SUMMARY ─────────────────────────────────────────────────────
  const totalItems = await prisma.estimateItem.count();
  const linkedItems = await prisma.estimateItem.count({ where: { resourceId: { not: null } } });
  console.log(`\n=== SUMMARY ===`);
  console.log(`Estimate Items: ${linkedItems}/${totalItems} linked (${((linkedItems / totalItems) * 100).toFixed(1)}%)`);
  console.log(`Total resources: ${allResources.length} → ${resourcesByName.size}`);
  console.log('\nDone!');
}

main().catch((e) => { console.error('Failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());