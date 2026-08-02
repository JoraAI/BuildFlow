import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/accounting-export.service';

export async function exportJournal(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await svc.exportJournalEntriesCSV(req.user!.companyId, req.query as never);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="journal-entries.csv"');
    res.send(csv);
  } catch (e) { next(e); }
}
export async function exportSales(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await svc.exportSalesRegisterCSV(req.user!.companyId, req.query as never);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-register.csv"');
    res.send(csv);
  } catch (e) { next(e); }
}
export async function exportPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await svc.exportPurchaseRegisterCSV(req.user!.companyId, req.query as never);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="purchase-register.csv"');
    res.send(csv);
  } catch (e) { next(e); }
}
export async function exportQuickBooks(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await svc.exportQuickBooksJournalCSV(req.user!.companyId, req.query as never);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="quickbooks-journal.csv"');
    res.send(csv);
  } catch (e) { next(e); }
}
