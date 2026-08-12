/**
 * BuildFlow - Party master controller (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 * Thin request handlers for Customer (AR) + Vendor (AP) CRUD.
 */
import { NextFunction, Request, Response } from 'express';
import * as partyService from '../services/party.service';
import * as financeService from '../services/finance.service';
import { ok, created } from '../utils/response';

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await partyService.listCustomers(req.user!.companyId, req.query as never);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await partyService.getCustomer(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await partyService.createCustomer(req.user!.companyId, req.body));
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await partyService.updateCustomer(req.user!.companyId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await partyService.deleteCustomer(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function listVendors(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await partyService.listVendors(req.user!.companyId, req.query as never);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getVendor(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await partyService.getVendor(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

/* INVENTORY_HORIZONTAL_PLATFORM (Phase 5.3): party ledgers. */
export async function getCustomerLedger(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await financeService.getCustomerLedger(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function getVendorLedger(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await financeService.getVendorLedger(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createVendor(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await partyService.createVendor(req.user!.companyId, req.body));
  } catch (err) {
    next(err);
  }
}

export async function updateVendor(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await partyService.updateVendor(req.user!.companyId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteVendor(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await partyService.deleteVendor(req.user!.companyId, req.params.id));
  } catch (err) {
    next(err);
  }
}
