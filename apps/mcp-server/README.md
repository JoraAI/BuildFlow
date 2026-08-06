# BuildFlow MCP Server

Permission-gated Model Context Protocol (MCP) server for BuildFlow construction ERP. Exposes tools that let AI assistants (Claude Desktop, Cursor, VS Code) interact with BuildFlow data **within the boundaries of the user's role permissions**.

## How it works

```
┌──────────────────┐      stdio       ┌─────────────────────────┐
│  Claude Desktop  │ ◄──────────────► │   BuildFlow MCP Server   │
│  / Cursor / IDE  │                  │                          │
└──────────────────┘                  │  • Resolves user JWT →   │
                                      │    (company, role, perms) │
                                      │  • Registers only tools  │
                                      │    the role can use      │
                                      │  • Guards every call     │
                                      └───────────┬─────────────┘
                                                  │ Prisma
                                                  ▼
                                      ┌─────────────────────────┐
                                      │   PostgreSQL (shared)    │
                                      └─────────────────────────┘
```

### Permission enforcement

1. At startup, the server decodes the `BUILDFLOW_TOKEN` JWT and resolves the user's permissions via `getRolePermissions()`.
2. Only tools whose `requires` permission is in the user's list are registered with the MCP client.
3. Even if a tool is registered, the handler re-checks the permission at runtime (defense in depth).
4. The system prompt sent to the LLM includes a full permission map (✅/🚫) so the AI knows what it can and cannot do.

### Available tools (14)

| Tool | Permission | Description |
|------|-----------|-------------|
| `list_resources` | `settings.material_prices` | Search materials/labour/equipment |
| `create_resource` | `settings.material_prices` | Create a new resource |
| `update_resource_price` | `settings.material_prices` | Update resource rate |
| `list_rate_analyses` | `settings.rate_analysis` | List rate analyses |
| `duplicate_rate_analysis` | `settings.rate_analysis` | Duplicate a rate analysis |
| `list_projects` | `project.view` | List projects |
| `list_estimates` | `estimate.view` | List estimates for a project |
| `list_bills` | `bill.view` | List vendor bills |
| `approve_bill` | `bill.approve` | Approve a pending bill |
| `list_invoices` | `invoice.view` | List client invoices |
| `list_boq` | `boq.view` | List BOQ items |

A PM will see different tools than an ACCOUNTANT, who will see different tools than a STORE_INCHARGE.

## Setup

### Prerequisites
- Node.js 20+
- pnpm (workspace root)
- PostgreSQL (same DATABASE_URL as the backend)
- A BuildFlow user JWT (obtain via login or the mobile auth store)

### Install

```bash
# From workspace root
pnpm install

# Generate Prisma client (shares backend schema)
pnpm --filter @buildflow/backend db:generate
```

### Get a JWT token

```bash
# Login via the API
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@reddyconst.com","password":"Test@1234"}' \
  | jq .token
```

### Run standalone

```bash
BUILDFLOW_TOKEN=<jwt> \
DATABASE_URL=postgresql://... \
JWT_SECRET=<your-secret> \
pnpm --filter @buildflow/mcp-server dev
```

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "buildflow": {
      "command": "node",
      "args": ["/absolute/path/to/BuildFlow/apps/mcp-server/dist/server.js"],
      "env": {
        "BUILDFLOW_TOKEN": "<your-jwt>",
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/buildflow",
        "JWT_SECRET": "<your-jwt-secret>"
      }
    }
  }
}
```

After saving, restart Claude Desktop. You'll see a 🔨 BuildFlow tool icon in the chat interface.

## Cursor IDE configuration

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "buildflow": {
      "command": "node",
      "args": ["/absolute/path/to/BuildFlow/apps/mcp-server/dist/server.js"],
      "env": {
        "BUILDFLOW_TOKEN": "<your-jwt>",
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/buildflow",
        "JWT_SECRET": "<your-jwt-secret>"
      }
    }
  }
}
```

## Example interactions

Once connected, you can ask the AI:

- *"List all pending bills for the NH-45 project"* → calls `list_bills`
- *"Create a new resource: TMT Steel Fe550, 12mm, rate 78/kg, GST 18%, HSN 7213"* → calls `create_resource`
- *"What's the current rate for OPC Cement?"* → calls `list_resources` with search
- *"Approve bill BILL-2025-003"* → calls `approve_bill`
- *"Show me the BOQ for NH-45 Road Widening"* → calls `list_boq`

If the user's role doesn't have permission for an action, the AI will explain: *"You don't have the `bill.approve` permission. Ask an OWNER to grant it."*

## In-app chatbot integration

The same permission-aware prompt is also injected into the BuildFlow in-app assistant (`chatbot.service.ts`). So whether you're chatting in the mobile app or via an external MCP client, the AI respects the same permission boundaries.

## Security notes

- The JWT is verified against `JWT_SECRET` at startup — invalid/expired tokens are rejected.
- The server connects to the same database as the backend using the same Prisma schema.
- All tool queries are scoped to `identity.companyId` — cross-company data access is impossible.
- Every write operation (create/approve) is executed under the user's identity, so audit trails are accurate.
- The server runs as a **single-identity** process (one JWT per server instance). For multi-user scenarios, run multiple server instances or implement per-request identity via the MCP session header.

## Development

```bash
# Type-check
pnpm --filter @buildflow/mcp-server typecheck

# Build
pnpm --filter @buildflow/mcp-server build

# Run in dev mode (auto-restart on changes)
pnpm --filter @buildflow/mcp-server dev
```

## Adding new tools

1. Add the capability to `TOOL_CAPABILITIES` in `packages/shared/src/permissions/prompt-builder.ts`
2. Add the tool definition to `tools` array in `apps/mcp-server/src/tools.ts`
3. The tool will automatically appear in the LLM's prompt for users with the required permission