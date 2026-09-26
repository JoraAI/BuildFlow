-- Indent fully received via GRN(s). Not used on purchase orders.
ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'FULFILLED';
