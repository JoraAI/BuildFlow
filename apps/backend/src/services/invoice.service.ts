/**
 * BuildFlow - Invoice service (GST-compliant invoicing).
 */
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { calculateGST, lineAmount, sumAmounts, round2 } from './gst.service';
import { nextSequentialNumberTx } from '../lib/id-generator';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  RecordPaymentInput,
} from '@buildflow/shared';

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  invoiceDate: Date;
  dueDate: Date;
  status: string;
  invoiceType: string;
  raSequence: number | null;
  retentionPct: number;
  subtotal: number;
  gstAmount: number;
  tdsAmount: number;
  total: number;
  paidAmount: number;
  project: { id: string; name: string };
}

function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

function serialize(inv: {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientGstin: string | null;
  invoiceDate: Date;
  dueDate: Date;
  status: string;
  subtotal: Decimal;
  gstRate: Decimal;
  gstAmount: Decimal;
  cgstAmount: Decimal;
  sgstAmount: Decimal;
  igstAmount: Decimal;
  tdsRate: Decimal;
  tdsAmount: Decimal;
  total: Decimal;
  paidAmount: Decimal;
  notes: string | null;
  invoiceType?: string;
  raSequence?: number | null;
  milestoneLabel?: string | null;
  retentionPct?: Decimal;
  retentionAmount?: Decimal;
  previousCertifiedTotal?: Decimal;
  currentCertifiedTotal?: Decimal;
  cumulativeCertifiedTotal?: Decimal;
  project: { id: string; name: string; clientName?: string };
  lineItems: Array<{
    id: string;
    description: string;
    quantity: Decimal;
    unit: string;
    rate: Decimal;
    amount: Decimal;
    gstRate: Decimal;
    hsnSacCode: string | null;
  }>;
}) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientGstin: inv.clientGstin,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    status: inv.status,
    invoiceType: inv.invoiceType ?? 'STANDARD',
    raSequence: inv.raSequence ?? null,
    milestoneLabel: inv.milestoneLabel ?? null,
    retentionPct: toNum(inv.retentionPct),
    retentionAmount: toNum(inv.retentionAmount),
    previousCertifiedTotal: toNum(inv.previousCertifiedTotal),
    currentCertifiedTotal: toNum(inv.currentCertifiedTotal),
    cumulativeCertifiedTotal: toNum(inv.cumulativeCertifiedTotal),
    subtotal: toNum(inv.subtotal),
    gstRate: toNum(inv.gstRate),
    gstAmount: toNum(inv.gstAmount),
    cgstAmount: toNum(inv.cgstAmount),
    sgstAmount: toNum(inv.sgstAmount),
    igstAmount: toNum(inv.igstAmount),
    tdsRate: toNum(inv.tdsRate),
    tdsAmount: toNum(inv.tdsAmount),
    total: toNum(inv.total),
    paidAmount: toNum(inv.paidAmount),
    notes: inv.notes,
    project: inv.project,
    lineItems: inv.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: toNum(li.quantity),
      unit: li.unit,
      rate: toNum(li.rate),
      amount: toNum(li.amount),
      gstRate: toNum(li.gstRate),
      hsnSacCode: li.hsnSacCode,
    })),
  };
}

async function getCompanyState(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw ApiError.notFound('Company');
  return company.state;
}

export async function listInvoices(
  companyId: string,
  projectId?: string,
  status?: string,
): Promise<InvoiceListItem[]> {
  const where: Record<string, unknown> = { companyId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { invoiceDate: 'desc' },
    include: { project: { select: { id: true, name: true } } },
  });
  return invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientName: i.clientName,
    invoiceDate: i.invoiceDate,
    dueDate: i.dueDate,
    status: i.status,
    invoiceType: i.invoiceType,
    raSequence: i.raSequence,
    retentionPct: toNum(i.retentionPct),
    subtotal: toNum(i.subtotal),
    gstAmount: toNum(i.gstAmount),
    tdsAmount: toNum(i.tdsAmount),
    total: toNum(i.total),
    paidAmount: toNum(i.paidAmount),
    project: i.project,
  }));
}

