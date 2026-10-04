import type { Request, Response, NextFunction } from 'express';
import { verifyBuyerToken, type BuyerTokenPayload } from '../services/buyer.service';
import { ApiError } from '../utils/errors';

export function authenticateBuyer(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing buyer authorization token');
    }
    const payload = verifyBuyerToken(header.slice(7));
    (req as Request & { buyer: BuyerTokenPayload }).buyer = payload;
    next();
  } catch (e) {
    next(e);
  }
}
