/**
 * BuildFlow - Invoice service (GST-compliant invoicing).
 */
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { logger } from '../config/logger';
import { calculateGST, lineAmount, sumAmounts, round2 } from './gst.service';
import { nextSequentialNumber, nextSequentialNumberTx } from '../lib/id-generator';
// INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price overrides on sales lines.
import { resolveEffectiveRates } from './price-list.service';
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
  stockMovementId?: string | null;
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
  stockMovementId?: string | null;
  invoiceType?: string;
  raSequence?: number | null;
  milestoneLabel?: string | null;
  retentionPct?: Decimal;
  retentionAmount?: Decimal;
  previousCertifiedTotal?: Decimal;
  currentCertifiedTotal?: Decimal;
  cumulativeCertifiedTotal?: Decimal;
  clientState?: string | null;
  clientAddress?: string | null;
  clientPhone?: string | null;
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
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): optional catalog link.
    resourceId: string | null;
  }>;
}) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientGstin: inv.clientGstin,
    clientState: inv.clientState ?? null,
    // INVENTORY_UX_POLISH (D6): optional buyer contact details in responses.
    clientAddress: inv.clientAddress ?? null,
    clientPhone: inv.clientPhone ?? null,
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
    stockMovementId: inv.stockMovementId ?? null,
    projectId: inv.project.id,
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
      resourceId: li.resourceId,
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
    stockMovementId: i.stockMovementId,
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
 * on the current certified delta (currentCertifiedTotal), not the cumulative -
 * retention is held back from THIS payment, not re-deducted from prior totals.
 */
export async function createInvoice(companyId: string, _userId: string, input: CreateInvoiceInput) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, companyId },
  });
  if (!project) throw ApiError.notFound('Project');

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.1): customer must belong to this company.
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
  }

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): every optional resource link on an
  // invoice line must resolve to a catalog item of this company.
  const linkedResourceIds = input.lineItems.map((li) => li.resourceId).filter((id): id is string => !!id);
  if (linkedResourceIds.length > 0) {
    const found = await prisma.resource.count({
      where: { id: { in: linkedResourceIds }, companyId },
    });
    if (found !== linkedResourceIds.length) {
      throw ApiError.badRequest('One or more line items reference an item outside this company\'s catalog.');
    }
  }

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): customer credit-limit policy.
  // WARN (default) surfaces a non-blocking warning; BLOCK rejects the invoice.
  let creditLimitWarning: string | null = null;
  if (input.customerId) {
    const [customer, company] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { creditLimit: true, name: true },
      }),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { creditLimitPolicy: true },
      }),
    ]);
    const limit = Number(customer?.creditLimit ?? 0);
    if (limit > 0) {
      const open = await prisma.invoice.aggregate({
        where: { companyId, customerId: input.customerId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } },
        _sum: { total: true, paidAmount: true },
      });
      const outstanding = Math.max(0, Number(open._sum.total ?? 0) - Number(open._sum.paidAmount ?? 0));
      const projected =
        input.lineItems.reduce((s, li) => s + lineAmount(li.quantity, li.rate), 0) *
        (1 + (input.gstRate ?? 18) / 100);
      if (outstanding + projected > limit) {
        const msg = `${customer!.name} is over the credit limit: outstanding ${outstanding.toFixed(2)} + this invoice ${projected.toFixed(2)} > limit ${limit.toFixed(2)}.`;
        if (company?.creditLimitPolicy === 'BLOCK') {
          throw ApiError.unprocessable(msg);
        }
        creditLimitWarning = msg;
      }
    }
  }

  const companyState = await getCompanyState(companyId);
  const invoiceType = input.invoiceType ?? 'STANDARD';

  // FIX (NR-23): Catch P2002 (unique constraint violation on invoice number or
  // RA sequence partial index) and return a clean 409 instead of hanging.
  try {
    const created = await prisma.$transaction(async (tx) => {
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price-list override for
    // lines left at ₹0 when a resource is linked.
    const customerRateById = await resolveEffectiveRates(
      companyId,
      input.customerId ?? null,
      input.lineItems.filter((li) => li.rate <= 0 && li.resourceId).map((li) => li.resourceId!),
    );
    let lineAmounts = input.lineItems.map((li) => {
      const rate = li.rate > 0 ? li.rate : li.resourceId ? customerRateById.get(li.resourceId) ?? li.rate : li.rate;
      if (invoiceType === 'RUNNING_ACCOUNT') {
        const currentQty = li.currentQty ?? li.quantity;
        const cumulativeQty = li.cumulativeQty ?? currentQty;
        const amount = lineAmount(currentQty, rate);
        return {
          ...li,
          rate,
          quantity: currentQty,
          currentQty,
          previousQty: li.previousQty ?? 0,
          cumulativeQty,
          certifiedAmount: amount,
          amount,
        };
      }
      const amount = lineAmount(li.quantity, rate);
      return { ...li, rate, amount, certifiedAmount: amount };
    });

    const subtotal = sumAmounts(lineAmounts.map((li) => li.amount));

    let previousCertifiedTotal = 0;
    let raSequence = input.raSequence;
    if (invoiceType === 'RUNNING_ACCOUNT') {
      // FIX (NR-23): The partial unique index on (project_id, ra_sequence)
      // counts ALL non-null values - including DRAFT invoices. Previously the
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
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 1.1): optional party-master link.
        ...(input.customerId ? { customerId: input.customerId } : {}),
        // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.1): optional sales-order link.
        ...(input.salesOrderId ? { salesOrderId: input.salesOrderId } : {}),
        clientGstin: input.clientGstin,
        // FIX (FIN-H3): Persist clientState at create time so edits keep it.
        clientState: input.clientState ?? null,
        // INVENTORY_UX_POLISH (D6): optional buyer contact details.
        clientAddress: input.clientAddress ?? null,
        clientPhone: input.clientPhone ?? null,
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
            // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): optional catalog link.
            resourceId: li.resourceId,
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
    return creditLimitWarning ? { ...created, creditLimitWarning } : created;
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

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): validate optional resource links.
  if (input.lineItems) {
    const linkedResourceIds = input.lineItems.map((li) => li.resourceId).filter((id): id is string => !!id);
    if (linkedResourceIds.length > 0) {
      const found = await prisma.resource.count({
        where: { id: { in: linkedResourceIds }, companyId },
      });
      if (found !== linkedResourceIds.length) {
        throw ApiError.badRequest('One or more line items reference an item outside this company\'s catalog.');
      }
    }
  }

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
          resourceId: li.resourceId,
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
          resourceId: li.resourceId,
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
      // INVENTORY_UX_POLISH (D6): optional buyer contact details (null clears).
      clientAddress: input.clientAddress ?? null,
      clientPhone: input.clientPhone ?? null,
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
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: 'SENT' },
    include: {
      project: { select: { id: true, name: true } },
      lineItems: true,
    },
  });
  return serialize(updated);
}

