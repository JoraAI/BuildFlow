import { Request, Response, NextFunction } from 'express';
import { getResourceTraceability } from '../services/inventory-traceability.service';
export async function trace(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, resourceId } = req.params;
    // FIX (NR-33): Pass userId + role so the service can assert project access.
    const result = await getResourceTraceability(
      req.user!.companyId,
      req.user!.id,
      req.user!.role,
      projectId,
      resourceId,
    );
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}
