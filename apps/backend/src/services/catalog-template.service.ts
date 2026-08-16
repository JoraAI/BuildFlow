/**
 * BuildFlow - Catalog template service
 * (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.1, K1–K4).
 *
 * Vertical starter catalogs are tenant-owned: applying a template COPIES rows
 * into the company's `Resource` table (type MATERIAL) with
 * `itemCode = templateKey` (stable + searchable). Re-apply / "add missing" is
 * INSERT-ONLY - an existing row is matched by `itemCode` (preferred) or name
 * and skipped, so tenant edits (rate/GST/HSN/barcode/reorder/name) are never
 * overwritten (K3).
 */
import { InventoryBusinessProfile, InventoryVertical, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import {
  KIRANA_TEMPLATE,
  KIRANA_TEMPLATE_VERSION,
  KIRANA_MRP_AS_OF,
  KIRANA_MRP_SOURCE,
  groupKiranaTemplateByCategory,
  suggestedIndianMrp,
  type KiranaTemplateItem,
} from '../catalog-data/kirana-catalog-data';
import { getDefaultProjectId } from './module-gate.service';
import { getOrCreateProjectStockLocation } from './procurement.service';
import { applyBatchIn } from './stock-batch.service';
import { invalidatePattern } from '../utils/cache';

interface TemplateDef {
  items: readonly KiranaTemplateItem[];
  version: string;
}

/** Only Kirana currently has a catalog; other verticals classify the shop only. */
const TEMPLATES: Partial<Record<InventoryVertical, TemplateDef>> = {
  [InventoryVertical.KIRANA]: {
    items: KIRANA_TEMPLATE,
    version: KIRANA_TEMPLATE_VERSION,
  },
};

/**
 * K2 (11.1.5b): which business profiles may OPT INTO a vertical via the OWNER
 * picker. This is the only place the profile matters - once `inventoryVertical`
 * is set, preview/apply are gated on the vertical alone (hardware retail /
 * stationery wholesale without the KIRANA vertical never see the pack).
 */
const VERTICAL_OPT_IN_PROFILES: readonly InventoryBusinessProfile[] = [
  InventoryBusinessProfile.RETAIL,
  InventoryBusinessProfile.WHOLESALE,
];

export interface CatalogPreview {
  template: InventoryVertical;
  version: string;
  categories: Array<{ category: string; itemCount: number }>;
  totalItems: number;
  /** Rows already present in this company's Resource table (matched by key/name). */
  alreadyApplied: number;
  /** When the company last applied this vertical (null if never applied). */
  appliedAt: Date | null;
  eligible: boolean;
  /** Reason when not eligible (403/422-level), else null. */
  ineligibilityReason: string | null;
}

export interface CatalogApplyResult {
  template: InventoryVertical;
  version: string;
  /** Rows newly inserted on this call. */
  created: number;
  /** Soft-deleted template rows brought back on this call (unique-key safe). */
  restored: number;
  /** Rows skipped because an existing active Resource matched (key or name). */
  skipped: number;
  inventoryVertical: InventoryVertical;
  catalogSeededAt: Date | null;
}

export interface CatalogLibraryItem extends KiranaTemplateItem {
  suggestedMrp: number;
  mrpAsOf: string;
  priceSource: string;
  imported: boolean;
  resourceId: string | null;
}

export async function listCatalogLibrary(
  companyId: string,
  input: { search?: string; category?: string; page: number; limit: number },
) {
  const company = await loadCompanyMeta(companyId);
  const reason = eligibilityReason(company, InventoryVertical.KIRANA);
  if (reason) throw ApiError.forbidden(reason);

  const q = input.search?.trim().toLowerCase();
  const filtered = KIRANA_TEMPLATE.filter((item) => {
    if (input.category && item.category !== input.category) return false;
    if (!q) return true;
    return [item.templateKey, item.name, item.category, item.packSize, item.unit, item.hsn]
      .some((value) => value.toLowerCase().includes(q));
  });
  const pageItems = filtered.slice((input.page - 1) * input.limit, input.page * input.limit);
  const keys = pageItems.map((item) => item.templateKey);
  const existing = keys.length
    ? await prisma.resource.findMany({
        where: { companyId, itemCode: { in: keys }, isDeleted: false },
        select: { id: true, itemCode: true },
      })
    : [];
  const resourceByKey = new Map(existing.map((row) => [row.itemCode, row.id]));
  const items: CatalogLibraryItem[] = pageItems.map((item) => ({
    ...item,
    suggestedMrp: suggestedIndianMrp(item),
    mrpAsOf: KIRANA_MRP_AS_OF,
    priceSource: KIRANA_MRP_SOURCE,
    imported: resourceByKey.has(item.templateKey),
    resourceId: resourceByKey.get(item.templateKey) ?? null,
  }));
  return { items, total: filtered.length, page: input.page, limit: input.limit };
}

export interface SelectedCatalogStockItem {
  templateKey?: string;
  custom?: {
    name: string;
    sku: string;
    unit: string;
    category?: string;
    gstRate: number;
    hsn?: string;
  };
  mrp: number;
  rate: number;
  quantity: number;
  barcode?: string;
  batchCode?: string;
  manufacturedAt?: Date;
  expiresAt?: Date;
}

export type SelectedCatalogMasterItem = Pick<
  SelectedCatalogStockItem,
  'templateKey' | 'custom' | 'mrp' | 'rate' | 'barcode'
>;

/** Copy selected products into the tenant item master without changing stock. */
export async function importCatalogItems(
  companyId: string,
  userId: string,
  input: { items: SelectedCatalogMasterItem[] },
) {
  const company = await loadCompanyMeta(companyId);
  const reason = eligibilityReason(company, InventoryVertical.KIRANA);
  if (reason) throw ApiError.forbidden(reason);
  const templateByKey = new Map(KIRANA_TEMPLATE.map((item) => [item.templateKey, item]));

  const imported = await prisma.$transaction(async (tx) => {
    const rows: Array<{ resourceId: string; key: string; created: boolean }> = [];
    for (const selected of input.items) {
      const templateItem = selected.templateKey ? templateByKey.get(selected.templateKey) : undefined;
      if (selected.templateKey && !templateItem) {
        throw ApiError.badRequest(`Unknown Kirana product: ${selected.templateKey}`);
      }
      if (!templateItem && !selected.custom) {
        throw ApiError.badRequest('Library product or custom item details are required.');
      }
      const item = templateItem ?? {
        templateKey: `CUSTOM:${selected.custom!.sku}`,
        name: selected.custom!.name,
        category: selected.custom!.category ?? 'Custom',
        unit: selected.custom!.unit,
        hsn: selected.custom!.hsn ?? '',
        gstRate: selected.custom!.gstRate,
        reorderPoint: 0,
      };
      let resource = await tx.resource.findFirst({
        where: {
          companyId,
          OR: [
            ...(templateItem ? [{ itemCode: item.templateKey }] : [{ sku: selected.custom!.sku }]),
            { name: item.name, type: 'MATERIAL' },
          ],
        },
      });
      const created = !resource;
      const oldRate = resource ? Number(resource.rate) : null;
      if (resource) {
        resource = await tx.resource.update({
          where: { id: resource.id },
          data: {
            isDeleted: false,
            isActive: true,
            mrp: selected.mrp,
            mrpUpdatedAt: new Date(),
            rate: selected.rate,
            lastRateUpdatedAt: new Date(),
            trackingMode: 'BATCH_EXPIRY',
            ...(selected.barcode?.trim() ? { barcode: selected.barcode.trim() } : {}),
          },
        });
      } else {
        resource = await tx.resource.create({
          data: {
            companyId,
            name: item.name,
            type: 'MATERIAL',
            unit: item.unit,
            category: item.category,
            hsnSacCode: item.hsn || null,
            gstRate: item.gstRate,
            reorderPoint: item.reorderPoint,
            itemCode: templateItem ? item.templateKey : null,
            sku: templateItem ? null : selected.custom!.sku,
            barcode: selected.barcode?.trim() || null,
            mrp: selected.mrp,
            mrpUpdatedAt: new Date(),
            rate: selected.rate,
            lastRateUpdatedAt: new Date(),
            trackingMode: 'BATCH_EXPIRY',
          },
        });
      }
      if (created || oldRate !== selected.rate) {
        await tx.materialPriceHistory.create({
          data: {
            companyId,
            resourceId: resource.id,
            rate: selected.rate,
            effectiveDate: new Date(),
            notes: created ? 'Initial item-master selling price' : 'Selling price updated during item import',
            recordedBy: userId,
          },
        });
      }
      rows.push({
        resourceId: resource.id,
        key: templateItem ? item.templateKey : selected.custom!.sku,
        created,
      });
    }
    return rows;
  }, { maxWait: 10_000, timeout: 60_000 });

  await invalidatePattern(`cache:${companyId}:resources:*`);
  return { imported };
}

/**
 * Copy selected library SKUs and add stock in one transaction. Existing
 * tenant-owned resources retain their catalog fields; only explicit MRP/rate
 * values from this intake are applied.
 */
export async function importSelectedCatalogStock(
  companyId: string,
  userId: string,
  input: { items: SelectedCatalogStockItem[]; locationId?: string },
) {
  const company = await loadCompanyMeta(companyId);
  const reason = eligibilityReason(company, InventoryVertical.KIRANA);
  if (reason) throw ApiError.forbidden(reason);
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('No inventory store is configured.');
  const templateByKey = new Map(KIRANA_TEMPLATE.map((item) => [item.templateKey, item]));

  const result = await prisma.$transaction(async (tx) => {
    const location = await getOrCreateProjectStockLocation(companyId, projectId, tx, {
      locationId: input.locationId,
    });
    const imported: Array<{ resourceId: string; templateKey: string; quantity: number; created: boolean }> = [];

    for (const selected of input.items) {
      const templateItem = selected.templateKey ? templateByKey.get(selected.templateKey) : undefined;
      if (selected.templateKey && !templateItem) {
        throw ApiError.badRequest(`Unknown Kirana SKU: ${selected.templateKey}`);
      }
      if (!templateItem && !selected.custom) {
        throw ApiError.badRequest('Library SKU or custom SKU details are required.');
      }
      const item = templateItem ?? {
        templateKey: `CUSTOM:${selected.custom!.sku}`,
        name: selected.custom!.name,
        category: selected.custom!.category ?? 'Custom',
        packSize: selected.custom!.unit,
        unit: selected.custom!.unit,
        hsn: selected.custom!.hsn ?? '',
        gstRate: selected.custom!.gstRate,
        reorderPoint: 0,
      };
      let resource = await tx.resource.findFirst({
        where: {
          companyId,
          OR: [
            ...(templateItem ? [{ itemCode: item.templateKey }] : [{ sku: selected.custom!.sku }]),
            { name: item.name, type: 'MATERIAL' },
          ],
        },
      });
      const created = !resource;
      if (!resource) {
        resource = await tx.resource.create({
          data: {
            companyId,
            name: item.name,
            type: 'MATERIAL',
            unit: item.unit,
            category: item.category,
            hsnSacCode: item.hsn,
            gstRate: item.gstRate,
            reorderPoint: item.reorderPoint,
            itemCode: templateItem ? item.templateKey : null,
            sku: templateItem ? null : selected.custom!.sku,
            barcode: selected.barcode?.trim() || null,
            mrp: selected.mrp,
            mrpUpdatedAt: new Date(),
            rate: selected.rate,
            lastRateUpdatedAt: new Date(),
            trackingMode: 'BATCH_EXPIRY',
          },
        });
        await tx.materialPriceHistory.create({
          data: {
            companyId,
            resourceId: resource.id,
            rate: selected.rate,
            effectiveDate: new Date(),
            notes: `Initial rate from ${templateItem ? item.templateKey : 'custom SKU'} intake`,
            recordedBy: userId,
          },
        });
      } else {
        const oldRate = Number(resource.rate);
        const [currentBalance, batchCount] = await Promise.all([
          tx.stockBalance.findUnique({
            where: { locationId_resourceId: { locationId: location.id, resourceId: resource.id } },
          }),
          tx.stockBatchBalance.count({
            where: { locationId: location.id, resourceId: resource.id },
          }),
        ]);
        resource = await tx.resource.update({
          where: { id: resource.id },
          data: {
            mrp: selected.mrp,
            mrpUpdatedAt: new Date(),
            rate: selected.rate,
            lastRateUpdatedAt: new Date(),
            trackingMode: 'BATCH_EXPIRY',
            ...(selected.barcode?.trim() ? { barcode: selected.barcode.trim() } : {}),
          },
        });
        // Existing pre-11.5 aggregate stock becomes a null-dated legacy lot
        // before the item starts FEFO tracking.
        if (batchCount === 0 && Number(currentBalance?.quantity ?? 0) > 0) {
          await applyBatchIn(tx, {
            locationId: location.id,
            resourceId: resource.id,
            batchCode: 'LEGACY',
            quantity: Number(currentBalance!.quantity),
          });
        }
        if (oldRate !== selected.rate) {
          await tx.materialPriceHistory.create({
            data: {
              companyId,
              resourceId: resource.id,
              rate: selected.rate,
              effectiveDate: new Date(),
              notes: `Rate reviewed during ${templateItem ? item.templateKey : 'custom SKU'} intake`,
              recordedBy: userId,
            },
          });
        }
      }

      const batchCode =
        selected.batchCode?.trim() ||
        `OPEN-${Date.now()}-${templateItem ? item.templateKey : selected.custom!.sku}`;
      await applyBatchIn(tx, {
        locationId: location.id,
        resourceId: resource.id,
        batchCode,
        quantity: selected.quantity,
        manufacturedAt: selected.manufacturedAt ?? null,
        expiresAt: selected.expiresAt ?? null,
      });
      await tx.stockBalance.upsert({
        where: { locationId_resourceId: { locationId: location.id, resourceId: resource.id } },
        create: { locationId: location.id, resourceId: resource.id, quantity: selected.quantity },
        update: { quantity: { increment: selected.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          locationId: location.id,
          resourceId: resource.id,
          quantity: selected.quantity,
          type: 'ADJUST',
          referenceType: templateItem ? 'SKU_LIBRARY_INTAKE' : 'CUSTOM_SKU_INTAKE',
          reason: 'OPENING_STOCK',
          notes: templateItem ? 'Added from Kirana SKU library' : 'Custom SKU created with stock',
          batchCode,
          unitCost: 0,
          inventoryValue: 0,
        },
      });
      imported.push({
        resourceId: resource.id,
        templateKey: templateItem ? item.templateKey : selected.custom!.sku,
        quantity: selected.quantity,
        created,
      });
    }
    return { imported, locationId: location.id };
  }, {
    // A multi-SKU intake performs resource, history, lot, balance and movement
    // writes per row. Remote dev/prod databases can exceed Prisma's 5s default.
    maxWait: 10_000,
    timeout: 60_000,
  });

  await invalidatePattern(`cache:${companyId}:resources:*`);
  return result;
}

/** Shared guard: verticals are an INVENTORY-plan concept (K2: vertical-gated). */
type CompanyMeta = {
  subscriptionPlan: string;
  inventoryProfile: InventoryBusinessProfile | null;
  inventoryVertical: InventoryVertical | null;
  catalogSeededAt: Date | null;
};

async function resolveDef(template: InventoryVertical): Promise<TemplateDef> {
  const def = TEMPLATES[template];
  if (!def) throw ApiError.badRequest(`Unknown catalog template: ${template}`);
  return def;
}

async function loadCompanyMeta(companyId: string): Promise<CompanyMeta> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionPlan: true,
      inventoryProfile: true,
      inventoryVertical: true,
      catalogSeededAt: true,
    },
  });
  if (!company) throw ApiError.notFound('Company not found');
  return company;
}

