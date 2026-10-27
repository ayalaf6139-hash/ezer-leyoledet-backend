import { Router } from 'express';
import * as products from '../controllers/products.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

export const productsRoutes = Router();

productsRoutes.use(authenticate);

productsRoutes.get('/', products.list);
productsRoutes.post('/', requireAdmin, products.create);
productsRoutes.put('/:id', requireAdmin, products.update);
productsRoutes.delete('/:id', requireAdmin, products.deactivate);