export async function getInvoice(companyId: string, id: string) {
  const inv = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      project: { select: { id: true, name: true, clientName: true } },
      lineItems: { orderBy: { id: 'asc' } },
    },
  });
  if (!inv) throw ApiError.notFound('Invoice');
  return serialize(inv);
}

/**
 * FIX (FIN-H4): Wrap the entire RA sequence lookup + invoice create in a
 * $transaction so two concurrent RA invoice creations can't produce duplicate
 * raSequence values or incorrect previousCertifiedTotal. Also compute retention
 * on the current certified delta (currentCertifiedTotal), not the cumulative —
 * retention is held back from THIS payment, not re-deducted from prior totals.
 */
export async function createInvoice(companyId: string, _userId: string, input: CreateInvoiceInput) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, companyId },
  });
  if (!project) throw ApiError.notFound('Project');

  const companyState = await getCompanyState(companyId);
  const invoiceType = input.invoiceType ?? 'STANDARD';

  // FIX (NR-23): Catch P2002 (unique constraint violation on invoice number or
  // RA sequence partial index) and return a clean 409 instead of hanging.
  try {
    return await prisma.$transaction(async (tx) => {
    let lineAmounts = input.lineItems.map((li) => {
      if (invoiceType === 'RUNNING_ACCOUNT') {
        const currentQty = li.currentQty ?? li.quantity;
        const cumulativeQty = li.cumulativeQty ?? currentQty;
        const amount = lineAmount(currentQty, li.rate);
        return {
          ...li,
          quantity: currentQty,
          currentQty,
          previousQty: li.previousQty ?? 0,
          cumulativeQty,
          certifiedAmount: amount,
          amount,
        };
      }
      const amount = lineAmount(li.quantity, li.rate);
      return { ...li, amount, certifiedAmount: amount };
    });

    const subtotal = sumAmounts(lineAmounts.map((li) => li.amount));

    let previousCertifiedTotal = 0;
    let raSequence = input.raSequence;
    if (invoiceType === 'RUNNING_ACCOUNT') {
      // FIX (NR-23): The partial unique index on (project_id, ra_sequence)
      // counts ALL non-null values — including DRAFT invoices. Previously the
      // max was computed over non-DRAFT only, so re-running the test produced
      // a DRAFT with the same raSequence as the previous run's DRAFT → P2002.
      // Now compute max over ALL RA invoices (incl. DRAFT) for the sequence,
      // but compute previousCertifiedTotal from certified (non-DRAFT) bills only.
      const seqMax = await tx.invoice.aggregate({
        where: { projectId: input.projectId, companyId, invoiceType: 'RUNNING_ACCOUNT', raSequence: { not: null } },
        _max: { raSequence: true },
      });
      if (raSequence == null) {
        raSequence = (seqMax._max.raSequence ?? 0) + 1;
      }
      // previousCertifiedTotal: only from certified (non-DRAFT) invoices.
      const prev = await tx.invoice.findMany({
        where: { projectId: input.projectId, companyId, invoiceType: 'RUNNING_ACCOUNT', status: { not: 'DRAFT' } },
        select: { cumulativeCertifiedTotal: true, raSequence: true },
        orderBy: { raSequence: 'desc' },
        take: 1,
      });
      previousCertifiedTotal = prev[0] ? Number(prev[0].cumulativeCertifiedTotal) : 0;
    }

    const currentCertifiedTotal = subtotal;
    const cumulativeCertifiedTotal = round2(previousCertifiedTotal + currentCertifiedTotal);
    const retentionPct = input.retentionPct ?? 0;
    // FIX (FIN-H4): Retention applies to the CURRENT certified amount (this bill's
    // portion), not the cumulative total. Prior bills already had their retention deducted.
    const retentionAmount = round2((currentCertifiedTotal * retentionPct) / 100);

    const gst = calculateGST({
      subtotal: currentCertifiedTotal,
      gstRate: input.gstRate,
      tdsEnabled: input.tdsEnabled,
      tdsRate: input.tdsRate,
      companyState,
      clientState: input.clientState,
    });

    const totalAfterRetention = round2(gst.netPayable - retentionAmount);

    // FIX (R2-13): Use the tx-bound counter so the invoice number increment
    // participates in the same transaction as the invoice create.
    const invoiceNumber = input.invoiceNumber || await nextSequentialNumberTx(tx, companyId, 'invoice');

    return tx.invoice.create({
      data: {
        projectId: input.projectId,
        companyId,
        invoiceNumber,
        clientName: input.clientName,
        clientGstin: input.clientGstin,
        // FIX (FIN-H3): Persist clientState at create time so edits keep it.
        clientState: input.clientState ?? null,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        status: 'DRAFT',
        invoiceType,
        raSequence,
        milestoneLabel: input.milestoneLabel,
        retentionPct,
        retentionAmount,
        previousCertifiedTotal,
        currentCertifiedTotal,
        cumulativeCertifiedTotal,
        subtotal: currentCertifiedTotal,
        gstRate: input.gstRate,
        gstAmount: gst.gstAmount,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        igstAmount: gst.igstAmount,
        tdsRate: input.tdsEnabled ? input.tdsRate : 0,
        tdsAmount: gst.tdsAmount,
        total: totalAfterRetention,
        paidAmount: 0,
        notes: input.notes,
        lineItems: {
          create: lineAmounts.map((li) => ({
            boqItemId: li.boqItemId,
            description: li.description,
            quantity: li.quantity,
            unit: li.unit,
            rate: li.rate,
            amount: li.amount,
            gstRate: li.gstRate,
            hsnSacCode: li.hsnSacCode,
            previousQty: li.previousQty ?? 0,
            currentQty: li.currentQty ?? li.quantity,
            cumulativeQty: li.cumulativeQty ?? li.quantity,
            certifiedAmount: li.certifiedAmount ?? li.amount,
          })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        lineItems: true,
      },
    });
    }); // end $transaction
  } catch (err) {
    // FIX (NR-23): P2002 = unique constraint violation (invoice number or RA
    // sequence partial index). Surface as a clean 409, not a 30s hang/retry.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict(
        'This invoice number or RA sequence already exists (possible concurrent edit). Please retry.',
      );
    }
    throw err;
  }
}

