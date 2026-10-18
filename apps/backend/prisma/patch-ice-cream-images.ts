/**
 * Patch Frosty Cups finished-goods imageUrl + category (no full reseed).
 *
 *   cd apps/backend && pnpm exec tsx prisma/patch-ice-cream-images.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FG_IMAGES: Record<string, string> = {
  'FG-VAN-100':
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80',
  'FG-CHOC-100':
    'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?auto=format&fit=crop&w=400&q=80',
  'FG-CHOC-1L':
    'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=400&q=80',
  'FG-STRW-100':
    'https://images.unsplash.com/photo-1488900128323-2150794f0adf?auto=format&fit=crop&w=400&q=80',
};

async function main() {
  for (const [sku, imageUrl] of Object.entries(FG_IMAGES)) {
    const result = await prisma.resource.updateMany({
      where: { sku, isDeleted: false },
      data: { imageUrl, category: 'Finished goods' },
    });
    // eslint-disable-next-line no-console
    console.log(`Updated ${result.count} row(s) for ${sku}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