/**
 * Inventory-only: auto-create a DRAFT sales invoice when stock is issued (OUT).
 * Amount = qty × (unitPrice override or catalog rate); GST when company has GSTIN.
 *
 * INVENTORY_UX_POLISH (D9): `lines[]` may contain multiple materials - the draft
 * gets one line item per issued material, still one invoice per issue request.
 * Idempotent on the first line's stockMovementId.
 */
export async function createDraftInvoiceFromStockIssue(opts: {
  companyId: string;
  projectId: string;
  lines: Array<{
    stockMovementId: string;
    resourceId: string;
    quantity: number;
    unitPrice?: number | null;
  }>;
  customerName?: string | null;
  // INVENTORY_UX_POLISH (D6): optional buyer contact captured on the Issue screen.
  customerPhone?: string | null;
  customerAddress?: string | null;
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): optional party-master link.
  customerId?: string | null;
  notes?: string | null;
}) {
  const company = await prisma.company.findFirst({
    where: { id: opts.companyId },
    select: { subscriptionPlan: true, gstin: true, state: true },
  });
  if (!company || company.subscriptionPlan !== 'INVENTORY') return null;
  if (opts.lines.length === 0) return null;

  const firstMovementId = opts.lines[0].stockMovementId;
  const existing = await prisma.invoice.findFirst({
    where: { stockMovementId: firstMovementId },
    include: {
      project: { select: { id: true, name: true } },
      lineItems: true,
    },
  });
  if (existing) {
    if (!existing.salesOrderId && existing.stockMovementId) {
      await linkSalesOrderForStockIssueInvoice(existing);
    }
    return serialize(existing);
  }

  const resources = await prisma.resource.findMany({
    where: { id: { in: opts.lines.map((l) => l.resourceId) }, companyId: opts.companyId },
    select: { id: true, name: true, unit: true, rate: true, gstRate: true },
  });
  const resourceById = new Map(resources.map((r) => [r.id, r]));

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.1): customer price-list override as
  // the fallback for lines without an explicit selling price.
  const customerRateById = await resolveEffectiveRates(
    opts.companyId,
    opts.customerId ?? null,
    opts.lines.filter((l) => l.unitPrice == null).map((l) => l.resourceId),
  );

  const hasGst = !!company.gstin;
  const lineItemsData: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    gstRate: number;
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.4): catalog link on draft-issue invoices.
    resourceId: string;
  }> = [];
  let subtotal = 0;
  let gstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  for (const line of opts.lines) {
    const resource = resourceById.get(line.resourceId);
    if (!resource) throw ApiError.notFound('Resource');

    const rate =
      line.unitPrice != null && Number.isFinite(line.unitPrice)
        ? Number(line.unitPrice)
        : (customerRateById.get(line.resourceId) ?? Number(resource.rate)) || 0;
    const lineGstRate = hasGst ? (Number(resource.gstRate) || 18) : 0;
    const amount = lineAmount(line.quantity, rate);
    const gst = calculateGST({
      subtotal: amount,
      gstRate: lineGstRate,
      tdsEnabled: false,
      tdsRate: 0,
      companyState: company.state,
      clientState: company.state,
    });

    subtotal += amount;
    gstAmount += gst.gstAmount;
    cgstAmount += gst.cgstAmount;
    sgstAmount += gst.sgstAmount;
    igstAmount += gst.igstAmount;

    lineItemsData.push({
      description: resource.name,
      quantity: line.quantity,
      unit: resource.unit,
      rate,
      amount,
      gstRate: lineGstRate,
      resourceId: line.resourceId,
    });
  }

  const total = subtotal + gstAmount;
  const invoiceNumber = await nextSequentialNumber(opts.companyId, 'invoice');
  const today = new Date();
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.5): optional party-master link on the
  // issue path - the draft invoice records customerId and copies party contact.
  let customerId = opts.customerId ?? null;
  let clientName = (opts.customerName ?? '').trim() || 'Walk-in customer';
  let clientPhone = opts.customerPhone;
  let clientAddress = opts.customerAddress;
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: opts.companyId },
      select: { name: true, phone: true, billingAddress: true },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    clientName = clientName === 'Walk-in customer' ? customer.name : clientName;
    clientPhone = clientPhone || customer.phone;
    clientAddress = clientAddress || customer.billingAddress;
  }
  const noteParts = [
    'AUTO_STOCK_ISSUE',
    opts.notes?.trim() ? opts.notes.trim() : null,
  ].filter(Boolean);

  const inv = await prisma.invoice.create({
    data: {
      projectId: opts.projectId,
      companyId: opts.companyId,
      ...(customerId ? { customerId } : {}),
      invoiceNumber,
      clientName,
      clientState: company.state ?? null,
      // INVENTORY_UX_POLISH (D6): pass through optional buyer contact.
      clientPhone: clientPhone?.trim() ? clientPhone.trim() : null,
      clientAddress: clientAddress?.trim() ? clientAddress.trim() : null,
      invoiceDate: today,
      dueDate: today,
      status: 'DRAFT',
      invoiceType: 'STANDARD',
      subtotal: round2(subtotal),
      gstRate: lineItemsData[0]?.gstRate ?? 0,
      gstAmount: round2(gstAmount),
      cgstAmount: round2(cgstAmount),
      sgstAmount: round2(sgstAmount),
      igstAmount: round2(igstAmount),
      tdsRate: 0,
      tdsAmount: 0,
      total: round2(total),
      paidAmount: 0,
      notes: noteParts.join(' · '),
      stockMovementId: firstMovementId,
      lineItems: {
        create: lineItemsData,
      },
    },
    include: {
      project: { select: { id: true, name: true } },
      lineItems: true,
    },
  });

  await linkSalesOrderForStockIssueInvoice(inv);
  const withSo = await prisma.invoice.findFirst({
    where: { id: inv.id },
    include: {
      project: { select: { id: true, name: true } },
      lineItems: true,
    },
  });
  return serialize(withSo ?? inv);
}

