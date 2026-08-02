import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  const labour9954 = await p.resource.count({ where: { type: 'LABOUR', hsnSacCode: '9954' } });
  const labourTotal = await p.resource.count({ where: { type: 'LABOUR' } });
  const equip9973 = await p.resource.count({ where: { type: 'EQUIPMENT', hsnSacCode: '9973' } });
  const equipTotal = await p.resource.count({ where: { type: 'EQUIPMENT' } });
  const materialWithHsn = await p.resource.count({ where: { type: 'MATERIAL', NOT: { hsnSacCode: null } } });
  const materialTotal = await p.resource.count({ where: { type: 'MATERIAL' } });
  const noCode = await p.resource.count({ where: { hsnSacCode: null } });
  const noCodeItems = await p.resource.findMany({ where: { hsnSacCode: null }, select: { name: true, type: true } });
  console.log('=== SAC/HSN CODE VERIFICATION ===');
  console.log(`LABOUR with SAC 9954: ${labour9954} / ${labourTotal}`);
  console.log(`EQUIPMENT with SAC 9973: ${equip9973} / ${equipTotal}`);
  console.log(`MATERIAL with HSN: ${materialWithHsn} / ${materialTotal}`);
  console.log(`Items with NO code at all: ${noCode}`);
  if (noCodeItems.length > 0) {
    console.log('Missing items:', noCodeItems.map((i) => `${i.name} (${i.type})`).join(', '));
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});