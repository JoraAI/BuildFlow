/**
 * BuildFlow - Proposal routes.
 */
import { Router } from 'express';
import * as proposalController from '../controllers/proposal.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireModule } from '../middleware/module-gate';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import {
  createProposalSchema,
  updateProposalSchema,
  proposalQuerySchema,
  proposalIdParamsSchema,
  promoteProposalSchema,
  tenderUploadSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const proposalRouter = Router();

proposalRouter.use(authenticateToken);
proposalRouter.use(requireModule('proposals'));

proposalRouter.get(
  '/',
  requirePermission('proposal.view'),
  validate({ query: proposalQuerySchema }),
  proposalController.listProposals,
);
proposalRouter.post(
  '/',
  requirePermission('proposal.create'),
  validate({ body: createProposalSchema }),
  proposalController.createProposal,
);
proposalRouter.get(
  '/:id',
  requirePermission('proposal.view'),
  validate({ params: proposalIdParamsSchema }),
  proposalController.getProposal,
);
proposalRouter.patch(
  '/:id',
  requirePermission('proposal.create'),
  validate({ params: proposalIdParamsSchema, body: updateProposalSchema }),
  proposalController.updateProposal,
);
proposalRouter.post(
  '/:id/promote',
  requireRole(Role.OWNER),
  validate({ params: proposalIdParamsSchema, body: promoteProposalSchema }),
  proposalController.promoteProposal,
);
proposalRouter.delete(
  '/:id',
  requireRole(Role.OWNER),
  validate({ params: proposalIdParamsSchema }),
  proposalController.deleteProposal,
);

// Tender AI import - upload a client tender (PDF/Excel), extract BOQ items via LLM.
proposalRouter.post(
  '/:id/import-tender',
  requirePermission('proposal.create'),
  validate({ params: proposalIdParamsSchema, body: tenderUploadSchema }),
  proposalController.importTender,
);
