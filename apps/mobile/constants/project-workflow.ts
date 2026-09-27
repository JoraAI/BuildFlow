/** Project tab subtitles and setup checklist steps. */
export type ProjectTabId =
  | 'overview'
  | 'estimate'
  | 'schedule'
  | 'boq'
  | 'invoices'
  | 'bills'
  | 'variations'
  | 'procurement'
  | 'subcontracts'
  | 'pettyCash'
  | 'drawings'
  | 'snags'
  | 'rfis'
  | 'laborWages'
  | 'resources'
  | 'reports'
  | 'settings';

export const PROJECT_TAB_HINTS: Record<ProjectTabId, string> = {
  overview: 'Summary and setup checklist',
  estimate: 'Cost plan before work starts',
  schedule: 'When tasks happen on site',
  boq: 'Approved quantities and rates for billing',
  invoices: 'Client invoices and Running Account (RA) bills',
  bills: 'Vendor bills and payments for this project',
  variations: 'Extra scope after BOQ was fixed',
  procurement: 'Buy materials: request → order → receive',
  subcontracts: 'Subcontractors: measure work → pay bills',
  pettyCash: 'Site float, snap receipts & 1-tap reconcile',
  drawings: 'GFC architectural, structural & MEP plans with pin drop',
  snags: 'Quality defect NCRs with before/after photos & sign-off',
  rfis: 'Site RFIs and material / shop-drawing submittals',
  laborWages: 'Daily muster steppers & Saturday wage settlement',
  resources: 'People, plant and material usage vs plan',
  reports: 'Daily site diary and photos',
  settings: 'Team, rates, and portal access',
};

export interface SetupChecklistStep {
  id: string;
  label: string;
  hint: string;
  tab: ProjectTabId;
}

export const PROJECT_SETUP_STEPS: SetupChecklistStep[] = [
  { id: 'estimate', label: 'Approve an estimate', hint: 'Build and approve the cost plan', tab: 'estimate' },
  { id: 'boq', label: 'Convert to BOQ', hint: 'Owner converts approved estimate to BOQ', tab: 'estimate' },
  { id: 'schedule', label: 'Plan the schedule', hint: 'Add tasks and track progress', tab: 'schedule' },
  { id: 'drawings', label: 'Upload drawings', hint: 'GFC plans for site reference and pins', tab: 'drawings' },
  { id: 'reports', label: 'Start site reports', hint: 'Supervisors log daily work', tab: 'reports' },
  { id: 'procurement', label: 'Procure materials', hint: 'Indent → PO → GRN when goods arrive', tab: 'procurement' },
  { id: 'subcontracts', label: 'Set up subcontracts', hint: 'Work orders and measurement sheets', tab: 'subcontracts' },
  { id: 'snags', label: 'Track snags / NCRs', hint: 'Log defects with photos as work progresses', tab: 'snags' },
  { id: 'rfis', label: 'Log RFIs', hint: 'Raise site questions and track answers', tab: 'rfis' },
  { id: 'pettyCash', label: 'Open petty cash', hint: 'Site float and receipt vouchers', tab: 'pettyCash' },
  { id: 'invoices', label: 'Bill the client', hint: 'Create RA or standard invoices on this project', tab: 'invoices' },
];