/** Returns the ineligibility reason (null = eligible) without throwing. */
function eligibilityReason(
  company: CompanyMeta,
  template: InventoryVertical,
): string | null {
  if (company.subscriptionPlan !== 'INVENTORY') {
    return 'Catalog templates are available on the Inventory plan.';
  }
  // K2 (11.1.5b): the pack is Kirana-VERTICAL-only. A mere RETAIL / WHOLESALE
  // profile is NOT enough - the OWNER must first opt into the vertical via the
  // Settings picker (hardware retail / stationery wholesale stay excluded).
  if (company.inventoryVertical !== template) {
    return `The ${template} starter catalog is only available after you enable the ${template} vertical (Settings → Shop vertical).`;
  }
  return null;
}

export async function previewCatalogTemplate(
  companyId: string,
  template: InventoryVertical,
): Promise<CatalogPreview> {
  const def = await resolveDef(template);
  const company = await loadCompanyMeta(companyId);
  const reason = eligibilityReason(company, template);

  let alreadyApplied = 0;
  let appliedAt: Date | null = null;
  if (!reason) {
    const templateKeys = def.items.map((i) => i.templateKey);
    const templateNames = def.items.map((i) => i.name);
    const existing = await prisma.resource.findMany({
      where: {
        companyId,
        type: 'MATERIAL',
        isDeleted: false,
        OR: [{ itemCode: { in: templateKeys } }, { name: { in: templateNames } }],
      },
      select: { itemCode: true },
    });
    alreadyApplied = existing.length;
    appliedAt = company.inventoryVertical === template ? company.catalogSeededAt : null;
  }

  return {
    template,
    version: def.version,
    categories: groupKiranaTemplateByCategory(),
    totalItems: def.items.length,
    alreadyApplied,
    appliedAt,
    eligible: reason === null,
    ineligibilityReason: reason,
  };
}

