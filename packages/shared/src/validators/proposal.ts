/**
 * BuildFlow - Proposal Zod validators.
 */
import { z } from 'zod';
import { ProjectType, ProposalStatus } from '../enums';
import { dateSchema } from './common';

export const proposalStatusSchema = z.nativeEnum(ProposalStatus);

export const createProposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  clientName: z.string().min(1, 'Client name is required').max(200),
  clientContact: z.string().max(50).optional(),
  projectType: z.nativeEnum(ProjectType),
  validUntil: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const updateProposalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  clientName: z.string().min(1).max(200).optional(),
  clientContact: z.string().max(50).optional(),
  projectType: z.nativeEnum(ProjectType).optional(),
  status: proposalStatusSchema.optional(),
  validUntil: dateSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  rejectionReason: z.string().max(500).nullable().optional(),
});

export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;

export const proposalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: proposalStatusSchema.optional(),
  search: z.string().optional(),
});

export type ProposalQueryInput = z.infer<typeof proposalQuerySchema>;

export const proposalIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const promoteProposalSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: z.enum(['PLANNING', 'IN_PROGRESS']).optional(),
});

export type PromoteProposalInput = z.infer<typeof promoteProposalSchema>;