/**
 * FIX (FIN-H3/NR-5): On update:
 * 1. Persist + default `clientState`: use the request value if provided, else
 *    the invoice's stored `clientState`, else fall back to undefined (which
 *    calculateGST treats as inter-state). Previously clientState was never
 *    stored, so every edit flipped CGST/SGST → IGST.
 * 2. Re-apply retention for ALL invoice types (NR-5): previously only
 *    RUNNING_ACCOUNT re-deducted retention on update, so editing a STANDARD
 *    invoice that had retention wrote retentionAmount: 0 and inflated total.
 * 3. Recompute RA cumulative fields when invoiceType is RUNNING_ACCOUNT.
 */
export async function updateInvoice(
  companyId: string,
  id: string,
  input: UpdateInvoiceInput,
) {
  const inv = await prisma.invoice.findFirst({ where: { id, companyId } });
  if (!inv) throw ApiError.notFound('Invoice');
  if (inv.status === 'PAID') throw ApiError.conflict('Cannot edit a paid invoice');

  const companyState = await getCompanyState(companyId);
  const gstRate = input.gstRate ?? Number(inv.gstRate);
  const tdsEnabled = input.tdsEnabled ?? Number(inv.tdsAmount) > 0;
  const tdsRate = input.tdsRate ?? Number(inv.tdsRate);

  // FIX (FIN-H3): Default clientState to the stored invoice state, then the
  // company state, so intra-state invoices keep CGST/SGST across edits.
  const clientState = input.clientState ?? inv.clientState ?? undefined;

  const invoiceType = inv.invoiceType ?? 'STANDARD';
  const retentionPct = Number(inv.retentionPct);

  let subtotal = Number(inv.subtotal);
  let lineItemsData: Record<string, unknown> | undefined;
  let currentCertifiedTotal = subtotal;

  if (input.lineItems) {
    if (invoiceType === 'RUNNING_ACCOUNT') {
      const lineAmounts = input.lineItems.map((li) => {
        const currentQty = li.currentQty ?? li.quantity;
        const cumulativeQty = li.cumulativeQty ?? currentQty;
        const amount = lineAmount(currentQty, li.rate);
        return {
          ...li,
          quantity: currentQty,
          currentQty,
          previousQty: li.previousQty ?? 0,
          cumulativeQty,
          certifiedAmount: amount,
          amount,
        };
      });
      currentCertifiedTotal = sumAmounts(lineAmounts.map((li) => li.amount));
      subtotal = currentCertifiedTotal;
      lineItemsData = {
        deleteMany: {},
        create: lineAmounts.map((li) => ({
          boqItemId: li.boqItemId,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          rate: li.rate,
          amount: li.amount,
          gstRate: li.gstRate,
          hsnSacCode: li.hsnSacCode,
          previousQty: li.previousQty ?? 0,
          currentQty: li.currentQty ?? li.quantity,
          cumulativeQty: li.cumulativeQty ?? li.quantity,
          certifiedAmount: li.certifiedAmount ?? li.amount,
        })),
      };
    } else {
      const lineAmounts = input.lineItems.map((li) => ({
        ...li,
        amount: lineAmount(li.quantity, li.rate),
      }));
      subtotal = sumAmounts(lineAmounts.map((li) => li.amount));
      currentCertifiedTotal = subtotal;
      lineItemsData = {
        deleteMany: {},
        create: lineAmounts.map((li) => ({
          boqItemId: li.boqItemId,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          rate: li.rate,
          amount: li.amount,
          gstRate: li.gstRate,
          hsnSacCode: li.hsnSacCode,
        })),
      };
    }
  }

  const gst = calculateGST({
    subtotal: currentCertifiedTotal,
    gstRate,
    tdsEnabled,
    tdsRate,
    companyState,
    clientState,
  });

  // FIX (NR-5): Recompute retention for ALL invoice types, not just
  // RUNNING_ACCOUNT. Previously editing a STANDARD invoice that had retention
  // wrote retentionAmount: 0 and inflated total.
  let total = gst.netPayable;
  const retentionAmount = round2((currentCertifiedTotal * retentionPct) / 100);
  let cumulativeCertifiedTotal = Number(inv.cumulativeCertifiedTotal);
  if (invoiceType === 'RUNNING_ACCOUNT') {
    const previousCertifiedTotal = Number(inv.previousCertifiedTotal);
    cumulativeCertifiedTotal = round2(previousCertifiedTotal + currentCertifiedTotal);
  }
  total = round2(gst.netPayable - retentionAmount);

  return prisma.invoice.update({
    where: { id },
    data: {
      clientName: input.clientName,
      clientGstin: input.clientGstin,
      // FIX (FIN-H3): Persist the resolved clientState so it survives edits.
      clientState,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      gstRate,
      tdsRate: tdsEnabled ? tdsRate : 0,
      subtotal: currentCertifiedTotal,
      gstAmount: gst.gstAmount,
      cgstAmount: gst.cgstAmount,
      sgstAmount: gst.sgstAmount,
      igstAmount: gst.igstAmount,
      tdsAmount: gst.tdsAmount,
      total,
      retentionPct,
      retentionAmount,
      currentCertifiedTotal,
      cumulativeCertifiedTotal,
      notes: input.notes,
      lineItems: lineItemsData,
    },
    include: {
      project: { select: { id: true, name: true } },
      lineItems: true,
    },
  });
}

