/**
 * BuildFlow — Express request augmentation.
 *
 * After `authenticateToken` runs, `req.user` is populated with the JWT payload.
 */
import type { Role } from '@buildflow/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        companyId: string;
        role: Role;
        tokenId: string; // jti, for blacklisting
      };
    }
  }
}

export {};