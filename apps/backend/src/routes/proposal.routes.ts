/**
 * BuildFlow - Proposal routes.
 */
import { Router } from 'express';
import * as proposalController from '../controllers/proposal.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
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

proposalRouter.get('/', validate({ query: proposalQuerySchema }), proposalController.listProposals);
proposalRouter.post('/', validate({ body: createProposalSchema }), proposalController.createProposal);
proposalRouter.get(
  '/:id',
  validate({ params: proposalIdParamsSchema }),
  proposalController.getProposal,
);
proposalRouter.patch(
  '/:id',
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

// Tender AI import — upload a client tender (PDF/Excel), extract BOQ items via LLM.
proposalRouter.post(
  '/:id/import-tender',
  validate({ params: proposalIdParamsSchema, body: tenderUploadSchema }),
  proposalController.importTender,
);
