#!/usr/bin/env node
/**
 * BuildFlow MCP Server
 *
 * Exposes permission-gated BuildFlow tools to AI clients (Claude Desktop,
 * Cursor, VS Code Copilot) via the Model Context Protocol.
 *
 * Auth: the server reads a BuildFlow user JWT from the BUILDFLOW_TOKEN env
 * var at startup and resolves it to a (companyId, userId, role, permissions)
 * identity. All subsequent tool calls inherit this identity.
 *
 * Usage:
 *   BUILDFLOW_TOKEN=<jwt> DATABASE_URL=<url> JWT_ACCESS_SECRET=<secret> \
 *     REDIS_URL=<url> \
 *     pnpm --filter @buildflow/mcp-server start
 *
 * Or via stdio (Claude Desktop config):
 *   {
 *     "mcpServers": {
 *       "buildflow": {
 *         "command": "node",
 *         "args": ["/path/to/mcp-server/dist/server.js"],
 *         "env": {
 *           "BUILDFLOW_TOKEN": "<your-access-jwt>",
 *           "DATABASE_URL": "<your-db-url>",
 *           "JWT_ACCESS_SECRET": "<your-access-secret>",
 *           "REDIS_URL": "<your-redis-url>"
 *         }
 *       }
 *     }
 *   }
 */
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import { resolveIdentity, refreshIdentity } from './identity';
import { tools, PermissionDeniedError } from './tools';
import { prisma, companyALS } from './prisma';
import { buildPermissionAwarePrompt, getAllowedTools, filterToolsByProductMode } from '@buildflow/shared';
import { disconnectRedis } from './redis';

async function main() {
  // ── Resolve identity from BUILDFLOW_TOKEN ──────────────────────────
  const token = process.env.BUILDFLOW_TOKEN;
  if (!token) {
    console.error('[buildflow-mcp] Skipping: BUILDFLOW_TOKEN is not set.');
    console.error('Set BUILDFLOW_TOKEN (JWT from /api/auth/login) to run the MCP server.');
    console.error('Root `pnpm run dev` excludes this package; use `pnpm run dev:mcp` when needed.');
    // Stay alive so `tsx watch` / turbo persistent tasks do not exit as failures.
    await new Promise(() => {});
    return;
  }

  console.error('[buildflow-mcp] Resolving identity...');
  const identity = await resolveIdentity(token);
  console.error(`[buildflow-mcp] Identity resolved: ${identity.userName} (${identity.role}) @ ${identity.companyName}`);

  // ── Filter tools by the caller's permissions + product mode ───────
  const allowedTools = filterToolsByProductMode(
    getAllowedTools(identity.permissions as never),
    identity.productMode,
  ).map((cap) => tools.find((t) => t.name === cap.id)).filter(Boolean);
  const registeredTools = allowedTools as typeof tools;

  console.error(`[buildflow-mcp] ${registeredTools.length}/${tools.length} tools available for this role`);

  // ── Build the permission-aware instructions ───────────────────────
  const instructions = buildPermissionAwarePrompt(
    identity.permissions as never,
    identity.role,
    identity.companyName,
    identity.productMode,
  );

  // ── Periodic re-validation of the token (FIX SEC-H5) ───────────────
  // Re-check the blacklist + user-active status every 5 minutes.
  let currentIdentity = identity;
  const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(async () => {
    const refreshed = await refreshIdentity(currentIdentity);
    if (!refreshed) {
      console.error('[buildflow-mcp] Token revoked or user deactivated. Shutting down.');
      await prisma.$disconnect();
      await disconnectRedis();
      process.exit(1);
    }
    currentIdentity = refreshed;
  }, REVALIDATE_INTERVAL_MS);

  // ── Create the MCP server ─────────────────────────────────────────
  const server = new Server(
    {
      name: 'buildflow',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions,
    },
  );

  // ── Register tool handlers ────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: registeredTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = registeredTools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: `Tool "${name}" is not available. It may require a permission you don't have. Available tools: ${registeredTools.map((t) => t.name).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    try {
      // FIX (SEC-H6): wrap every tool call in the company ALS context so the
      // Prisma tenant-scoping middleware enforces companyId isolation.
      const result = await companyALS.run(
        { companyId: currentIdentity.companyId },
        () => tool.handler(currentIdentity, args ?? {}),
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message =
        err instanceof PermissionDeniedError
          ? err.message
          : `Tool execution failed: ${(err as Error).message}`;
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  });

  // ── Connect via stdio transport ───────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[buildflow-mcp] Server connected and listening on stdio');

  // ── Graceful shutdown ─────────────────────────────────────────────
  process.on('SIGINT', async () => {
    console.error('[buildflow-mcp] Shutting down...');
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[buildflow-mcp] Fatal error:', err);
  process.exit(1);
});