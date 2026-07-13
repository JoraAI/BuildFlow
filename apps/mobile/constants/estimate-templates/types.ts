/**
 * Shared types for comprehensive estimate templates.
 */
export type EstimateItemType = 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC';

export interface EstimateTemplateItem {
  itemCode?: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  type: EstimateItemType;
  /** Link to Settings → Material Prices catalog (1:1 MATERIAL lines). */
  resourceName?: string;
  /** Link to Rate Analysis library (composite BOM - procurement explodes components). */
  rateAnalysisName?: string;
}

export interface EstimateTemplateSection {
  name: string;
  items: EstimateTemplateItem[];
}

export interface EstimateTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: EstimateTemplateSection[];
}