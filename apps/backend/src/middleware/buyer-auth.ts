import type { Request, Response, NextFunction } from 'express';
import { verifyBuyerToken, type BuyerTokenPayload } from '../services/buyer.service';
import { ApiError } from '../utils/errors';
import { prisma } from '../lib/prisma';

export async function authenticateBuyer(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing buyer authorization token');
    }
    const payload = verifyBuyerToken(header.slice(7));
    const active = await prisma.buyerUser.findFirst({
      where: { id: payload.sub, companyId: payload.companyId, isActive: true },
      select: { id: true },
    });
    if (!active) throw ApiError.unauthorized('Buyer access has been revoked');
    (req as Request & { buyer: BuyerTokenPayload }).buyer = payload;
    next();
  } catch (e) {
    next(e);
  }
}
