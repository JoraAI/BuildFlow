/**
 * BuildFlow - Jest global teardown.
 * FIX (DAT-3.8): Disconnects Prisma and Redis so Jest exits cleanly
 * without --forceExit.
 */
export default async function teardown() {
  try {
    const { closeQueues } = await import('../lib/queue');
    await closeQueues();
  } catch {
    // queues may not be initialized
  }
  try {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  } catch {
    // prisma may not be initialized
  }
}
