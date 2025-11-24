import { Router } from 'express';
import { worldController } from '../controllers/worldController.js';

const router = Router();

router.post('/api/world/chunk', worldController.generateChunk);

export default router;
