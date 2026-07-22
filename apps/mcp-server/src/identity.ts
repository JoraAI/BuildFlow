/**
 * BuildFlow MCP Server - Identity resolver
 *
 * Resolves a BuildFlow user API token (JWT) to a (companyId, userId, role)
 * identity at server startup. All subsequent tool calls inherit this
 * identity, enforcing the same permission boundaries as the REST API.
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
}

/**
 * Decode the BuildFlow JWT and fetch the user + company + permissions.
 *
 * The JWT payload shape matches what the backend auth.service issues:
 *   { userId, companyId, role, iat, exp }
 */
export async function resolveIdentity(token: string): Promise<McpIdentity> {
  // 1. Verify JWT signature against the backend's JWT_SECRET
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const payload = jwt.verify(token, secret) as {
    userId: string;
    companyId: string;
    role: string;
  };

  // 2. Fetch the user to confirm they're still active
  const user = await prisma.user.findFirstOrThrow({
    where: { id: payload.userId, companyId: payload.companyId, isActive: true },
    select: { id: true, name: true, role: true, companyId: true },
  });

  const company = await prisma.company.findFirstOrThrow({
    where: { id: user.companyId },
    select: { name: true },
  });

  // 3. Resolve permissions via the shared defaults (dynamic import to
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
  };
}