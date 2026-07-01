/**
 * Daily overdue invoice detection.
 *
 * Finds SENT invoices past their dueDate and transitions them to OVERDUE,
 * optionally notifying PM + Owner of the project.
 */
import { prisma } from '../lib/prisma';
import { runInCompanyContext } from '../lib/als';
import { notify } from '../services/notification.service';
import { logger } from '../config/logger';

export async function runInvoiceOverdueCron(): Promise<{ marked: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find SENT invoices whose due date has passed (not already OVERDUE/PAID)
  const overdue = await prisma.invoice.findMany({
    where: {
      status: 'SENT',
      dueDate: { lt: today },
    },
    include: {
      project: { select: { companyId: true, name: true } },
    },
  });

  let marked = 0;
  for (const inv of overdue) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'OVERDUE' },
    });
    marked += 1;

    // Notify PMs + Owners of the project within company ALS context
    try {
      await runInCompanyContext({ companyId: inv.companyId }, async () => {
        const recipients = await prisma.user.findMany({
          where: { companyId: inv.companyId, role: { in: ['OWNER', 'PM', 'ACCOUNTANT'] }, isActive: true },
          select: { id: true },
        });
        await Promise.all(
          recipients.map((u) =>
            notify({
              userId: u.id,
              companyId: inv.companyId,
              title: 'Invoice overdue',
              body:
                'Invoice ' +
                inv.invoiceNumber +
                ' (' +
                inv.project.name +
                ') is now overdue. Total: Rs ' +
                Number(inv.total).toLocaleString('en-IN') +
                '.',
              type: 'INVOICE_OVERDUE',
              referenceId: inv.id,
            }),
          ),
        );
      });
    } catch (err) {
      logger.warn('Overdue notification failed (non-fatal)', {
        invoiceId: inv.id,
        error: String(err),
      });
    }
  }

  if (marked > 0) {
    logger.info('Invoice overdue cron marked ' + marked + ' invoice(s) as OVERDUE');
  }

  return { marked };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startInvoiceOverdueCron(): void {
  const run = () => {
    runInvoiceOverdueCron().catch((err) => {
      logger.error('Invoice overdue cron failed', { error: String(err) });
    });
  };

  // Initial run after startup (2 min delay for DB readiness)
  setTimeout(run, 120_000);
  setInterval(run, DAY_MS);
  logger.info('Invoice overdue cron scheduled (daily)');
}