/**
 * Insert-missing application of a vertical starter catalog.
 *
 * - Requires INVENTORY plan + `inventoryVertical === template` (K2).
 * - Skips any row already present under the same `itemCode` (or exact name) -
 *   tenant edits are preserved (K3); deleting a row makes it eligible again.
 * - Stamps `inventoryVertical` + `catalogSeededAt` once (first apply).
 * - Never writes prices (`rate: 0`), opening quantities, or barcodes (K4).
 */
export async function applyCatalogTemplate(
  companyId: string,
  template: InventoryVertical,
): Promise<CatalogApplyResult> {
  const def = await resolveDef(template);
  const company = await loadCompanyMeta(companyId);
  const reason = eligibilityReason(company, template);
  if (reason) {
    throw ApiError.unprocessable(reason);
  }

  const keys = def.items.map((i) => i.templateKey);
  const names = def.items.map((i) => i.name);
  // Match against ALL rows (incl. soft-deleted) - Resource has a unique
  // (companyId, name, type) constraint, so a deleted template row is RESTORED
  // rather than re-inserted (otherwise the unique key would collide).
  const existing = await prisma.resource.findMany({
    where: {
      companyId,
      type: 'MATERIAL',
      OR: [{ itemCode: { in: keys } }, { name: { in: names } }],
    },
    select: { id: true, itemCode: true, name: true, isDeleted: true },
  });
  const existingKeys = new Set(existing.map((e) => e.itemCode));
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

  // Soft-deleted template rows are brought back (tenant "deleted" = missing).
  const toRestore = existing.filter((e) => e.isDeleted);
  if (toRestore.length > 0) {
    await prisma.resource.updateMany({
      where: { id: { in: toRestore.map((r) => r.id) } },
      data: { isDeleted: false },
    });
  }

  const toInsert = def.items.filter(
    (i) => !existingKeys.has(i.templateKey) && !existingNames.has(i.name.toLowerCase()),
  );

  if (toInsert.length > 0) {
    const rows: Prisma.ResourceCreateManyInput[] = toInsert.map((item) => ({
      companyId,
      name: item.name,
      type: 'MATERIAL',
      unit: item.unit,
      category: item.category,
      hsnSacCode: item.hsn,
      gstRate: item.gstRate,
      reorderPoint: item.reorderPoint,
      itemCode: item.templateKey,
      rate: 0, // K4: price is tenant-set, never templated.
    }));
    await prisma.resource.createMany({ data: rows });
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      inventoryVertical: template,
      catalogSeededAt: company.catalogSeededAt ?? new Date(),
    },
    select: { inventoryVertical: true, catalogSeededAt: true },
  });

  return {
    template,
    version: def.version,
    created: toInsert.length,
    restored: toRestore.length,
    skipped: def.items.length - toInsert.length - toRestore.length,
    inventoryVertical: updated.inventoryVertical ?? template,
    catalogSeededAt: updated.catalogSeededAt,
  };
}

