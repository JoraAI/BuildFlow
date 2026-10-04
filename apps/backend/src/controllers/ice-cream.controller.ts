import type { Request, Response, NextFunction } from 'express';
import * as recipeSvc from '../services/recipe.service';
import * as productionSvc from '../services/production.service';
import * as buyerSvc from '../services/buyer.service';
import * as salesOrderSvc from '../services/sales-order.service';

function companyId(req: Request): string {
  return req.user!.companyId;
}
function userId(req: Request): string {
  return req.user!.id;
}
function role(req: Request): string {
  return req.user!.role;
}

export async function listRecipes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await recipeSvc.listRecipes(companyId(req)) });
  } catch (e) {
    next(e);
  }
}

export async function createRecipe(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json({ success: true, data: await recipeSvc.createRecipe(companyId(req), req.body) });
  } catch (e) {
    next(e);
  }
}

export async function updateRecipe(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await recipeSvc.updateRecipe(companyId(req), req.params.id, req.body),
    });
  } catch (e) {
    next(e);
  }
}

export async function listProduction(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await productionSvc.listProductionBatches(companyId(req)) });
  } catch (e) {
    next(e);
  }
}

export async function createProduction(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json({
      success: true,
      data: await productionSvc.createProductionBatch(companyId(req), userId(req), req.body),
    });
  } catch (e) {
    next(e);
  }
}

export async function completeProduction(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await productionSvc.completeProductionBatch(companyId(req), req.params.id),
    });
  } catch (e) {
    next(e);
  }
}

export async function cancelProduction(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await productionSvc.cancelProductionBatch(companyId(req), req.params.id),
    });
  } catch (e) {
    next(e);
  }
}

export async function inviteBuyer(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json({ success: true, data: await buyerSvc.inviteBuyer(companyId(req), req.body) });
  } catch (e) {
    next(e);
  }
}

export async function listBuyers(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await buyerSvc.listBuyers(companyId(req)) });
  } catch (e) {
    next(e);
  }
}

export async function setB2bPublished(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await buyerSvc.setResourceB2bPublished(
        companyId(req),
        req.body.resourceId,
        req.body.published,
      ),
    });
  } catch (e) {
    next(e);
  }
}

export async function salesDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await salesOrderSvc.getSalesDashboard(companyId(req), userId(req), role(req)),
    });
  } catch (e) {
    next(e);
  }
}

export async function updateShipping(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await salesOrderSvc.updateSalesOrderShipping(
        companyId(req),
        userId(req),
        role(req),
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
}

// ── Public buyer routes ────────────────────────────────────────────

export async function buyerSendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await buyerSvc.sendBuyerOtp(req.body.email, req.body.companyId) });
  } catch (e) {
    next(e);
  }
}

export async function buyerLogin(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await buyerSvc.loginBuyer(req.body.email, req.body.otp, req.body.companyId),
    });
  } catch (e) {
    next(e);
  }
}

function buyerFromReq(req: Request) {
  return (req as Request & { buyer: buyerSvc.BuyerTokenPayload }).buyer;
}

export async function buyerCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const buyer = buyerFromReq(req);
    res.json({ success: true, data: await buyerSvc.getBuyerCatalog(buyer.companyId) });
  } catch (e) {
    next(e);
  }
}

export async function buyerPlaceOrder(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json({
      success: true,
      data: await buyerSvc.placeBuyerOrder(buyerFromReq(req), req.body),
    });
  } catch (e) {
    next(e);
  }
}

export async function buyerOrders(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await buyerSvc.listBuyerOrders(buyerFromReq(req)) });
  } catch (e) {
    next(e);
  }
}

export async function buyerOrderDetail(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: await buyerSvc.getBuyerOrder(buyerFromReq(req), req.params.id),
    });
  } catch (e) {
    next(e);
  }
}
