/**
 * BuildFlow - Permission-Aware Prompt Builder
 *
 * Generates a dynamic system prompt for LLM assistants (in-app chatbot and
 * external MCP clients) that reflects the caller's actual permissions.
 *
 * This ensures an AI assistant can never recommend or attempt actions the
 * user is not authorized to perform.
 */
import { PERMISSIONS, PERMISSION_GROUPS, type Permission } from './catalog';

/**
 * Tool capability descriptors. Each maps a logical AI action to the
 * permission it requires. Used to render the "what you CAN do" section
 * of the system prompt and to gate MCP tool calls.
 */
export interface ToolCapability {
  /** Stable tool id, e.g. "create_resource" */
  id: string;
  /** Human description shown to the LLM */
  description: string;
  /** Permission required to use this tool */
  requires: Permission;
  /** Module label for grouping in the prompt */
  module: string;
}

/**
 * The canonical list of AI tool capabilities. Keep this in sync with the
 * MCP tool implementations in apps/mcp-server/src/tools/.
 */
export const TOOL_CAPABILITIES: ToolCapability[] = [
  // Resources / Materials
  { id: 'list_resources', description: 'Search and list materials, labour, and equipment from the resource library', requires: 'settings.material_prices', module: 'Resources' },
  { id: 'create_resource', description: 'Create a new resource (material, labour, or equipment) with rate, unit, GST, and HSN/SAC code', requires: 'settings.material_prices', module: 'Resources' },
  { id: 'update_resource_price', description: 'Update the rate of an existing resource', requires: 'settings.material_prices', module: 'Resources' },

  // Rate Analysis
  { id: 'list_rate_analyses', description: 'List composite rate analyses from the library', requires: 'settings.rate_analysis', module: 'Rate Analysis' },
  { id: 'create_rate_analysis', description: 'Create a new rate analysis with material/labour/equipment components', requires: 'settings.rate_analysis', module: 'Rate Analysis' },
  { id: 'duplicate_rate_analysis', description: 'Duplicate an existing rate analysis as a starting point', requires: 'settings.rate_analysis', module: 'Rate Analysis' },

  // Estimates
  { id: 'list_estimates', description: 'List estimates for a project', requires: 'estimate.view', module: 'Estimates' },
  { id: 'create_estimate', description: 'Create a new estimate for a project', requires: 'estimate.create', module: 'Estimates' },
  { id: 'add_estimate_item', description: 'Add a line item (material/labour/equipment) to an estimate section', requires: 'estimate.create', module: 'Estimates' },

  // Bills (PROC-B11: Added extract/create capabilities)
  { id: 'list_bills', description: 'List vendor bills', requires: 'bill.view', module: 'Bills' },
  { id: 'approve_bill', description: 'Approve a pending vendor bill', requires: 'bill.approve', module: 'Bills' },
  { id: 'extract_vendor_bill', description: 'Extract vendor bill data from an uploaded invoice PDF/image using AI', requires: 'bill.create', module: 'Bills' },
  { id: 'create_vendor_bill', description: 'Create a vendor bill after user review of AI-extracted or manual data', requires: 'bill.create', module: 'Bills' },

  // Invoices
  { id: 'list_invoices', description: 'List client invoices', requires: 'invoice.view', module: 'Invoices' },

  // Projects
  { id: 'list_projects', description: 'List projects with status and budget', requires: 'project.view', module: 'Projects' },
  { id: 'update_project_status', description: 'Update a project status (e.g. mark COMPLETED when job is closed)', requires: 'project.edit', module: 'Projects' },

  // Proposals
  { id: 'list_proposals', description: 'List pre-construction proposals with status and client', requires: 'proposal.view', module: 'Proposals' },

  // BOQ
  { id: 'list_boq', description: 'List Bill of Quantities items for a project', requires: 'boq.view', module: 'BOQ' },
];

/**
 * Build the list of tool capabilities the user is allowed to invoke.
 */
