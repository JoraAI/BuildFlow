/**
 * One-time script: Backfill rateAnalysisId on BOQ items.
 *
 * Links BOQ items to rate analyses by matching the BOQ description to
 * the rate analysis name. This enables the "explode composite BOQ items
 * into materials" feature in the procurement indent.
 *
 * Run: pnpm --filter @buildflow/backend exec tsx prisma/backfill-boq-rate-analysis.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling rateAnalysisId on BOQ items...');

  // Get all active BOQ items that have an estimate item but no rateAnalysisId
  const boqItems = await prisma.bOQItem.findMany({
    where: {
      isSuperseded: false,
      estimateItemId: { not: null },
    },
    include: {
      estimateItem: { select: { id: true, rateAnalysisId: true, description: true } },
    },
  });

  console.log(`Found ${boqItems.length} active BOQ items with estimate links`);

  // Get all rate analyses for name matching
  const rateAnalyses = await prisma.rateAnalysis.findMany({
    select: { id: true, name: true },
  });
  console.log(`Found ${rateAnalyses.length} rate analyses for matching`);

  let updated = 0;
  let alreadyLinked = 0;
  let matched = 0;

  for (const boq of boqItems) {
    const estItem = boq.estimateItem;

    // Case 1: The estimate item already has rateAnalysisId (direct link)
    if (estItem?.rateAnalysisId) {
      // BOQ items don't have rateAnalysisId column - it's resolved via estimateItem
      // But we can verify it's accessible
      alreadyLinked++;
      continue;
    }

    // Case 2: Try to match by description/name
    const desc = boq.description.toLowerCase().trim();
    const match = rateAnalyses.find((ra) => {
      const raName = ra.name.toLowerCase().trim();
      // Match if rate analysis name is contained in BOQ description or vice versa
      return desc.includes(raName) || raName.includes(desc) ||
        // Also try partial match on first 20 chars
        (desc.length > 10 && raName.length > 10 && desc.slice(0, 20) === raName.slice(0, 20));
    });

    if (match) {
      // Update the estimate item to link the rate analysis
      await prisma.estimateItem.update({
        where: { id: estItem!.id },
        data: { rateAnalysisId: match.id },
      });
      matched++;
      updated++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Already linked (via estimate item): ${alreadyLinked}`);
  console.log(`Matched by name and linked: ${matched}`);
  console.log(`Total updated: ${updated}`);
  console.log(`Unmatched: ${boqItems.length - alreadyLinked - matched}`);

  // Also check for BOQ items WITHOUT estimate item links
  const orphanBoqItems = await prisma.bOQItem.count({
    where: {
      isSuperseded: false,
      estimateItemId: null,
    },
  });
  console.log(`\nBOQ items without estimate item link: ${orphanBoqItems} (cannot backfill these)`);

  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });