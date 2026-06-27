/**
 * BuildFlow — Estimation Zustand store.
 *
 * Holds draft state for the estimate wizard and provides a pure summary
 * computation helper used across screens.
 */
import { create } from 'zustand';

export interface DraftItem {
  id: string; // local UUID
  sectionId: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  type: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC';
  resourceId?: string;
  itemCode?: string;
}

export interface DraftSection {
  id: string;
  name: string;
}

export interface EstimateBreakdown {
  material: number;
  labour: number;
  equipment: number;
  subcontractor: number;
  misc: number;
}

export interface EstimateSummaryComputed {
  directCosts: EstimateBreakdown;
  subtotal: number;
  overheadAmount: number;
  contingencyAmount: number;
  profitAmount: number;
  totalBeforeTax: number;
  grandTotal: number;
}

interface EstimationState {
  activeEstimateId: string | null;
  projectId: string | null;
  overheadPct: number;
  contingencyPct: number;
  profitMarginPct: number;
  sections: DraftSection[];
  items: DraftItem[];

  setActiveEstimate: (id: string | null, projectId: string | null) => void;
  setAddOns: (p: { overheadPct?: number; contingencyPct?: number; profitMarginPct?: number }) => void;
  addSection: (name: string) => string;
  addItem: (item: Omit<DraftItem, 'id'>) => string;
  updateItem: (id: string, patch: Partial<DraftItem>) => void;
  removeItem: (id: string) => void;
  reset: () => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const useEstimationStore = create<EstimationState>((set) => ({
  activeEstimateId: null,
  projectId: null,
  overheadPct: 8,
  contingencyPct: 5,
  profitMarginPct: 10,
  sections: [],
  items: [],

  setActiveEstimate: (id, projectId) => set({ activeEstimateId: id, projectId }),
  setAddOns: (p) =>
    set((s) => ({
      overheadPct: p.overheadPct ?? s.overheadPct,
      contingencyPct: p.contingencyPct ?? s.contingencyPct,
      profitMarginPct: p.profitMarginPct ?? s.profitMarginPct,
    })),
  addSection: (name) => {
    const id = uid();
    set((s) => ({ sections: [...s.sections, { id, name }] }));
    return id;
  },
  addItem: (item) => {
    const id = uid();
    set((s) => ({ items: [...s.items, { ...item, id }] }));
    return id;
  },
  updateItem: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  reset: () => set({ activeEstimateId: null, projectId: null, sections: [], items: [], overheadPct: 8, contingencyPct: 5, profitMarginPct: 10 }),
}));

/** Pure helper: compute a summary from arbitrary items + add-on percentages. */
export function computeSummary(
  items: Array<{ type: DraftItem['type']; quantity: number; rate: number }>,
  overheadPct: number,
  contingencyPct: number,
  profitMarginPct: number,
): EstimateSummaryComputed {
  const direct: EstimateBreakdown = { material: 0, labour: 0, equipment: 0, subcontractor: 0, misc: 0 };
  for (const it of items) {
    const amt = it.quantity * it.rate;
    switch (it.type) {
      case 'MATERIAL': direct.material += amt; break;
      case 'LABOUR': direct.labour += amt; break;
      case 'EQUIPMENT': direct.equipment += amt; break;
      case 'SUBCONTRACTOR': direct.subcontractor += amt; break;
      default: direct.misc += amt;
    }
  }
  const subtotal = direct.material + direct.labour + direct.equipment + direct.subcontractor + direct.misc;
  const overheadAmount = subtotal * (overheadPct / 100);
  const contingencyAmount = subtotal * (contingencyPct / 100);
  const profitAmount = subtotal * (profitMarginPct / 100);
  const totalBeforeTax = subtotal + overheadAmount + contingencyAmount + profitAmount;
  // Mobile-side grand total excludes GST (weighted per-resource) — computed on backend GET.
  return { directCosts: direct, subtotal, overheadAmount, contingencyAmount, profitAmount, totalBeforeTax, grandTotal: totalBeforeTax };
}