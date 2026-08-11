/**
 * BuildFlow - Chatbot service (BuildFlow Assistant).
 *
 * Post-login: permission-aware prompt + OpenAI function calling (MCP-equivalent tools).
 * Pre-login: product marketing prompt only (no tools, no tenant data).
 */
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { resolveLlmConfig } from './integration.service';
import { Decimal } from '@prisma/client/runtime/library';
import { getEstimateVsActual } from './financial-report.service';
import { buildPermissionAwarePrompt, buildProductMarketingPrompt } from '@buildflow/shared';
import {
  buildOpenAiTools,
  executeAssistantTool,
  resolveAssistantIdentity,
} from './assistant-tools.service';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

export async function buildContext(companyId: string, projectId?: string, userId?: string): Promise<string> {
  const company = await prisma.company.findFirstOrThrow({
    where: { id: companyId },
    select: { name: true, state: true, gstin: true },
  });

  const lines: string[] = [`Company: ${company.name} (GSTIN ${company.gstin}, ${company.state})`];

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, name: true, status: true, budget: true, startDate: true, endDate: true },
    });
    if (!project) return lines.join('\n');

    if (userId) {
      const isMember = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!isMember) return lines.join('\n');
    }
    lines.push(
      `Project: ${project.name} | Status: ${project.status} | Budget: Rs ${num(project.budget).toLocaleString('en-IN')}`,
    );

    const ea = await getEstimateVsActual(companyId, projectId).catch(() => null);
    if (ea) {
      lines.push(`Completion: ${ea.completionPct}%`);
      lines.push(
        `Estimate vs Actual: estimated Rs ${ea.totalEstimated.toLocaleString('en-IN')}, actual Rs ${ea.totalActual.toLocaleString('en-IN')}, variance Rs ${ea.totalVariance.toLocaleString('en-IN')}`,
      );
      if (ea.flagged.length) lines.push(`Variance flags: ${ea.flagged.join('; ')}`);
    }

    const overdue = await prisma.task.count({ where: { projectId, status: 'DELAYED' } });
    lines.push(`Overdue tasks: ${overdue}`);

    const outstanding = await prisma.invoice.aggregate({
      where: { projectId, status: { in: ['SENT', 'OVERDUE'] } },
      _sum: { total: true },
    });
    lines.push(`Outstanding invoices: Rs ${num(outstanding._sum.total).toLocaleString('en-IN')}`);
  } else {
    const counts = await prisma.project.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    });
    lines.push(`Projects by status: ${counts.map((c) => `${c.status}=${c._count}`).join(', ') || 'none'}`);
  }
  return lines.join('\n');
}

type LlmMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

async function callLLMOnce(
  companyId: string | null,
  messages: LlmMessage[],
  tools?: ReturnType<typeof buildOpenAiTools>,
): Promise<LlmResponse | null> {
  const cfg = companyId ? await resolveLlmConfig(companyId) : await resolvePlatformLlmConfig();
  if (!cfg) return null;
  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      temperature: 0.4,
      max_tokens: 900,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    const res = await fetch(`${cfg.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn('LLM call failed', { status: res.status, companyId });
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
    };
    const msg = data.choices?.[0]?.message;
    return {
      content: msg?.content ?? null,
      toolCalls: msg?.tool_calls ?? [],
    };
  } catch (err) {
    logger.warn('LLM call error', { error: String(err), companyId });
    return null;
  }
}

async function resolvePlatformLlmConfig() {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  if (!apiUrl || !apiKey) return null;
  return { apiUrl, apiKey, model };
}

async function runLlmWithTools(
  companyId: string,
  identity: Awaited<ReturnType<typeof resolveAssistantIdentity>>,
  messages: LlmMessage[],
): Promise<string | null> {
  const tools = buildOpenAiTools(identity.permissions, identity.productMode);
  const working = [...messages];
  const MAX_ROUNDS = 5;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await callLLMOnce(companyId, working, tools);
    if (!res) return null;

    if (res.toolCalls.length === 0) {
      return res.content?.trim() || null;
    }

    working.push({
      role: 'assistant',
      content: res.content,
      tool_calls: res.toolCalls,
    });

    for (const tc of res.toolCalls) {
      let result: unknown;
      try {
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
        result = await executeAssistantTool(identity, tc.function.name, args);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      working.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  const final = await callLLMOnce(companyId, working, undefined);
  return final?.content?.trim() ?? null;
}

function cannedReply(message: string, context: string): string {
  const q = message.toLowerCase();
  if (q.includes('status') || q.includes('project')) {
    return `Here's the current context:\n${context}\n\nWhat specifically would you like to dive into?`;
  }
  if (q.includes('gst') || q.includes('tax')) {
    return 'GST on works contracts: 18% (12% CGST + 6% SGST intra-state, or 18% IGST inter-state). For government contracts, TDS under section 194C applies at 1%/2%.';
  }
  if (q.includes('estimate') || q.includes('budget') || q.includes('variance')) {
    return `Estimate vs actual snapshot:\n${context}\n\nTip: review any section flagged >15% over estimate.`;
  }
  if (q.includes('tds')) {
    return 'TDS section 194C: 1% for individual/HUF contractor, 2% for others, on payments above Rs 30,000 (single) or Rs 1,00,000 (aggregate p.a.).';
  }
  return `I'm BuildFlow Assistant. I can explain this project's status, GST/TDS, estimate vs actual, overdue tasks and outstanding invoices.\n\nContext:\n${context}`;
}

