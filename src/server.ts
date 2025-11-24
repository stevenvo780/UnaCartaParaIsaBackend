import { WebSocketServer, WebSocket } from 'ws';
import app from './app.js';
import { CONFIG } from './config/config.js';
import { simulationRunner } from './simulation/index.js';
import type { SimulationCommand } from './simulation/types.js';

const server = app.listen(CONFIG.PORT, () => {
  console.log(`🎮 Save server running on http://localhost:${CONFIG.PORT}`);
  if (!CONFIG.USE_LOCAL_STORAGE) {
    console.log(`☁️  Using GCS bucket: ${CONFIG.BUCKET_NAME}`);
  } else {
    console.log(`📁 Using local storage: ${CONFIG.LOCAL_SAVES_PATH}`);
  }
});

// WebSocket Setup
const wss = new WebSocketServer({ server, path: '/ws/sim' });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected to simulation');

  // Send initial state
  ws.send(JSON.stringify({
    type: 'SNAPSHOT',
    payload: simulationRunner.getSnapshot()
  }));

  ws.on('message', (data: string) => {
    try {
      const command = JSON.parse(data.toString()) as SimulationCommand;
      const accepted = simulationRunner.enqueueCommand(command);
      if (!accepted) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Command queue full' }));
      }
    } catch (err) {
      console.error('Failed to parse command:', err);
    }
  });
});

// Broadcast ticks
simulationRunner.on('tick', (snapshot) => {
  const message = JSON.stringify({
    type: 'TICK',
    payload: snapshot
  });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});