export async function sendInvoice(companyId: string, id: string) {
  const inv = await prisma.invoice.findFirst({ where: { id, companyId } });
  if (!inv) throw ApiError.notFound('Invoice');
  if (inv.status === 'PAID') throw ApiError.conflict('Invoice already paid');
  return prisma.invoice.update({
    where: { id },
    data: { status: 'SENT' },
  });
}

/**
 * FIX (FIN-H2/NR-11): Reject DRAFT invoices, block overpayment, wrap in
 * transaction, forward-only status. The read + overpay check + write now all
 * happen INSIDE the transaction (NR-11: previously the read was outside, so two
 * concurrent payments both passed the check and the absolute paidAmount write
 * lost one). We use a guarded relative increment so only one concurrent payment
 * can apply; a 0-count means another payment won the race and we retry.
 */
export async function recordPayment(
  companyId: string,
  userId: string,
  id: string,
  input: RecordPaymentInput,
) {
  return prisma.$transaction(async (tx) => {
    // NR-11: Read inside the transaction so the overpay guard is race-safe.
    const inv = await tx.invoice.findFirst({ where: { id, companyId } });
    if (!inv) throw ApiError.notFound('Invoice');

    // FIX (FIN-H2): Reject DRAFT invoices.
    if (inv.status === 'DRAFT') {
      throw ApiError.badRequest('Cannot record a payment on a DRAFT invoice');
    }

    const currentPaid = Number(inv.paidAmount);
    const total = Number(inv.total);
    const expectedPaidAfter = round2(currentPaid + input.amount);

    // FIX (FIN-H2): Block overpayment.
    if (expectedPaidAfter > total) {
      throw ApiError.badRequest(
        `Payment of Rs ${input.amount} would exceed the invoice total of Rs ${total}. ` +
          `Already paid: Rs ${currentPaid}.`,
      );
    }

    // NR-11: Guarded relative increment — only applies if paidAmount is still
    // the value we read. count === 0 means a concurrent payment changed it; we
    // throw a conflict so the caller can retry rather than silently overwriting.
    const isFullyPaid = expectedPaidAfter >= total;
    // Forward-only status: never regress PAID → SENT; never go OVERDUE → SENT on
    // partial payment (NR-11: previously OVERDUE→SENT regressed on partial pay).
    const nextStatus = isFullyPaid ? 'PAID' : inv.status === 'PAID' ? 'PAID' : inv.status;

    const result = await tx.invoice.updateMany({
      where: { id, paidAmount: inv.paidAmount },
      data: {
        paidAmount: { increment: input.amount },
        status: nextStatus,
      },
    });

    if (result.count === 0) {
      throw ApiError.conflict(
        'This invoice was modified by another payment. Please retry.',
      );
    }

    await tx.journalEntry.create({
      data: {
        companyId,
        projectId: inv.projectId,
        entryDate: input.paymentDate ?? new Date(),
        description: `Payment received for invoice ${inv.invoiceNumber}`,
        reference: input.reference ?? inv.invoiceNumber,
        debitAccount: 'Bank/Cash',
        creditAccount: 'Accounts Receivable',
        amount: input.amount,
        createdBy: userId,
      },
    });

    return tx.invoice.findUniqueOrThrow({ where: { id } });
  });
}

export async function deleteInvoice(companyId: string, id: string) {
  const inv = await prisma.invoice.findFirst({ where: { id, companyId } });
  if (!inv) throw ApiError.notFound('Invoice');
  if (inv.status !== 'DRAFT') {
    throw ApiError.conflict('Only DRAFT invoices can be deleted');
  }
  return prisma.invoice.delete({ where: { id } });
}