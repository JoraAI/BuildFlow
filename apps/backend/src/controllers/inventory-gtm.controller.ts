/**
 * BuildFlow - Inventory GTM controller (INVENTORY_HORIZONTAL_PLATFORM Phase 9).
 * 9.1 Customer price lists · 9.2 Quote → SO · 9.3 printable PDFs · 9.4 reminders.
 */
import { NextFunction, Request, Response } from 'express';
import {
  upsertCustomerPrice,
  deleteCustomerPrice,
  listCustomerPrices,
} from '../services/price-list.service';
import {
  createQuote,
  listQuotes,
  updateQuoteStatus,
  createSalesOrderFromQuote,
} from '../services/quote.service';
import { remindOverdueInvoice } from '../services/inventory-alerts.service';
import { reportSalesOrder, reportDeliveryChallan, reportGoodsReceipt, reportQuote } from '../services/pdf-report.service';
import { ok, created } from '../utils/response';
import { recordAudit } from '../utils/audit';

/* ── 9.1 Customer price lists ─────────────────────────────────────── */

export async function upsertPrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const row = await upsertCustomerPrice(companyId, req.body);
    created(res, row);
  } catch (err) {
    next(err);
  }
}

export async function listPrices(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const rows = await listCustomerPrices(companyId, customerId);
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function deletePrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await deleteCustomerPrice(companyId, req.params.id);
    await recordAudit({
      companyId,
      userId,
      action: 'DELETE',
      entityType: 'CustomerPrice',
      entityId: req.params.id,
      newValue: result,
      ipAddress: req.ip,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

/* ── 9.2 Quote → Sales Order ──────────────────────────────────────── */

export async function createQuoteCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const quote = await createQuote(companyId, userId, role, req.body);
    created(res, quote);
  } catch (err) {
    next(err);
  }
}

export async function listQuotesCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const quotes = await listQuotes(companyId, userId, role);
    ok(res, quotes);
  } catch (err) {
    next(err);
  }
}

export async function quoteAction(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const quote = await updateQuoteStatus(companyId, userId, role, req.params.id, req.body.action);
    ok(res, quote);
  } catch (err) {
    next(err);
  }
}

export async function quoteToSalesOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const result = await createSalesOrderFromQuote(companyId, userId, role, req.params.id);
    created(res, result);
  } catch (err) {
    next(err);
  }
}

/* ── 9.4 Payment reminders ────────────────────────────────────────── */

export async function remindInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    await remindOverdueInvoice(companyId, req.params.id);
    await recordAudit({
      companyId,
      userId,
      action: 'CREATE',
      entityType: 'Notification',
      entityId: `remind-${req.params.id}`,
      newValue: { type: 'INVENTORY_OVERDUE_INVOICE' },
      ipAddress: req.ip,
    });
    ok(res, { reminded: true });
  } catch (err) {
    next(err);
  }
}

/* ── 9.3 Printable PDFs (SO / DC / GRN) ───────────────────────────── */

function sendPdf(res: Response, result: { buffer: Buffer; filename: string }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
  return res.status(200).send(result.buffer);
}

export async function salesOrderPdf(req: Request, res: Response, next: NextFunction) {
  try {
    sendPdf(res, await reportSalesOrder(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function deliveryChallanPdf(req: Request, res: Response, next: NextFunction) {
  try {
    sendPdf(res, await reportDeliveryChallan(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function goodsReceiptPdf(req: Request, res: Response, next: NextFunction) {
  try {
    sendPdf(res, await reportGoodsReceipt(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function quotePdf(req: Request, res: Response, next: NextFunction) {
  try {
    sendPdf(res, await reportQuote(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}