/**
 * OWNER-only selection of a shop vertical.
 *
 * Only RETAIL / WHOLESALE profiles may enable a vertical. Kirana additionally
 * unlocks its starter catalog; other verticals are classification-only for now.
 *
 * Clearing the vertical (null) hides the pack but keeps the copied rows - they
 * are tenant-owned once applied (K3); re-opt-in shows them as already applied.
 */
export async function setInventoryVertical(
  companyId: string,
  vertical: InventoryVertical | null,
): Promise<{ inventoryVertical: InventoryVertical | null; catalogSeededAt: Date | null }> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      subscriptionPlan: true,
      inventoryProfile: true,
      inventoryVertical: true,
      catalogSeededAt: true,
    },
  });
  if (company.subscriptionPlan !== 'INVENTORY') {
    throw ApiError.unprocessable('Shop verticals are available on the Inventory plan.');
  }
  if (vertical !== null) {
    if (!company.inventoryProfile || !VERTICAL_OPT_IN_PROFILES.includes(company.inventoryProfile)) {
      throw ApiError.unprocessable(
        `The ${vertical} vertical is only available to RETAIL / WHOLESALE tenants. Change your business profile first (Settings → Business profile).`,
      );
    }
  }
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { inventoryVertical: vertical },
    select: { inventoryVertical: true, catalogSeededAt: true },
  });
  return updated;
}

