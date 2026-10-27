import { Router } from 'express';
import * as families from '../controllers/families.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

export const familiesRoutes = Router();

// כל הנתיבים של משפחות – מנהלת בלבד (פרטי המשפחות פרטיים)
familiesRoutes.use(authenticate, requireAdmin);

familiesRoutes.get('/', families.list);
familiesRoutes.post('/', families.create);
familiesRoutes.get('/:id', families.getById);
familiesRoutes.put('/:id', families.update);
familiesRoutes.delete('/:id', families.finish);
