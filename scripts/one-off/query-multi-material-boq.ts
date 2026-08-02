/**
 * Query: Find BOQ items with multiple materials in a project.
 * Run: cd apps/backend && pnpm exec tsx prisma/query-multi-material-boq.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find project "Prp-001"
  const project = await prisma.project.findFirst({
    where: { OR: [{ name: { contains: 'Prp-001', mode: 'insensitive' } }, { code: { contains: 'Prp-001', mode: 'insensitive' } }] },
    select: { id: true, name: true },
  });
  if (!project) { console.log('Project "Prp-001" not found'); return; }
  console.log(`Project: ${project.name} (${project.id})\n`);

  // Get BOQ items with rateAnalysisId (composite items)
  const boqItems = await prisma.$queryRaw`
    SELECT b.item_code, b.description, b.unit, b.quantity, b.rate,
           ei.rate_analysis_id
    FROM boq_items b
    LEFT JOIN estimate_items ei ON b.estimate_item_id = ei.id
    WHERE b.project_id = ${project.id}::uuid
      AND b.is_superseded = false
      AND ei.rate_analysis_id IS NOT NULL
    ORDER BY b.item_code
  ` as any[];

  console.log(`=== Composite BOQ Items (${boqItems.length}) ===\n`);
  for (const b of boqItems) {
    const components = await prisma.$queryRaw`
      SELECT rac.resource_id, rac.type, rac.quantity_per_unit, rac.unit,
             r.name as resource_name
      FROM rate_analysis_components rac
      LEFT JOIN resources r ON rac.resource_id = r.id
      WHERE rac.rate_analysis_id = ${b.rate_analysis_id}::uuid
      ORDER BY rac.type
    ` as any[];

    const materialCount = components.filter(c => c.type === 'MATERIAL').length;
    const totalComponents = components.length;

    console.log(`${b.item_code} · ${b.description}`);
    console.log(`  BOQ: ${b.quantity} ${b.unit} @ Rs ${b.rate}`);
    console.log(`  Components: ${totalComponents} (${materialCount} MATERIAL, ${totalComponents - materialCount} other)`);
    for (const c of components) {
      console.log(`    ${c.type}: ${c.resource_name ?? 'no name'} - ${c.quantity_per_unit} ${c.unit}`);
    }
    console.log('');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());