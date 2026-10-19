/**
 * Patch Frosty Cups: company logo + item imageUrl (FG / RM / packaging).
 * No full reseed.
 *
 *   cd apps/backend && pnpm exec tsx prisma/patch-ice-cream-images.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Company logo — prints top-right on inventory Tax Invoice PDFs. */
const COMPANY_LOGO =
  'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=256&h=256&q=80';

const ITEM_IMAGES: Record<string, string> = {
  // Finished goods
  'FG-VAN-100':
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80',
  'FG-CHOC-100':
    'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?auto=format&fit=crop&w=400&q=80',
  'FG-CHOC-1L':
    'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=400&q=80',
  'FG-STRW-100':
    'https://images.unsplash.com/photo-1488900128323-2150794f0adf?auto=format&fit=crop&w=400&q=80',
  // Raw materials
  'RAW-MILK':
    'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=400&q=80',
  'RAW-CREAM':
    'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80',
  'RAW-SUGAR':
    'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80',
  'RAW-COCOA':
    'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=400&q=80',
  'RAW-VAN':
    'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80',
  'RAW-STAB':
    'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=400&q=80',
  // Packaging
  'PKG-CUP-100':
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=80',
  'PKG-TUB-1L':
    'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=400&q=80',
  'PKG-CONE':
    'https://images.unsplash.com/photo-1557142046-c704a93ced90?auto=format&fit=crop&w=400&q=80',
};

async function main() {
  const logoResult = await prisma.company.updateMany({
    where: {
      subscriptionPlan: 'INVENTORY',
      OR: [
        { name: { contains: 'Frosty', mode: 'insensitive' } },
        { inventoryVertical: 'ICE_CREAM' },
      ],
    },
    data: { logoUrl: COMPANY_LOGO },
  });
  // eslint-disable-next-line no-console
  console.log(`Company logo set on ${logoResult.count} inventory company(ies)`);

  for (const [sku, imageUrl] of Object.entries(ITEM_IMAGES)) {
    const result = await prisma.resource.updateMany({
      where: { sku, isDeleted: false },
      data: { imageUrl },
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
