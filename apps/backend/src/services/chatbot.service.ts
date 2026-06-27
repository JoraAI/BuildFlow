/**
 * BuildFlow — Chatbot service (BuildFlow Assistant).
 *
 * POST /api/chatbot/message
 *   - Persists the user's message
 *   - Builds project/company context (status, estimate vs actual, budget, overdue tasks,
 *     outstanding invoices, materials variance)
 *   - Calls an OpenAI-compatible LLM endpoint (LLM_API_URL) with a civil-engineering
 *     expert system prompt; supports English + Hinglish.
 *   - Persists the bot reply and returns it
 *
 * If LLM creds are absent, returns a deterministic canned answer built from the same
 * context — so the assistant is always usable in local dev.
 */
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { getEstimateVsActual } from './financial-report.service';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

const SYSTEM_PROMPT = `You are BuildFlow Assistant, an expert civil-engineering project & finance AI for Indian construction firms.
You explain GST/TDS, interpret Gantt schedules, discuss estimates vs actuals, and help with BOQ, resources and cost control.
Be concise, practical, and field-friendly. Answer in English or Hinglish matching the user's language.
Use only the provided project context to answer questions about specific projects. If data is missing, say so.
Never invent financial numbers. Quote the context figures verbatim when discussing money.`;

/** Build a compact context block for the LLM from company + optional project. */
export async function buildContext(companyId: string, projectId?: string): Promise<string> {
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
    lines.push(`Project: ${project.name} | Status: ${project.status} | Budget: Rs ${num(project.budget).toLocaleString('en-IN')}`);

    const ea = await getEstimateVsActual(companyId, projectId).catch(() => null);
    if (ea) {
      lines.push(`Completion: ${ea.completionPct}%`);
      lines.push(`Estimate vs Actual: estimated Rs ${ea.totalEstimated.toLocaleString('en-IN')}, actual Rs ${ea.totalActual.toLocaleString('en-IN')}, variance Rs ${ea.totalVariance.toLocaleString('en-IN')}`);
      if (ea.flagged.length) lines.push(`Variance flags: ${ea.flagged.join('; ')}`);
    }

    const overdue = await prisma.task.count({
      where: { projectId, status: 'DELAYED' },
    });
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

interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string }

async function callLLM(messages: LlmMessage[]): Promise<string | null> {
  if (!env.LLM_API_URL || !env.LLM_API_KEY) return null;
  try {
    const res = await fetch(`${env.LLM_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    });
    if (!res.ok) {
      logger.warn('LLM call failed', { status: res.status });
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    logger.warn('LLM call error', { error: String(err) });
    return null;
  }
}

/** Deterministic fallback when no LLM is configured — still context-aware. */
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
  // 1. Persist user message
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

  // 2. Build context
  const context = await buildContext(companyId, projectId);

  // 3. Fetch last ~8 messages for conversational continuity
  const history = await prisma.chatMessage.findMany({
    where: { companyId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { message: true, isBot: true },
  });
  const llmMessages: LlmMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- CONTEXT ---\n${context}` },
    ...history.reverse().map<LlmMessage & { role: 'user' | 'assistant' }>((h) => ({
      role: h.isBot ? 'assistant' : 'user',
      content: h.message,
    })),
  ];

  // 4. Get reply (LLM or canned)
  let reply = await callLLM(llmMessages);
  if (!reply) reply = cannedReply(message, context);

  // 5. Persist bot message
  const botMsg = await prisma.chatMessage.create({
    data: {
      companyId,
      senderId: userId, // conversation owner; isBot marks origin
      projectId: projectId ?? null,
      message: reply,
      messageType: 'TEXT',
      isBot: true,
    },
  });

  return { userMessageId: userMsg.id, botMessageId: botMsg.id, reply };
}

/** List conversation history (newest last) for a user, optionally filtered by project. */
export async function listHistory(companyId: string, userId: string, projectId?: string) {
  return prisma.chatMessage.findMany({
    where: {
      companyId,
      senderId: userId, // each user has their own thread with the bot
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
}