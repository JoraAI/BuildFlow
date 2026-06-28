/**
 * BuildFlow - Invoice service (GST-compliant invoicing).
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { calculateGST, round2 } from './gst.service';
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

export async function createInvoice(companyId: string, _userId: string, input: CreateInvoiceInput) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, companyId },
  });
  if (!project) throw ApiError.notFound('Project');

  const companyState = await getCompanyState(companyId);
  const invoiceType = input.invoiceType ?? 'STANDARD';

  let lineAmounts = input.lineItems.map((li) => {
    if (invoiceType === 'RUNNING_ACCOUNT') {
      const currentQty = li.currentQty ?? li.quantity;
      const cumulativeQty = li.cumulativeQty ?? currentQty;
      const amount = round2(currentQty * li.rate);
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
    return { ...li, amount: round2(li.quantity * li.rate), certifiedAmount: round2(li.quantity * li.rate) };
  });

  const subtotal = round2(lineAmounts.reduce((s, li) => s + li.amount, 0));

  let previousCertifiedTotal = 0;
  let raSequence = input.raSequence;
  if (invoiceType === 'RUNNING_ACCOUNT') {
    const prev = await prisma.invoice.findMany({
      where: { projectId: input.projectId, companyId, invoiceType: 'RUNNING_ACCOUNT', status: { not: 'DRAFT' } },
      select: { cumulativeCertifiedTotal: true, raSequence: true },
      orderBy: { raSequence: 'desc' },
      take: 1,
    });
    previousCertifiedTotal = prev[0] ? Number(prev[0].cumulativeCertifiedTotal) : 0;
    if (raSequence == null) {
      raSequence = (prev[0]?.raSequence ?? 0) + 1;
    }
  }

  const currentCertifiedTotal = subtotal;
  const cumulativeCertifiedTotal = round2(previousCertifiedTotal + currentCertifiedTotal);
  const retentionPct = input.retentionPct ?? 0;
  const retentionAmount = round2((cumulativeCertifiedTotal * retentionPct) / 100);

  const gst = calculateGST({
    subtotal: currentCertifiedTotal,
    gstRate: input.gstRate,
    tdsEnabled: input.tdsEnabled,
    tdsRate: input.tdsRate,
    companyState,
    clientState: input.clientState,
  });

  const totalAfterRetention = round2(gst.netPayable - retentionAmount);

  return prisma.invoice.create({
    data: {
      projectId: input.projectId,
      companyId,
      invoiceNumber: input.invoiceNumber,
      clientName: input.clientName,
      clientGstin: input.clientGstin,
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
}

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
  const clientState = input.clientState;

  let subtotal = Number(inv.subtotal);
  let lineItemsData: Record<string, unknown> | undefined;

  if (input.lineItems) {
    const lineAmounts = input.lineItems.map((li) => ({
      ...li,
      amount: round2(li.quantity * li.rate),
    }));
    subtotal = round2(lineAmounts.reduce((s, li) => s + li.amount, 0));
    // Replace all line items
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

  const gst = calculateGST({
    subtotal,
    gstRate,
    tdsEnabled,
    tdsRate,
    companyState,
    clientState,
  });

  return prisma.invoice.update({
    where: { id },
    data: {
      clientName: input.clientName,
      clientGstin: input.clientGstin,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      gstRate,
      tdsRate: tdsEnabled ? tdsRate : 0,
      subtotal,
      gstAmount: gst.gstAmount,
      cgstAmount: gst.cgstAmount,
      sgstAmount: gst.sgstAmount,
      igstAmount: gst.igstAmount,
      tdsAmount: gst.tdsAmount,
      total: gst.netPayable,
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

export async function recordPayment(
  companyId: string,
  userId: string,
  id: string,
  input: RecordPaymentInput,
) {
  const inv = await prisma.invoice.findFirst({ where: { id, companyId } });
  if (!inv) throw ApiError.notFound('Invoice');

  const newPaid = round2(Number(inv.paidAmount) + input.amount);
  const status = newPaid >= Number(inv.total) ? 'PAID' : 'SENT';

  const updated = await prisma.invoice.update({
    where: { id },
    data: { paidAmount: newPaid, status },
  });

  // Create journal entry for payment
  await prisma.journalEntry.create({
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

  return updated;
}

export async function deleteInvoice(companyId: string, id: string) {
  const inv = await prisma.invoice.findFirst({ where: { id, companyId } });
  if (!inv) throw ApiError.notFound('Invoice');
  if (inv.status !== 'DRAFT') {
    throw ApiError.conflict('Only DRAFT invoices can be deleted');
  }
  return prisma.invoice.delete({ where: { id } });
}