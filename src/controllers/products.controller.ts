import type { Request, Response } from 'express';
import * as productsService from '../services/products.service';
import { currentUser } from '../middleware/auth';
import { idParam } from '../validation/common';
import { createProductSchema, listProductsQuery, updateProductSchema } from '../validation/products.schemas';

export async function list(req: Request, res: Response) {
  res.json(await productsService.listProducts(currentUser(req).role, listProductsQuery.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await productsService.createProduct(createProductSchema.parse(req.body)));
}

export async function update(req: Request, res: Response) {
  res.json(await productsService.updateProduct(idParam.parse(req.params).id, updateProductSchema.parse(req.body)));
}

export async function deactivate(req: Request, res: Response) {
  res.json(await productsService.deactivateProduct(idParam.parse(req.params).id));
}
