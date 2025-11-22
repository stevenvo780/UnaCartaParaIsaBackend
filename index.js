import express from 'express';
import cors from 'cors';
import { Storage } from '@google-cloud/storage';
import SftpClient from 'ssh2-sftp-client';

const app = express();
const PORT = process.env.PORT || 8080;
const BUCKET_NAME = process.env.BUCKET_NAME || 'una-carta-para-isa-saves';
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'emergent-enterprises';

// Configuración NAS (solo funciona en entorno local)
const NAS_ENABLED = process.env.NAS_ENABLED === 'true';
const NAS_CONFIG = {
  host: process.env.NAS_HOST || '192.168.1.12',
  port: 22,
  username: process.env.NAS_USER || 'nass',
  password: process.env.NAS_PASSWORD || 'MiutHuheCAp9',
  backupPath: process.env.NAS_PATH || '/mnt/raid10/backups/una-carta-para-isa'
};

// Inicializar Cloud Storage
const storage = new Storage({
  projectId: PROJECT_ID,
});
const bucket = storage.bucket(BUCKET_NAME);

// Función para backup en NAS
async function backupToNAS(saveId, content) {
  const sftp = new SftpClient();
  try {
    await sftp.connect(NAS_CONFIG);

    // Crear directorio si no existe
    const dirExists = await sftp.exists(NAS_CONFIG.backupPath);
    if (!dirExists) {
      await sftp.mkdir(NAS_CONFIG.backupPath, true);
    }

    const remotePath = `${NAS_CONFIG.backupPath}/${saveId}.json`;
    await sftp.put(Buffer.from(content), remotePath);

    console.log(`📦 Backup to NAS: ${remotePath}`);
    return true;
  } catch (error) {
    console.error('NAS backup failed:', error.message);
    return false;
  } finally {
    await sftp.end();
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión con el bucket
    await bucket.exists();
    res.json({ status: 'ok', timestamp: Date.now(), storage: 'gcs' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Storage unavailable' });
  }
});

// Obtener lista de guardados
app.get('/api/saves', async (req, res) => {
  try {
    const [files] = await bucket.getFiles({ prefix: 'save_' });

    const saves = await Promise.all(
      files
        .filter(f => f.name.endsWith('.json'))
        .map(async (file) => {
          const [metadata] = await file.getMetadata();
          const [content] = await file.download();
          const data = JSON.parse(content.toString());

          return {
            id: file.name.replace('.json', ''),
            timestamp: data.timestamp,
            gameTime: data.gameTime,
            stats: data.stats,
            size: parseInt(metadata.size),
            modified: metadata.updated,
          };
        })
    );

    // Ordenar por timestamp descendente
    saves.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ saves });
  } catch (error) {
    console.error('Error listing saves:', error);
    res.status(500).json({ error: 'Failed to list saves' });
  }
});

// Obtener un guardado específico
app.get('/api/saves/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const file = bucket.file(`${id}.json`);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Save not found' });
    }

    const [content] = await file.download();
    const data = JSON.parse(content.toString());

    res.json({ data });
  } catch (error) {
    console.error('Error reading save:', error);
    res.status(500).json({ error: 'Failed to read save' });
  }
});

// Guardar partida
app.post('/api/saves', async (req, res) => {
  try {
    const saveData = req.body;

    if (!saveData || !saveData.timestamp) {
      return res.status(400).json({ error: 'Invalid save data' });
    }

    // Usar timestamp como ID
    const saveId = `save_${saveData.timestamp}`;
    const file = bucket.file(`${saveId}.json`);

    const content = JSON.stringify(saveData, null, 2);
    await file.save(content, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache',
      },
    });

    const [metadata] = await file.getMetadata();

    res.json({
      success: true,
      saveId,
      size: parseInt(metadata.size),
      timestamp: saveData.timestamp,
    });

    // Backup al NAS en background (solo en entorno local)
    if (NAS_ENABLED) {
      backupToNAS(saveId, content).catch(err => console.error('NAS backup error:', err));
    }

    // Limpiar guardados antiguos en background
    cleanOldSaves().catch(err => console.error('Cleanup error:', err));

  } catch (error) {
    console.error('Error saving game:', error);
    res.status(500).json({ error: 'Failed to save game' });
  }
});

// Eliminar un guardado
app.delete('/api/saves/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const file = bucket.file(`${id}.json`);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Save not found' });
    }

    await file.delete();

    res.json({ success: true, message: 'Save deleted' });
  } catch (error) {
    console.error('Error deleting save:', error);
    res.status(500).json({ error: 'Failed to delete save' });
  }
});

// Función para limpiar guardados antiguos
async function cleanOldSaves() {
  try {
    const [files] = await bucket.getFiles({ prefix: 'save_' });

    if (files.length <= 10) return;

    // Obtener metadata para ordenar por fecha
    const filesWithMeta = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return {
          file,
          updated: new Date(metadata.updated).getTime()
        };
      })
    );

    // Ordenar por fecha y eliminar los más antiguos
    filesWithMeta.sort((a, b) => b.updated - a.updated);
    const toDelete = filesWithMeta.slice(10);

    await Promise.all(
      toDelete.map(({ file }) => file.delete())
    );

    console.log(`Cleaned ${toDelete.length} old saves from GCS`);
  } catch (error) {
    console.error('Error cleaning old saves:', error);
  }
}

app.listen(PORT, () => {
  console.log(`🎮 Save server running on http://localhost:${PORT}`);
  console.log(`☁️  Using GCS bucket: ${BUCKET_NAME}`);
});
