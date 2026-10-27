import { Prisma } from '@prisma/client';
import type { Role } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../db/prisma';
import { conflict, notFound } from '../utils/httpError';
import { CATEGORY_LABELS } from '../utils/labels';
import type { createProductSchema, listProductsQuery, updateProductSchema } from '../validation/products.schemas';

const withLabel = <T extends { category: keyof typeof CATEGORY_LABELS }>(product: T) => ({
  ...product,
  categoryLabel: CATEGORY_LABELS[product.category],
});

function rethrowDuplicate(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw conflict('PRODUCT_EXISTS', 'מוצר בשם זה כבר קיים בקטגוריה');
  }
  throw err;
}

export async function listProducts(role: Role, query: z.infer<typeof listProductsQuery>) {
  // מתנדבת רואה תמיד רק מוצרים פעילים. מנהלת יכולה לבקש גם מושבתים
  const includeInactive = role === 'ADMIN' && query.includeInactive;
  const products = await prisma.product.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return products.map(withLabel);
}

export async function createProduct(data: z.infer<typeof createProductSchema>) {
  const product = await prisma.product.create({ data }).catch(rethrowDuplicate);
  return withLabel(product);
}

export async function updateProduct(id: number, data: z.infer<typeof updateProductSchema>) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('PRODUCT_NOT_FOUND', 'המוצר לא נמצא');
  const product = await prisma.product.update({ where: { id }, data }).catch(rethrowDuplicate);
  return withLabel(product);
}

/** "מחיקה" = השבתה. מוצר מושבת לא מוצג לבחירה, אבל נשאר בשיבוצים קודמים */
export async function deactivateProduct(id: number) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('PRODUCT_NOT_FOUND', 'המוצר לא נמצא');
  const product = await prisma.product.update({ where: { id }, data: { isActive: false } });
  return withLabel(product);
}
