import { Router } from 'express';
import { worldController } from '@/infrastructure/controllers/worldController';

const router = Router();

router.post('/api/world/chunk', worldController.generateChunk);

export default router;
