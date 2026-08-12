/**
 * Backfill: For estimate items with rateAnalysisId but no resourceId,
 * check if the rate analysis has exactly 1 MATERIAL component.
 * If yes → set estimateItem.resourceId to that component's resourceId.
 * If multiple materials → leave as-is (composite, explodes via RA).
 *
 * Run: cd apps/backend && pnpm exec tsx prisma/backfill-ra-resource-links.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Backfill: RA → Resource Links ===\n');

  // Get all estimate items with rateAnalysisId but no resourceId
  const items = await prisma.$queryRaw`
    SELECT ei.id, ei.rate_analysis_id, ei.description
    FROM estimate_items ei
    WHERE ei.rate_analysis_id IS NOT NULL
      AND ei.resource_id IS NULL
  ` as any[];
  console.log(`Found ${items.length} estimate items with rateAnalysisId but no resourceId`);

  let updated = 0, skipped = 0;

  for (const item of items) {
    // Get the rate analysis components (MATERIAL type only)
    const components = await prisma.$queryRaw`
      SELECT resource_id, type FROM rate_analysis_components
      WHERE rate_analysis_id = ${item.rate_analysis_id}::uuid
        AND resource_id IS NOT NULL
        AND type = 'MATERIAL'
    ` as any[];

    if (components.length === 1) {
      // Single material - set resourceId
      const resourceId = components[0].resource_id;
      await prisma.$executeRaw`
        UPDATE estimate_items SET resource_id = ${resourceId}::uuid WHERE id = ${item.id}::uuid
      `;
      updated++;
      console.log(`  ✓ ${item.description?.slice(0, 40)} → ${resourceId.slice(0, 8)}...`);
    } else if (components.length > 1) {
      // Multiple materials - leave as composite
      skipped++;
    } else {
      // No MATERIAL components - leave as-is
      skipped++;
    }
  }

  console.log(`\nUpdated: ${updated}, Skipped (multi-material): ${skipped}`);

  // Verify
  const totalItems = await prisma.estimateItem.count();
  const linkedItems = await prisma.estimateItem.count({ where: { resourceId: { not: null } } });
  console.log(`\n=== SUMMARY ===`);
  console.log(`Estimate Items with resourceId: ${linkedItems}/${totalItems} (${((linkedItems / totalItems) * 100).toFixed(1)}%)`);
  console.log('Done!');
}

main().catch((e) => { console.error('Failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());