/** Project tab subtitles and setup checklist steps. */
export type ProjectTabId =
  | 'overview'
  | 'estimate'
  | 'schedule'
  | 'boq'
  | 'bills'
  | 'variations'
  | 'procurement'
  | 'subcontracts'
  | 'resources'
  | 'reports'
  | 'settings';

export const PROJECT_TAB_HINTS: Record<ProjectTabId, string> = {
  overview: 'Summary and setup checklist',
  estimate: 'Cost plan before work starts',
  schedule: 'When tasks happen on site',
  boq: 'Approved quantities and rates for billing',
  bills: 'Vendor bills and payments for this project',
  variations: 'Extra scope after BOQ was fixed',
  procurement: 'Buy materials: request → order → receive',
  subcontracts: 'Subcontractors: measure work → pay bills',
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
  { id: 'reports', label: 'Start site reports', hint: 'Supervisors log daily work', tab: 'reports' },
  { id: 'procurement', label: 'Procure materials', hint: 'Indent → PO → GRN when goods arrive', tab: 'procurement' },
  { id: 'subcontracts', label: 'Set up subcontracts', hint: 'Work orders and measurement sheets', tab: 'subcontracts' },
  { id: 'invoices', label: 'Bill the client', hint: 'Create invoices in Accounting', tab: 'overview' },
];
