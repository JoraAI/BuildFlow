import { Request, Response, NextFunction } from 'express';
import { getTranslations } from '../services/i18n.service';
export async function get(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await getTranslations((req.query.lang as string) || 'en') }); } catch (e) { next(e); }
}
