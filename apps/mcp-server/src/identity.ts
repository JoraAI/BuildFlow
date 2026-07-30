/**
 * BuildFlow MCP Server - Identity resolver
 *
 * Resolves a BuildFlow user API token (JWT) to a (companyId, userId, role)
 * identity at server startup. All subsequent tool calls inherit this
 * identity, enforcing the same permission boundaries as the REST API.
 *
 * FIX (SEC-H5): Previously used the wrong secret env name (`JWT_SECRET`),
 * read `payload.userId` while the backend signs `sub`, didn't check
 * `type === 'access'`, didn't check the Redis blacklist, and resolved
 * identity only once at startup. Now:
 *  - Verifies with `JWT_ACCESS_SECRET` (same as the backend).
 *  - Reads `sub` for the user id.
 *  - Requires `type === 'access'`.
 *  - Checks the Redis blacklist for revoked tokens.
 *  - Supports periodic re-validation via `refreshIdentity()`.
 */
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export interface McpIdentity {
  companyId: string;
  userId: string;
  role: string;
  companyName: string;
  userName: string;
  permissions: string[];
  /** Token id (jti) for blacklist checking. */
  tid: string;
}

interface AccessPayload {
  sub: string;
  companyId?: string;
  role?: string;
  tid: string;
  type: string;
}

import { isTokenBlacklisted } from './redis';

/**
 * Decode the BuildFlow JWT and fetch the user + company + permissions.
 *
 * The JWT payload shape matches what the backend auth.service issues:
 *   { sub, companyId, role, tid, type }
 */
export async function resolveIdentity(token: string): Promise<McpIdentity> {
  // 1. Verify JWT signature against the backend's JWT_ACCESS_SECRET
  //    (FIX SEC-H5: was using the wrong `JWT_SECRET` env name).
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }

  const payload = jwt.verify(token, secret) as AccessPayload;

  // 2. Require an ACCESS token (FIX SEC-H5: previously accepted refresh tokens).
  if (payload.type !== 'access') {
    throw new Error(`Invalid token type: expected 'access', got '${payload.type}'`);
  }

  // 3. Check the Redis blacklist (FIX SEC-H5: logout revocation was ignored).
  if (await isTokenBlacklisted(payload.tid)) {
    throw new Error('Token has been revoked');
  }

  // 4. Fetch the user to confirm they're still active.
  const userId = payload.sub; // FIX SEC-H5: was payload.userId.
  const companyId = payload.companyId;
  if (!userId || !companyId) {
    throw new Error('Token payload missing sub or companyId');
  }

  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, companyId, isActive: true },
    select: { id: true, name: true, role: true, companyId: true },
  });

  const company = await prisma.company.findFirstOrThrow({
    where: { id: user.companyId },
    select: { name: true },
  });

  // 5. Resolve permissions via the shared defaults (dynamic import to
  //    avoid a circular dependency on the backend package)
  const { getRolePermissions } = await import('./permissions.js');
  const permissions = await getRolePermissions(user.companyId, user.role as never);

  return {
    companyId: user.companyId,
    userId: user.id,
    role: user.role,
    companyName: company.name,
    userName: user.name,
    permissions,
    tid: payload.tid,
  };
}

/**
 * Periodically re-validate the token against the blacklist.
 *
 * FIX (SEC-H5): identity was resolved once at startup and never re-checked.
 * Call this on a timer (e.g. every 5 minutes) to catch revoked tokens.
 */
export async function refreshIdentity(
  identity: McpIdentity,
): Promise<McpIdentity | null> {
  if (await isTokenBlacklisted(identity.tid)) {
    return null; // token revoked → caller should force re-auth
  }

  // Re-confirm the user is still active.
  const user = await prisma.user.findFirst({
    where: { id: identity.userId, companyId: identity.companyId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  if (!user) return null;

  const { getRolePermissions } = await import('./permissions.js');
  const permissions = await getRolePermissions(identity.companyId, user.role as never);

  return {
    ...identity,
    userName: user.name,
    role: user.role,
    permissions,
  };
}