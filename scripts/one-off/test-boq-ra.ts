/**
 * Quick test: Check if BOQ items have rateAnalysisId in the API response.
 * Run: cd apps/backend && pnpm exec tsx prisma/test-boq-ra.ts
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const boq = await prisma.bOQItem.findFirst({
    where: { description: { contains: 'BC 40mm', mode: 'insensitive' }, isSuperseded: false },
    include: {
      estimateItem: { select: { id: true, rateAnalysisId: true, description: true } },
    },
  });

  if (!boq) {
    console.log('BOQ item not found');
    return;
  }

  console.log('BOQ item:', boq.description);
  console.log('estimateItemId:', boq.estimateItemId);
  console.log('estimateItem.rateAnalysisId:', boq.estimateItem?.rateAnalysisId ?? 'NULL');

  if (boq.estimateItem?.rateAnalysisId) {
    const ra = await prisma.rateAnalysis.findUnique({
      where: { id: boq.estimateItem.rateAnalysisId },
      include: { components: { include: { resource: { select: { name: true } } } } },
    });
    console.log('\nRate Analysis:', ra?.name, '- totalRate:', ra?.totalRate?.toString());
    console.log('Components:');
    for (const c of ra?.components ?? []) {
      console.log(`  - ${c.resource?.name ?? c.miscName ?? 'Unknown'}: ${c.quantityPerUnit} ${c.unit} @ ${c.rate} (${c.type})`);
    }
  } else {
    console.log('\n⚠️  No rateAnalysisId linked - this BOQ item CANNOT explode');
  }
}

main().finally(() => prisma.$disconnect());