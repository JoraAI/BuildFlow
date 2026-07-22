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
 *   BUILDFLOW_TOKEN=<jwt> DATABASE_URL=<url> JWT_SECRET=<secret> \
 *     pnpm --filter @buildflow/mcp-server start
 *
 * Or via stdio (Claude Desktop config):
 *   {
 *     "mcpServers": {
 *       "buildflow": {
 *         "command": "node",
 *         "args": ["/path/to/mcp-server/dist/server.js"],
 *         "env": {
 *           "BUILDFLOW_TOKEN": "<your-jwt>",
 *           "DATABASE_URL": "<your-db-url>",
 *           "JWT_SECRET": "<your-jwt-secret>"
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
import { resolveIdentity } from './identity';
import { tools, PermissionDeniedError } from './tools';
import { prisma } from './prisma';
import { buildPermissionAwarePrompt, getAllowedTools } from '@buildflow/shared';

async function main() {
  // ── Resolve identity from BUILDFLOW_TOKEN ──────────────────────────
  const token = process.env.BUILDFLOW_TOKEN;
  if (!token) {
    console.error('ERROR: BUILDFLOW_TOKEN environment variable is required.');
    console.error('Obtain a JWT by logging into BuildFlow and copying it from the auth store,');
    console.error('or use the /api/auth/login endpoint to get one.');
    process.exit(1);
  }

  console.error('[buildflow-mcp] Resolving identity...');
  const identity = await resolveIdentity(token);
  console.error(`[buildflow-mcp] Identity resolved: ${identity.userName} (${identity.role}) @ ${identity.companyName}`);

  // ── Filter tools by the caller's permissions ──────────────────────
  const allowedTools = getAllowedTools(identity.permissions as never).map((cap) =>
    tools.find((t) => t.name === cap.id),
  ).filter(Boolean);
  const registeredTools = allowedTools as typeof tools;

  console.error(`[buildflow-mcp] ${registeredTools.length}/${tools.length} tools available for this role`);

  // ── Build the permission-aware instructions ───────────────────────
  const instructions = buildPermissionAwarePrompt(
    identity.permissions as never,
    identity.role,
    identity.companyName,
  );

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
      const result = await tool.handler(identity, args ?? {});
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
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[buildflow-mcp] Fatal error:', err);
  process.exit(1);
});