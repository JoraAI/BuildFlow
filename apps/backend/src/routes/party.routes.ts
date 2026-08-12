/**
 * BuildFlow - Party master routes (INVENTORY_HORIZONTAL_PLATFORM Phase 1.1).
 *
 * Mounted at /api/inventory/parties and gated to the INVENTORY plan via the
 * `parties` feature flag — construction tenants get 403.
 */
import { Router } from 'express';
import * as partyController from '../controllers/party.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireInventoryFeature } from '../middleware/module-gate';
import {
  customerSchema,
  vendorSchema,
  updateCustomerSchema,
  updateVendorSchema,
  partyQuerySchema,
  partyIdParamsSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const partyRouter = Router();

partyRouter.use(authenticateToken);
partyRouter.use(requireInventoryFeature('parties'));

const canManageParties = requireRole(Role.OWNER, Role.INVENTORY_MANAGER);

// Customers (AR)
partyRouter.get('/customers', validate({ query: partyQuerySchema }), partyController.listCustomers);
partyRouter.post('/customers', canManageParties, validate({ body: customerSchema }), partyController.createCustomer);
partyRouter.get('/customers/:id', validate({ params: partyIdParamsSchema }), partyController.getCustomer);
// INVENTORY_HORIZONTAL_PLATFORM (Phase 5.3): customer AR ledger.
partyRouter.get('/customers/:id/ledger', validate({ params: partyIdParamsSchema }), partyController.getCustomerLedger);
partyRouter.put('/customers/:id', canManageParties, validate({ params: partyIdParamsSchema, body: updateCustomerSchema }), partyController.updateCustomer);
partyRouter.delete('/customers/:id', canManageParties, validate({ params: partyIdParamsSchema }), partyController.deleteCustomer);

// Vendors (AP)
partyRouter.get('/vendors', validate({ query: partyQuerySchema }), partyController.listVendors);
partyRouter.post('/vendors', canManageParties, validate({ body: vendorSchema }), partyController.createVendor);
partyRouter.get('/vendors/:id', validate({ params: partyIdParamsSchema }), partyController.getVendor);
// INVENTORY_HORIZONTAL_PLATFORM (Phase 5.3): vendor AP ledger.
partyRouter.get('/vendors/:id/ledger', validate({ params: partyIdParamsSchema }), partyController.getVendorLedger);
partyRouter.put('/vendors/:id', canManageParties, validate({ params: partyIdParamsSchema, body: updateVendorSchema }), partyController.updateVendor);
partyRouter.delete('/vendors/:id', canManageParties, validate({ params: partyIdParamsSchema }), partyController.deleteVendor);
