/**
 * BuildFlow - Transaction engine controller (INVENTORY_HORIZONTAL_PLATFORM Phase 2).
 * Thin request handlers for sales orders, delivery challans, returns and notes.
 */
import { NextFunction, Request, Response } from 'express';
import * as salesOrderService from '../services/sales-order.service';
import * as returnService from '../services/return.service';
import { ok, created } from '../utils/response';

/* ── Sales orders ─────────────────────────────────────────────────── */
export async function listSalesOrders(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salesOrderService.listSalesOrders(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function getSalesOrder(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salesOrderService.getSalesOrder(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function createSalesOrder(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await salesOrderService.createSalesOrder(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function updateSalesOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salesOrderService.updateSalesOrderStatus(req.user!.companyId, req.user!.id, req.user!.role, req.params.id, req.body.action));
  } catch (err) {
    next(err);
  }
}
export async function createInvoiceFromSalesOrder(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await salesOrderService.createInvoiceFromSalesOrder(req.user!.companyId, req.user!.id, req.user!.role, {
        ...req.body,
        salesOrderId: req.params.id,
      }),
    );
  } catch (err) {
    next(err);
  }
}

/* ── Delivery challans ────────────────────────────────────────────── */
export async function listDeliveryChallans(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salesOrderService.listDeliveryChallans(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function createDeliveryChallan(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await salesOrderService.createDeliveryChallan(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function dispatchDeliveryChallan(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salesOrderService.dispatchDeliveryChallan(
      req.user!.companyId,
      req.user!.id,
      req.user!.role,
      req.params.id,
      { locationId: typeof req.body?.locationId === 'string' ? req.body.locationId : undefined },
    ));
  } catch (err) {
    next(err);
  }
}
export async function deliverDeliveryChallan(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salesOrderService.deliverDeliveryChallan(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}

/* ── Returns ──────────────────────────────────────────────────────── */
export async function createSalesReturn(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await returnService.createSalesReturn(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function listSalesReturns(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await returnService.listSalesReturns(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function createPurchaseReturn(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await returnService.createPurchaseReturn(req.user!.companyId, req.user!.id, req.user!.role, req.body));
  } catch (err) {
    next(err);
  }
}
export async function listPurchaseReturns(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await returnService.listPurchaseReturns(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}

/* ── Notes ────────────────────────────────────────────────────────── */
export async function listCreditNotes(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await returnService.listCreditNotes(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
export async function listDebitNotes(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await returnService.listDebitNotes(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
/* INVENTORY_HORIZONTAL_PLATFORM (Phase 5.4): note issuance DRAFT → ISSUED. */
export async function issueCreditNote(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await returnService.issueCreditNote(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
export async function issueDebitNote(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await returnService.issueDebitNote(req.user!.companyId, req.user!.id, req.user!.role, req.params.id));
  } catch (err) {
    next(err);
  }
}
