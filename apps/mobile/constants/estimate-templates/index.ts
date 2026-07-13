/**
 * Estimate Templates Index - Aggregates all template categories.
 *
 * Categories:
 *   - Infrastructure (roads, canals, bridges, drainage)
 *   - Buildings (residential, commercial, industrial, institutional)
 *   - Utilities (water tanks, STP, pools, solar)
 *   - Earthwork & Mining (gravel extraction, quarry)
 *   - Specialty (renovation, landscape)
 */
import type { EstimateTemplate } from './types';
import { INFRASTRUCTURE_TEMPLATES } from './infrastructure';
import { BUILDING_TEMPLATES } from './buildings';
import { UTILITY_TEMPLATES } from './utilities';
import { EARTHWORK_TEMPLATES } from './earthwork-mining';
import { SPECIALTY_TEMPLATES } from './specialty';

// Re-export types for convenience
export type { EstimateTemplate, EstimateTemplateSection, EstimateTemplateItem, EstimateItemType } from './types';

// Re-export individual categories
export { INFRASTRUCTURE_TEMPLATES } from './infrastructure';
export { BUILDING_TEMPLATES } from './buildings';
export { UTILITY_TEMPLATES } from './utilities';
export { EARTHWORK_TEMPLATES } from './earthwork-mining';
export { SPECIALTY_TEMPLATES } from './specialty';

// Legacy templates from original file (kept for backward compatibility)
import { LEGACY_TEMPLATES } from '../estimate-templates-legacy';

/**
 * All estimate templates combined, grouped by category.
 */
export const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  ...INFRASTRUCTURE_TEMPLATES,
  ...BUILDING_TEMPLATES,
  ...UTILITY_TEMPLATES,
  ...EARTHWORK_TEMPLATES,
  ...SPECIALTY_TEMPLATES,
  ...LEGACY_TEMPLATES,
];

/**
 * Get templates grouped by category for UI display.
 */
export function getTemplatesByCategory(): Record<string, EstimateTemplate[]> {
  const grouped: Record<string, EstimateTemplate[]> = {};
  for (const t of ESTIMATE_TEMPLATES) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }
  return grouped;
}

/**
 * Get all unique categories.
 */
export function getTemplateCategories(): string[] {
  return [...new Set(ESTIMATE_TEMPLATES.map((t) => t.category))];
}