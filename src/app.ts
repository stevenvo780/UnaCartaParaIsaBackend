import express from 'express';
import cors from 'cors';
import saveRoutes from './routes/saveRoutes.js';
import worldRoutes from './routes/worldRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/', saveRoutes);
app.use('/', worldRoutes);
app.use('/', simulationRoutes);

export default app;
