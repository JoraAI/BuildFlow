/**
 * Offline HSN/SAC suggestion for construction materials (India).
 * Assistive only - users can always override.
 */

export type HsnSuggestSource = 'catalog' | 'keyword' | 'category';

export interface HsnSuggestion {
  hsn: string;
  source: HsnSuggestSource;
}

export interface CatalogMaterialRef {
  name: string;
  hsnSacCode?: string | null;
}

/** Default HSN when category is selected and no keyword match. */
export const CATEGORY_HSN_DEFAULT: Record<string, string> = {
  Cement: '2523',
  Steel: '7213',
  Aggregates: '2517',
  Bricks: '6810',
  Other: '',
};

/** Typical GST % by material category (seed-aligned). */
export const CATEGORY_GST_DEFAULT: Record<string, number> = {
  Cement: 28,
  Steel: 18,
  Aggregates: 5,
  Bricks: 5,
  Other: 18,
};

/** Longest keyword first for best match. */
const KEYWORD_HSN_RULES: ReadonlyArray<{ keywords: string[]; hsn: string }> = [
  { keywords: ['pvc pipe', 'upvc', 'cpvc'], hsn: '3917' },
  { keywords: ['electrical wire', 'cable', 'wire'], hsn: '8544' },
  { keywords: ['plywood', 'block board'], hsn: '4412' },
  { keywords: ['tile', 'vitrified', 'ceramic tile'], hsn: '6907' },
  { keywords: ['tmt', 'fe500', 'fe550', 'rebar', 'reinforcement', 'steel bar', 'ms rod'], hsn: '7213' },
  { keywords: ['opc', 'ppc', 'cement'], hsn: '2523' },
  { keywords: ['river sand', 'm sand', 'msand', 'sand'], hsn: '2505' },
  { keywords: ['20mm', '40mm', '10mm', 'aggregate', 'metal', 'gitti', 'jelly'], hsn: '2517' },
  { keywords: ['fly ash brick', 'aac block', 'aac', 'brick'], hsn: '6810' },
  { keywords: ['concrete mixer', 'vibrator', 'mixer'], hsn: '8474' },
  { keywords: ['jcb', 'excavator', 'backhoe'], hsn: '8429' },
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchCatalog(name: string, catalog?: CatalogMaterialRef[]): string | null {
  if (!catalog?.length) return null;
  const n = normalize(name);
  if (!n) return null;

  const withHsn = catalog.filter((m) => m.hsnSacCode?.trim());
  const exact = withHsn.find((m) => normalize(m.name) === n);
  if (exact?.hsnSacCode) return exact.hsnSacCode.trim();

  const partial = withHsn.find((m) => {
    const mn = normalize(m.name);
    return mn.includes(n) || n.includes(mn);
  });
  return partial?.hsnSacCode?.trim() ?? null;
}

function matchKeyword(name: string): string | null {
  const n = normalize(name);
  if (!n) return null;

  for (const rule of KEYWORD_HSN_RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(kw)) return rule.hsn;
    }
  }
  return null;
}

function matchCategory(category?: string): string | null {
  if (!category || category === 'Other') return null;
  const hsn = CATEGORY_HSN_DEFAULT[category];
  return hsn || null;
}

/**
 * Suggest HSN for a material name.
 * Priority: company catalog (exact/partial) → keyword → category default.
 */
export function suggestHsn(input: {
  name: string;
  category?: string;
  catalog?: CatalogMaterialRef[];
}): HsnSuggestion | null {
  const fromCatalog = matchCatalog(input.name, input.catalog);
  if (fromCatalog) return { hsn: fromCatalog, source: 'catalog' };

  const fromKeyword = matchKeyword(input.name);
  if (fromKeyword) return { hsn: fromKeyword, source: 'keyword' };

  const fromCategory = matchCategory(input.category);
  if (fromCategory) return { hsn: fromCategory, source: 'category' };

  return null;
}

/** Suggest GST % from category when HSN was auto-filled. */
export function suggestGst(category?: string): number | null {
  if (!category) return null;
  const rate = CATEGORY_GST_DEFAULT[category];
  return rate !== undefined ? rate : null;
}

export function hsnSuggestHelperText(source: HsnSuggestSource): string {
  switch (source) {
    case 'catalog':
      return 'Suggested from your catalog - tap to change';
    case 'keyword':
      return 'Suggested from material name - tap to change';
    case 'category':
      return 'Suggested from category - tap to change';
  }
}
