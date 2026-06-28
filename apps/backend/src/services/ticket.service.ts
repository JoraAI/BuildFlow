/**
 * BuildFlow — Support ticket service (company + platform scope).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { TicketStatus, TicketScope } from '@prisma/client';
import { notify } from './notification.service';
import { notifyInternalOps } from './ops-notification.service';
import * as settingsService from './settings.service';
import type { CreateTicketInput, UpdateTicketInput } from '@buildflow/shared';

export interface TicketRow {
  id: string;
  companyId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  scope: string;
  category: string;
  subject: string;
  description: string;
  payload: unknown;
  status: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function serialize(t: {
  id: string;
  companyId: string;
  requesterId: string;
  scope: string;
  category: string;
  subject: string;
  description: string;
  payload: unknown;
  status: string;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requester: { name: string; email: string };
}): TicketRow {
  return {
    id: t.id,
    companyId: t.companyId,
    requesterId: t.requesterId,
    requesterName: t.requester.name,
    requesterEmail: t.requester.email,
    scope: t.scope,
    category: t.category,
    subject: t.subject,
    description: t.description,
    payload: t.payload,
    status: t.status,
    resolutionNote: t.resolutionNote,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const ticketInclude = {
  requester: { select: { name: true, email: true } },
} as const;

export async function createTicket(
  companyId: string,
  requesterId: string,
  input: CreateTicketInput,
): Promise<TicketRow> {
  const scope = (input.scope ?? 'COMPANY') as TicketScope;
  if (scope === 'PLATFORM') {
    const requester = await prisma.user.findFirstOrThrow({
      where: { id: requesterId, companyId },
      select: { role: true },
    });
    if (requester.role !== 'OWNER') {
      throw ApiError.forbidden('Only company owners can submit platform support tickets');
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      companyId,
      requesterId,
      scope,
      category: input.category,
      subject: input.subject,
      description: input.description,
      payload: (input.payload ?? undefined) as object | undefined,
      status: scope === 'PLATFORM' ? 'ESCALATED' : 'OPEN',
    },
    include: ticketInclude,
  });

  if (scope === 'COMPANY') {
    const owners = await prisma.user.findMany({
      where: { companyId, role: 'OWNER', isActive: true },
      select: { id: true },
    });
    for (const o of owners) {
      await notify({
        userId: o.id,
        title: 'New support request',
        body: input.subject,
        type: 'SUPPORT_TICKET',
        referenceId: ticket.id,
      });
    }
  } else {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true },
    });
    await notifyInternalOps({
      event: 'support_ticket_escalated',
      companyId,
      companyName: company.name,
      message: `[BuildFlow] Platform ticket: ${input.subject} (${company.name})`,
    });
  }

  return serialize(ticket);
}

export async function listMyTickets(companyId: string, userId: string): Promise<TicketRow[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { companyId, requesterId: userId },
    orderBy: { createdAt: 'desc' },
    include: ticketInclude,
  });
  return rows.map(serialize);
}

export async function listCompanyInbox(companyId: string): Promise<TicketRow[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { companyId, scope: 'COMPANY' },
    orderBy: { createdAt: 'desc' },
    include: ticketInclude,
  });
  return rows.map(serialize);
}

export async function listPlatformTickets(): Promise<
  Array<TicketRow & { companyName: string }>
> {
  const rows = await prisma.supportTicket.findMany({
    where: { scope: 'PLATFORM' },
    orderBy: { createdAt: 'desc' },
    include: {
      ...ticketInclude,
      company: { select: { name: true } },
    },
  });
  return rows.map((t) => ({
    ...serialize(t),
    companyName: t.company.name,
  }));
}

export async function getTicket(ticketId: string, companyId: string): Promise<TicketRow> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, companyId },
    include: ticketInclude,
  });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  return serialize(ticket);
}

export async function updateCompanyTicket(
  ticketId: string,
  companyId: string,
  _actorId: string,
  input: UpdateTicketInput,
): Promise<TicketRow> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, companyId, scope: 'COMPANY' },
    include: ticketInclude,
  });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  if (['RESOLVED', 'REJECTED'].includes(ticket.status)) {
    throw ApiError.badRequest('Ticket is already closed');
  }

  let status = (input.status ?? ticket.status) as TicketStatus;
  let resolutionNote = input.resolutionNote ?? ticket.resolutionNote;

  if (status === 'ESCALATED') {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true },
    });
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { scope: 'PLATFORM', status: 'ESCALATED' },
    });
    await notifyInternalOps({
      event: 'support_ticket_escalated',
      companyId,
      companyName: company.name,
      message: `[BuildFlow] Escalated ticket: ${ticket.subject} (${company.name})`,
    });
    await notify({
      userId: ticket.requesterId,
      title: 'Request escalated',
      body: 'Your request was escalated to BuildFlow support.',
      type: 'SUPPORT_TICKET',
      referenceId: ticketId,
    });
    const updated = await prisma.supportTicket.findFirstOrThrow({
      where: { id: ticketId },
      include: ticketInclude,
    });
    return serialize(updated);
  }

  if (status === 'RESOLVED' && input.applyChanges && ticket.payload) {
    await applyTicketPayload(ticket.requesterId, companyId, ticket.payload as Record<string, unknown>);
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      resolutionNote,
      resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : null,
    },
    include: ticketInclude,
  });

  await notify({
    userId: ticket.requesterId,
    title: status === 'RESOLVED' ? 'Request approved' : status === 'REJECTED' ? 'Request rejected' : 'Request updated',
    body: resolutionNote ?? ticket.subject,
    type: 'SUPPORT_TICKET',
    referenceId: ticketId,
  });

  return serialize(updated);
}

async function applyTicketPayload(
  userId: string,
  companyId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const data: settingsService.UserUpdateInput = {};
  if (typeof payload.requestedName === 'string') data.name = payload.requestedName;
  if (typeof payload.requestedPhone === 'string') data.phone = payload.requestedPhone;
  if (typeof payload.requestedRole === 'string') {
    data.role = payload.requestedRole as settingsService.UserUpdateInput['role'];
  }
  if (Object.keys(data).length > 0) {
    await settingsService.updateUser(userId, companyId, data);
  }
}

export async function updatePlatformTicket(
  ticketId: string,
  input: { status?: string; resolutionNote?: string },
): Promise<TicketRow & { companyName: string }> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, scope: 'PLATFORM' },
    include: { ...ticketInclude, company: { select: { name: true } } },
  });
  if (!ticket) throw ApiError.notFound('Ticket not found');

  const status = (input.status ?? ticket.status) as TicketStatus;
  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      resolutionNote: input.resolutionNote ?? ticket.resolutionNote,
      resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : null,
    },
    include: { ...ticketInclude, company: { select: { name: true } } },
  });

  await notify({
    userId: ticket.requesterId,
    title: 'BuildFlow support update',
    body: input.resolutionNote ?? `Your ticket status: ${status}`,
    type: 'SUPPORT_TICKET',
    referenceId: ticketId,
  });

  return { ...serialize(updated), companyName: updated.company.name };
}
