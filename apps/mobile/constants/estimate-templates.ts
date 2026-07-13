/**
 * Estimate Templates - Main entry point.
 *
 * Re-exports from the modular template directory.
 * Import from this file as before: import { ESTIMATE_TEMPLATES } from '@/constants/estimate-templates'
 */
export {
  ESTIMATE_TEMPLATES,
  getTemplatesByCategory,
  getTemplateCategories,
  INFRASTRUCTURE_TEMPLATES,
  BUILDING_TEMPLATES,
  UTILITY_TEMPLATES,
  EARTHWORK_TEMPLATES,
  SPECIALTY_TEMPLATES,
} from './estimate-templates/index';

export type {
  EstimateTemplate,
  EstimateTemplateSection,
  EstimateTemplateItem,
  EstimateItemType,
} from './estimate-templates/types';