export function getAllowedTools(permissions: Permission[]): ToolCapability[] {
  const set = new Set(permissions);
  return TOOL_CAPABILITIES.filter((t) => set.has(t.requires));
}

/** Tool ids that are construction-only — never exposed to inventory tenants. */
const CONSTRUCTION_ONLY_TOOL_IDS = new Set<string>([
  'list_rate_analyses',
  'create_rate_analysis',
  'duplicate_rate_analysis',
  'list_estimates',
  'create_estimate',
  'add_estimate_item',
  'list_boq',
  'list_proposals',
]);

/**
 * INVENTORY_PRODUCT: scope a tool list to the inventory product. Inventory
 * tenants (OWNER included) must not see estimate / BOQ / proposal / rate
 * analysis tools — those live behind construction-only modules.
 */
export function filterToolsByProductMode(
  tools: ToolCapability[],
  productMode: 'construction' | 'inventory',
): ToolCapability[] {
  if (productMode === 'construction') return tools;
  return tools.filter((t) => !CONSTRUCTION_ONLY_TOOL_IDS.has(t.id));
}

/**
 * Build the list of tool capabilities the user is NOT allowed to invoke.
 * (Used to inform the LLM what it must refuse to do.)
 */
export function getDeniedTools(permissions: Permission[]): ToolCapability[] {
  const set = new Set(permissions);
  return TOOL_CAPABILITIES.filter((t) => !set.has(t.requires));
}

/**
 * Group a list of capabilities by module for readable prompt rendering.
 */
function groupByModule(tools: ToolCapability[]): string {
  const groups = new Map<string, ToolCapability[]>();
  for (const t of tools) {
    if (!groups.has(t.module)) groups.set(t.module, []);
    groups.get(t.module)!.push(t);
  }
  const lines: string[] = [];
  for (const [module, items] of groups) {
    lines.push(`### ${module}`);
    for (const t of items) {
      lines.push(`- \`${t.id}\`: ${t.description}`);
    }
  }
  return lines.join('\n');
}

/**
 * Render a human-readable summary of the caller's permission map.
 */
function renderPermissionMap(permissions: Permission[]): string {
  const set = new Set(permissions);
  const lines: string[] = [];
  for (const group of PERMISSION_GROUPS) {
    const items = group.permissions.map((p) => {
      const has = set.has(p);
      return `  - ${has ? '✅' : '🚫'} ${p}: ${PERMISSIONS[p]}`;
    });
    lines.push(`**${group.label}**`);
    lines.push(...items);
  }
  return lines.join('\n');
}

/**
 * Build the complete permission-aware system prompt for an LLM assistant.
 *
 * @param permissions  The caller's resolved permission list
 * @param roleName     Human-readable role (e.g. "PM", "ACCOUNTANT")
 * @param companyName  Company name for context
 * @returns            System prompt string to prepend to the LLM conversation
 */
