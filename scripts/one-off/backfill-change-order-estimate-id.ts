/**
 * EST-VO-11f: One-off backfill script - sets `estimateId` on existing change orders
 * by resolving the latest APPROVED parent estimate per project.
 *
 * Usage:
 *   npx tsx scripts/one-off/backfill-change-order-estimate-id.ts
 */
import { PrismaClient, EstimateStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cos = await prisma.changeOrder.findMany({
    where: { estimateId: null },
    select: { id: true, projectId: true, companyId: true },
  });

  let updated = 0;
  for (const co of cos) {
    const est = await prisma.estimate.findFirst({
      where: {
        projectId: co.projectId,
        companyId: co.companyId,
        status: EstimateStatus.APPROVED,
        parentId: null,
      },
      orderBy: { approvedAt: 'desc' },
      select: { id: true },
    });

    if (est) {
      await prisma.changeOrder.update({
        where: { id: co.id },
        data: { estimateId: est.id },
      });
      updated++;
    }
  }

  console.log(`Backfilled ${updated} of ${cos.length} change orders with estimateId.`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });