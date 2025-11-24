import { Router } from 'express';
import { saveController } from '../../infrastructure/controllers/saveController';

const router = Router();

router.get('/health', saveController.healthCheck);
router.get('/api/saves', saveController.listSaves);
router.get('/api/saves/:id', saveController.getSave);
router.post('/api/saves', saveController.saveGame);
router.delete('/api/saves/:id', saveController.deleteSave);

export default router;