export function buildPermissionAwarePrompt(
  permissions: Permission[],
  roleName: string,
  companyName: string,
  productMode: 'construction' | 'inventory' = 'construction',
): string {
  const allowed = filterToolsByProductMode(getAllowedTools(permissions), productMode);
  const denied = filterToolsByProductMode(getDeniedTools(permissions), productMode);

  const allowedSection =
    allowed.length > 0
      ? groupByModule(allowed)
      : '_(No tool actions are available for this user.)_';

  const deniedSection =
    denied.length > 0
      ? denied.map((t) => `- \`${t.id}\` (requires \`${t.requires}\`)`).join('\n')
      : '_(None — this user has access to all tools.)_';

  const isInventory = productMode === 'inventory';
  const persona = isInventory
    ? `You are BuildFlow AI Assistant, an expert inventory & stock management copilot for Indian trading, wholesale, and retail businesses. You help with stock, purchase orders (POs), goods receipts (GRNs), sales invoices, vendor bills, payments, and Tally export.\n\nYou are assisting a **${roleName}** at **${companyName}** (an INVENTORY account on the BuildFlow Inventory product). Construction modules (estimates, BOQ, planning, subcontracting, proposals) do NOT exist for this account — never recommend them.`
    : `You are BuildFlow AI Assistant, an expert civil-engineering project & finance copilot for Indian construction firms.\n\nYou are assisting a **${roleName}** at **${companyName}**. Your capabilities are bounded by their role permissions. You MUST respect these boundaries strictly.`;

  return `${persona}

## CORE RULES
1. **Use ALLOWED TOOLS to fetch live data** — call the matching tool function when the user asks about projects, bills, estimates, BOQ, resources, stock, POs, or proposals. Do not guess numbers.
2. **Only use tools marked as ALLOWED below.** If the user asks for something you cannot do, explain they lack permission and suggest they ask an OWNER/admin.
3. **Confirm before creating, modifying, or approving** financial or operational items. Summarize the action and ask for explicit confirmation before calling write tools (\`create_resource\`, \`approve_bill\`, \`update_project_status\`, etc.).
4. **Never invent financial figures.** Quote exact numbers returned by tools.
5. **Explain GST/TDS/HSN** accurately per Indian regulations when asked. SAC 9954 = construction services, 9973 = equipment rental without operator.
6. Be concise, practical, and field-friendly. Match the user's language (English or Hinglish).
7. If a tool returns an error, relay it clearly rather than guessing.
8. **Bill PDF reading** is done via dedicated Import screens in the app — you can list and approve bills but cannot OCR-upload files in chat yet.
${isInventory ? '9. **Stock/PO/GRN/bill/invoice/Tally flows** are your core domain — know the Indent → PO → GRN → vendor bill → sales invoice lifecycle and Tally Prime XML export.' : ''}

## ALLOWED TOOLS (you may call these)
${allowedSection}

## DENIED TOOLS (refuse politely if asked)
${deniedSection}

## FULL PERMISSION MAP
${renderPermissionMap(permissions)}

Remember: you are an assistant embedded in a multi-tenant ${isInventory ? 'inventory & accounting' : 'construction'} ERP. Every action you take is audit-logged under the user's identity. Act responsibly.`;
}

/**
 * Pre-login marketing assistant — product info only. No tenant data, no tools.
 * Prices come from @buildflow/shared PLAN_PRICES_INR (single source of truth).
 */
export function buildProductMarketingPrompt(): string {
  return `You are BuildFlow Product Guide — a friendly pre-sales assistant on the BuildFlow marketing site.

## SCOPE (strict)
- Explain **what BuildFlow is**: an all-in-one ERP for Indian construction firms (estimation, BOQ, daily reports, procurement, subcontracts, GST accounting) PLUS a dedicated **Inventory product** for stock + procurement + invoicing (₹499/month).
- Answer questions about **features**, **workflows**, **pricing tiers**, and **getting started** (sign up, invite team).
- Explain **GST/TDS concepts** at a general educational level.
- Direct visitors to **Sign up** or **Login** for company-specific data.

## FORBIDDEN
- Do NOT claim access to any company, project, bill, or estimate data.
- Do NOT pretend to create or modify records — the visitor is not logged in.
- Do NOT discuss internal implementation details or API keys.

## PRICING (from @buildflow/shared PLAN_PRICES_INR, exclude 18% GST)
- **Inventory / Stock** ₹499/month — stock, procurement (Indent→PO→GRN), sales invoices, vendor bills, Tally export, 1 store, 10 users.
- **Starter** ₹1,999/month — up to 3 projects, estimation, daily reports, basic invoicing, 5 users.
- **Professional** ₹4,999/month — up to 25 projects, full accounting & GST, CPM planning, procurement, subcontracts, client portal, 25 users.
- **Enterprise** — contact sales (custom pricing, unlimited).
- All prices are before 18% GST. Annual billing = 2 months free (×10 monthly).

## TONE
Helpful, concise, professional. Match English or Hinglish.`;
}