type StockIssueInvoiceLine = {
  description: string;
  quantity: unknown;
  unit: string;
  rate: unknown;
  amount: unknown;
  gstRate: unknown;
  resourceId?: string | null;
};

/** Resolve catalog ids on issue invoices (older drafts may lack resourceId). */
async function resolveIssueInvoiceLines(
  inv: {
    companyId: string;
    stockMovementId?: string | null;
    lineItems: StockIssueInvoiceLine[];
  },
): Promise<Array<StockIssueInvoiceLine & { resourceId: string }>> {
  const complete = inv.lineItems.filter(
    (l): l is StockIssueInvoiceLine & { resourceId: string } => !!l.resourceId,
  );
  if (complete.length === inv.lineItems.length && complete.length > 0) return complete;

  const names = [...new Set(inv.lineItems.map((l) => l.description).filter(Boolean))];
  const resources = names.length
    ? await prisma.resource.findMany({
        where: { companyId: inv.companyId, name: { in: names } },
        select: { id: true, name: true },
      })
    : [];
  const byName = new Map(resources.map((r) => [r.name, r.id]));

  let firstMovementResourceId: string | null = null;
  if (inv.stockMovementId) {
    const sm = await prisma.stockMovement.findFirst({
      where: { id: inv.stockMovementId },
      select: { resourceId: true },
    });
    firstMovementResourceId = sm?.resourceId ?? null;
  }

  return inv.lineItems
    .map((l, i) => ({
      ...l,
      resourceId:
        l.resourceId ?? byName.get(l.description) ?? (i === 0 ? firstMovementResourceId : null) ?? null,
    }))
    .filter((l): l is StockIssueInvoiceLine & { resourceId: string } => !!l.resourceId);
}

