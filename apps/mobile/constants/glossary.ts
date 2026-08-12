/** Plain-language glossary for construction ERP terms. */
export type GlossaryTermId =
  | 'BOQ'
  | 'GRN'
  | 'INDENT'
  | 'WORK_ORDER'
  | 'RETENTION'
  | 'RA_INVOICE'
  | 'CERTIFIED'
  | 'PROCURED'
  | 'EXECUTED'
  | 'INVOICE'
  | 'BILL'
  | 'VARIATION'
  | 'MEASUREMENT_SHEET';

export interface GlossaryEntry {
  title: string;
  plain: string;
  inApp: string;
}

export const GLOSSARY: Record<GlossaryTermId, GlossaryEntry> = {
  BOQ: {
    title: 'BOQ (Bill of Quantities)',
    plain: 'The approved list of work items, quantities, and rates for a project - your contract scope.',
    inApp: 'Created from an approved estimate. Used for client billing, procurement, and tracking progress.',
  },
  GRN: {
    title: 'GRN (Goods Receipt Note)',
    plain: 'Proof that materials ordered on a purchase order actually arrived on site.',
    inApp: 'Record a GRN on the Procurement tab after goods are received. This updates site stock and procured quantity on the BOQ.',
  },
  INDENT: {
    title: 'Indent (Material requisition)',
    plain: 'A site request to buy materials - the first step before placing a purchase order.',
    inApp: 'Create on Procurement tab → Submit → PM/Owner approves → Create PO → Record GRN.',
  },
  WORK_ORDER: {
    title: 'Work order (Subcontract)',
    plain: 'A contract with a subcontractor for a defined scope of work and value.',
    inApp: 'Created on Subcontracts tab. Track certification via measurement sheets and pay via linked bills.',
  },
  RETENTION: {
    title: 'Retention',
    plain: 'A percentage of each subcontract payment held back until the work is fully complete.',
    inApp: 'Deducted on measurement approval bills. Released via a retention release bill when the work order is completed.',
  },
  RA_INVOICE: {
    title: 'RA invoice (Running Account)',
    plain: 'Progress billing to the client based on work certified so far, not the full contract at once.',
    inApp: 'Create in Accounting → Invoices with type Running Account. Tracks cumulative certified quantities.',
  },
  CERTIFIED: {
    title: 'Certified (Subcontract)',
    plain: 'Work quantity formally approved on a measurement sheet - this is what you owe the subcontractor.',
    inApp: 'Shown on work order summary. Increases when PM approves a measurement sheet.',
  },
  PROCURED: {
    title: 'Procured quantity',
    plain: 'Materials physically received on site (via GRN), not work done by a subcontractor.',
    inApp: 'Shown on BOQ material lines. Updated by procurement - separate from subcontract certification.',
  },
  EXECUTED: {
    title: 'Executed quantity',
    plain: 'Work or materials actually used on site, measured against the BOQ.',
    inApp: 'Updated by daily reports, BOQ measurements, or subcontract certification depending on item type.',
  },
  INVOICE: {
    title: 'Invoice (Client)',
    plain: 'Money you bill to your client - revenue coming in.',
    inApp: 'Accounting → Invoices. Can include GST, TDS, and running-account progress billing.',
  },
  BILL: {
    title: 'Bill (Vendor / subcontractor)',
    plain: 'Money you owe to a vendor or subcontractor - cost going out.',
    inApp: 'Accounting → Bills, or auto-created when a subcontract measurement is approved.',
  },
  VARIATION: {
    title: 'Variation (Change order)',
    plain: 'Agreed extra scope or quantity after the original BOQ was approved.',
    inApp: 'Variations tab → Owner approves → BOQ and budget update automatically.',
  },
  MEASUREMENT_SHEET: {
    title: 'Measurement sheet',
    plain: 'A period record of subcontract work done (quantities × rates) before payment.',
    inApp: 'Subcontracts tab → Add measurement → Submit → PM approves → linked bill is created.',
  },
};
