/**
 * Ice cream manufacturer - production batches (consume raw → produce finished).
 */
import { ApiError } from '../utils/errors';
import { prisma } from '../lib/prisma';
import { assertInventoryFeature, getDefaultProjectId } from './module-gate.service';
import { applyBatchIn, allocateBatchOut, isBatchTracked } from './stock-batch.service';
import { getRecipe } from './recipe.service';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function listProductionBatches(companyId: string) {
  await assertInventoryFeature(companyId, 'production_batches');
  return prisma.productionBatch.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      recipe: {
        select: {
          id: true,
          name: true,
          outputQty: true,
          outputResource: { select: { id: true, name: true, unit: true } },
        },
      },
      location: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function createProductionBatch(
  companyId: string,
  userId: string,
  input: {
    recipeId: string;
    locationId?: string;
    outputQty: number;
    batchCode: string;
    manufacturedAt?: Date;
    expiresAt?: Date;
    notes?: string;
  },
) {
  await assertInventoryFeature(companyId, 'production_batches');
  const recipe = await getRecipe(companyId, input.recipeId);
  if (!recipe.isActive) throw ApiError.badRequest('Recipe is inactive');

  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Production is only available on Inventory plan');

  const location = input.locationId
    ? await prisma.stockLocation.findFirst({
        where: { id: input.locationId, companyId, isActive: true },
      })
    : await prisma.stockLocation.findFirst({
        where: { companyId, isDefault: true, isActive: true },
      });
  if (!location) throw ApiError.notFound('Warehouse location not found');

  return prisma.productionBatch.create({
    data: {
      companyId,
      recipeId: recipe.id,
      locationId: location.id,
      outputQty: input.outputQty,
      batchCode: input.batchCode.trim(),
      manufacturedAt: input.manufacturedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes?.trim() || null,
      createdBy: userId,
      status: 'DRAFT',
    },
    include: {
      recipe: {
        select: {
          id: true,
          name: true,
          outputQty: true,
          outputResource: { select: { id: true, name: true, unit: true } },
        },
      },
      location: { select: { id: true, name: true, code: true } },
    },
  });
}

/**
 * Complete a draft production batch: consume recipe inputs, produce finished goods.
 */
export async function completeProductionBatch(companyId: string, id: string) {
  await assertInventoryFeature(companyId, 'production_batches');
  const batch = await prisma.productionBatch.findFirst({
    where: { id, companyId },
    include: {
      recipe: {
        include: {
          outputResource: true,
          lines: { include: { inputResource: true } },
        },
      },
    },
  });
  if (!batch) throw ApiError.notFound('Production batch not found');
  if (batch.status !== 'DRAFT') throw ApiError.badRequest('Only draft batches can be completed');

  const recipeOut = Number(batch.recipe.outputQty);
  const scale = Number(batch.outputQty) / (recipeOut || 1);

  return prisma.$transaction(async (tx) => {
    // Consume inputs
    for (const line of batch.recipe.lines) {
      const need = round3(Number(line.quantity) * scale);
      if (need <= 0) continue;
      const resource = line.inputResource;
      const balance = await tx.stockBalance.findUnique({
        where: {
          locationId_resourceId: {
            locationId: batch.locationId,
            resourceId: resource.id,
          },
        },
      });
      const onHand = balance ? Number(balance.quantity) : 0;
      if (onHand + 1e-9 < need) {
        throw ApiError.unprocessable(
          `Insufficient ${resource.name}: need ${need} ${resource.unit}, have ${onHand}`,
        );
      }

      const tracked = isBatchTracked(resource.trackingMode);
      if (tracked) {
        await allocateBatchOut(tx, {
          locationId: batch.locationId,
          resourceId: resource.id,
          resourceName: resource.name,
          unit: resource.unit,
          quantity: need,
        });
      }

      await tx.stockMovement.create({
        data: {
          locationId: batch.locationId,
          resourceId: resource.id,
          quantity: need,
          type: 'OUT',
          referenceType: 'PRODUCTION_BATCH',
          referenceId: batch.id,
          reason: 'PRODUCTION_CONSUME',
          notes: `Production ${batch.batchCode}`,
          unitCost: Number(resource.avgCost ?? 0),
          inventoryValue: round2(Number(resource.avgCost ?? 0) * need),
        },
      });
      await tx.stockBalance.update({
        where: { id: balance!.id },
        data: { quantity: round3(onHand - need) },
      });
    }

    // Produce finished goods (enable lot tracking when mfg/expiry provided)
    const outRes = batch.recipe.outputResource;
    const produced = round3(Number(batch.outputQty));
    const wantLots = Boolean(batch.manufacturedAt || batch.expiresAt);
    if (wantLots && outRes.trackingMode === 'NONE') {
      await tx.resource.update({
        where: { id: outRes.id },
        data: { trackingMode: 'BATCH_EXPIRY' },
      });
    }
    const trackedOut = wantLots || isBatchTracked(outRes.trackingMode);
    if (trackedOut) {
      await applyBatchIn(tx, {
        locationId: batch.locationId,
        resourceId: outRes.id,
        batchCode: batch.batchCode,
        quantity: produced,
        manufacturedAt: batch.manufacturedAt,
        expiresAt: batch.expiresAt,
      });
    }
    await tx.stockMovement.create({
      data: {
        locationId: batch.locationId,
        resourceId: outRes.id,
        quantity: produced,
        type: 'IN',
        referenceType: 'PRODUCTION_BATCH',
        referenceId: batch.id,
        reason: 'PRODUCTION_OUTPUT',
        notes: `Production ${batch.batchCode}`,
        unitCost: Number(outRes.avgCost ?? 0),
        inventoryValue: round2(Number(outRes.avgCost ?? 0) * produced),
        batchCode: trackedOut ? batch.batchCode : null,
      },
    });
    const outBalance = await tx.stockBalance.findUnique({
      where: {
        locationId_resourceId: {
          locationId: batch.locationId,
          resourceId: outRes.id,
        },
      },
    });
    if (!outBalance) {
      await tx.stockBalance.create({
        data: {
          locationId: batch.locationId,
          resourceId: outRes.id,
          quantity: produced,
        },
      });
    } else {
      await tx.stockBalance.update({
        where: { id: outBalance.id },
        data: { quantity: round3(Number(outBalance.quantity) + produced) },
      });
    }

    return tx.productionBatch.update({
      where: { id: batch.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            outputQty: true,
            outputResource: { select: { id: true, name: true, unit: true } },
          },
        },
        location: { select: { id: true, name: true, code: true } },
      },
    });
  });
}

export async function cancelProductionBatch(companyId: string, id: string) {
  await assertInventoryFeature(companyId, 'production_batches');
  const batch = await prisma.productionBatch.findFirst({ where: { id, companyId } });
  if (!batch) throw ApiError.notFound('Production batch not found');
  if (batch.status !== 'DRAFT') throw ApiError.badRequest('Only draft batches can be cancelled');
  return prisma.productionBatch.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}