function cannedMarketingReply(message: string): string {
  const q = message.toLowerCase();
  if (q.includes('price') || q.includes('cost') || q.includes('plan')) {
    return 'BuildFlow plans: Inventory ₹499/month (stock + procurement + invoicing + Tally), Starter ₹1,999/month (up to 3 projects), Professional ₹4,999/month (up to 25 projects). Enterprise is custom - contact sales. All prices before 18% GST. Sign up for a free trial from the homepage.';
  }
  if (q.includes('gst') || q.includes('invoice') || q.includes('bill')) {
    return 'BuildFlow includes GST-aware invoicing (client invoices) and vendor bills with CGST/SGST/IGST split and TDS tracking — built for Indian construction firms and inventory businesses.';
  }
  return 'BuildFlow is an all-in-one ERP for Indian construction firms (estimation, BOQ, daily site reports, procurement, subcontracts, accounting) plus a dedicated Inventory product (stock, procurement, invoices, bills, Tally). Sign up or log in to get started. What would you like to know?';
}

export interface ChatResult {
  userMessageId: string;
  botMessageId: string;
  reply: string;
}

export async function handleChatMessage(
  companyId: string,
  userId: string,
  message: string,
  projectId?: string,
): Promise<ChatResult> {
  const userMsg = await prisma.chatMessage.create({
    data: {
      companyId,
      senderId: userId,
      projectId: projectId ?? null,
      message,
      messageType: 'TEXT',
      isBot: false,
    },
  });

  const context = await buildContext(companyId, projectId, userId);
  const identity = await resolveAssistantIdentity(companyId, userId);
  const company = await prisma.company.findFirstOrThrow({
    where: { id: companyId },
    select: { name: true },
  });
  const permissionPrompt = buildPermissionAwarePrompt(
    identity.permissions,
    identity.role,
    company.name,
    identity.productMode,
  );

  const history = await prisma.chatMessage.findMany({
    where: { companyId, senderId: userId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { message: true, isBot: true },
  });

  const llmMessages: LlmMessage[] = [
    {
      role: 'system',
      content: `${permissionPrompt}\n\n--- LIVE CONTEXT (may be stale — prefer tools for numbers) ---\n${context}`,
    },
    ...history.reverse().map((h) => ({
      role: (h.isBot ? 'assistant' : 'user') as 'assistant' | 'user',
      content: h.message,
    })),
  ];

  let reply = await runLlmWithTools(companyId, identity, llmMessages);
  if (!reply) reply = cannedReply(message, context);

  const botMsg = await prisma.chatMessage.create({
    data: {
      companyId,
      senderId: userId,
      projectId: projectId ?? null,
      message: reply,
      messageType: 'TEXT',
      isBot: true,
    },
  });

  return { userMessageId: userMsg.id, botMessageId: botMsg.id, reply };
}

/** Pre-login product guide — stateless, no DB persistence. */
export async function handlePublicChatMessage(message: string): Promise<{ reply: string }> {
  const systemPrompt = buildProductMarketingPrompt();
  const llmMessages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];
  const res = await callLLMOnce(null, llmMessages, undefined);
  const reply = res?.content?.trim() || cannedMarketingReply(message);
  return { reply };
}

export async function listHistory(companyId: string, userId: string, projectId?: string) {
  return prisma.chatMessage.findMany({
    where: {
      companyId,
      senderId: userId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
}
