/**
 * BuildFlow MCP Server - Prisma client
 *
 * Shares the backend's PrismaClient schema via the generated client.
 * Requires DATABASE_URL to be set (same as backend).
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();