/**
 * Counter / walk-in stock issue already moved stock and wrote a draft invoice.
 * Mirror it as an INVOICED sales order so it appears on the Sales tab
 * (without dispatching again).
 */
export async function linkSalesOrderForStockIssueInvoice(inv: {
  id: string;
  companyId: string;
  projectId: string;
  customerId?: string | null;
  clientName: string;
  subtotal: unknown;
  gstAmount: unknown;
  total: unknown;
  notes?: string | null;
  salesOrderId?: string | null;
  stockMovementId?: string | null;
  invoiceDate?: Date;
  lineItems: StockIssueInvoiceLine[];
}): Promise<string | null> {
  if (inv.salesOrderId || !inv.stockMovementId) return inv.salesOrderId ?? null;
  const lines = await resolveIssueInvoiceLines(inv);
  if (lines.length === 0) return null;
  try {
    const soNumber = await nextSequentialNumber(inv.companyId, 'so');
    const so = await prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: {
          companyId: inv.companyId,
          projectId: inv.projectId,
          soNumber,
          customerId: inv.customerId ?? null,
          customerName: inv.clientName || 'Walk-in customer',
          status: 'INVOICED',
          orderDate: inv.invoiceDate ?? new Date(),
          notes: ['AUTO_STOCK_ISSUE', 'Counter sale - stock already issued', inv.notes]
            .filter(Boolean)
            .join(' · '),
          subtotal: Number(inv.subtotal),
          gstAmount: Number(inv.gstAmount),
          total: Number(inv.total),
          lines: {
            create: lines.map((l) => ({
              resourceId: l.resourceId,
              itemName: l.description,
              unit: l.unit,
              quantity: Number(l.quantity),
              rate: Number(l.rate),
              amount: Number(l.amount),
              gstRate: Number(l.gstRate),
              deliveredQty: Number(l.quantity),
            })),
          },
        },
      });
      await tx.invoice.update({
        where: { id: inv.id },
        data: { salesOrderId: created.id },
      });
      return created;
    });
    return so.id;
  } catch (err) {
    logger.warn('Could not mirror stock-issue invoice as a sales order', {
      error: String(err),
      invoiceId: inv.id,
    });
    return null;
  }
}

/** Backfill sales orders for older stock-issue invoices (no SO yet). */
export async function backfillStockIssueSalesOrders(companyId: string, projectId: string): Promise<void> {
  const orphans = await prisma.invoice.findMany({
    where: {
      companyId,
      projectId,
      stockMovementId: { not: null },
      salesOrderId: null,
    },
    include: { lineItems: true },
    take: 200,
    orderBy: { invoiceDate: 'desc' },
  });
  for (const inv of orphans) {
    await linkSalesOrderForStockIssueInvoice(inv);
  }
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

    // NR-11: Guarded relative increment - only applies if paidAmount is still
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