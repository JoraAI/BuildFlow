/**
 * Ice cream manufacturer - recipes (BOM) service.
 */
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors';
import { prisma } from '../lib/prisma';
import { assertInventoryFeature } from './module-gate.service';

export async function listRecipes(companyId: string) {
  await assertInventoryFeature(companyId, 'recipes');
  return prisma.recipe.findMany({
    where: { companyId },
    orderBy: { updatedAt: 'desc' },
    include: {
      outputResource: { select: { id: true, name: true, unit: true, sku: true } },
      lines: {
        include: {
          inputResource: { select: { id: true, name: true, unit: true, sku: true } },
        },
      },
    },
  });
}

export async function getRecipe(companyId: string, id: string) {
  await assertInventoryFeature(companyId, 'recipes');
  const recipe = await prisma.recipe.findFirst({
    where: { id, companyId },
    include: {
      outputResource: { select: { id: true, name: true, unit: true, sku: true } },
      lines: {
        include: {
          inputResource: { select: { id: true, name: true, unit: true, sku: true } },
        },
      },
    },
  });
  if (!recipe) throw ApiError.notFound('Recipe not found');
  return recipe;
}

export async function createRecipe(
  companyId: string,
  input: {
    name: string;
    outputResourceId: string;
    outputQty: number;
    notes?: string;
    lines: Array<{ inputResourceId: string; quantity: number }>;
  },
) {
  await assertInventoryFeature(companyId, 'recipes');
  await assertResources(companyId, [
    input.outputResourceId,
    ...input.lines.map((l) => l.inputResourceId),
  ]);
  if (input.lines.some((l) => l.inputResourceId === input.outputResourceId)) {
    throw ApiError.badRequest('Output item cannot also be an input ingredient');
  }

  return prisma.recipe.create({
    data: {
      companyId,
      name: input.name.trim(),
      outputResourceId: input.outputResourceId,
      outputQty: input.outputQty,
      notes: input.notes?.trim() || null,
      lines: {
        create: input.lines.map((l) => ({
          inputResourceId: l.inputResourceId,
          quantity: l.quantity,
        })),
      },
    },
    include: {
      outputResource: { select: { id: true, name: true, unit: true, sku: true } },
      lines: {
        include: {
          inputResource: { select: { id: true, name: true, unit: true, sku: true } },
        },
      },
    },
  });
}

export async function updateRecipe(
  companyId: string,
  id: string,
  input: {
    name?: string;
    outputResourceId?: string;
    outputQty?: number;
    notes?: string | null;
    isActive?: boolean;
    lines?: Array<{ inputResourceId: string; quantity: number }>;
  },
) {
  await assertInventoryFeature(companyId, 'recipes');
  const existing = await getRecipe(companyId, id);
  if (input.outputResourceId || input.lines) {
    await assertResources(companyId, [
      input.outputResourceId ?? existing.outputResourceId,
      ...(input.lines ?? existing.lines).map((l) =>
        'inputResourceId' in l ? l.inputResourceId : (l as { inputResourceId: string }).inputResourceId,
      ),
    ]);
  }

  return prisma.$transaction(async (tx) => {
    if (input.lines) {
      await tx.recipeLine.deleteMany({ where: { recipeId: id } });
      await tx.recipeLine.createMany({
        data: input.lines.map((l) => ({
          recipeId: id,
          inputResourceId: l.inputResourceId,
          quantity: l.quantity,
        })),
      });
    }
    return tx.recipe.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        outputResourceId: input.outputResourceId,
        outputQty: input.outputQty,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        isActive: input.isActive,
      },
      include: {
        outputResource: { select: { id: true, name: true, unit: true, sku: true } },
        lines: {
          include: {
            inputResource: { select: { id: true, name: true, unit: true, sku: true } },
          },
        },
      },
    });
  });
}

async function assertResources(companyId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await prisma.resource.count({
    where: { companyId, id: { in: unique }, isDeleted: false },
  });
  if (found !== unique.length) throw ApiError.notFound('One or more items were not found');
}

export type RecipeWithLines = Prisma.RecipeGetPayload<{
  include: {
    outputResource: { select: { id: true; name: true; unit: true; sku: true } };
    lines: {
      include: { inputResource: { select: { id: true; name: true; unit: true; sku: true } } };
    };
  };
}>;
