import express from 'express';
import cors from 'cors';
import { Storage } from '@google-cloud/storage';
import SftpClient from 'ssh2-sftp-client';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8080;
const BUCKET_NAME = process.env.BUCKET_NAME || 'una-carta-para-isa-saves';
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'emergent-enterprises';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || !process.env.GOOGLE_APPLICATION_CREDENTIALS;
const LOCAL_SAVES_PATH = process.env.LOCAL_SAVES_PATH || `${process.env.HOME}/.local/share/una-carta-para-isa/saves`;

// Configuración NAS (solo funciona en entorno local)
const NAS_ENABLED = process.env.NAS_ENABLED === 'true';
const NAS_CONFIG = {
  host: process.env.NAS_HOST || '192.168.1.12',
  port: 22,
  username: process.env.NAS_USER || 'nass',
  password: process.env.NAS_PASSWORD || 'MiutHuheCAp9',
  backupPath: process.env.NAS_PATH || '/mnt/raid10/backups/una-carta-para-isa'
};

// Inicializar Cloud Storage (puede fallar si no hay credenciales)
let bucket = null;
let useGCS = false;

if (!USE_LOCAL_STORAGE) {
  try {
    const storage = new Storage({
      projectId: PROJECT_ID,
    });
    bucket = storage.bucket(BUCKET_NAME);
    useGCS = true;
  } catch (error) {
    console.log('⚠️  GCS not available, using local storage');
  }
}

// Asegurar que el directorio local existe
async function ensureLocalDir() {
  try {
    await fs.mkdir(LOCAL_SAVES_PATH, { recursive: true });
  } catch (error) {
    // Ignorar si ya existe
  }
}

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
    if (useGCS && bucket) {
      // Verificar conexión con el bucket
      await bucket.exists();
      res.json({ status: 'ok', timestamp: Date.now(), storage: 'gcs' });
    } else {
      // Usar almacenamiento local
      await ensureLocalDir();
      res.json({ status: 'ok', timestamp: Date.now(), storage: 'local' });
    }
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Storage unavailable' });
  }
});

// Obtener lista de guardados
app.get('/api/saves', async (req, res) => {
  try {
    let saves = [];

    if (useGCS && bucket) {
      const [files] = await bucket.getFiles({ prefix: 'save_' });

      saves = await Promise.all(
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
    } else {
      // Almacenamiento local
      await ensureLocalDir();
      const files = await fs.readdir(LOCAL_SAVES_PATH);

      saves = await Promise.all(
        files
          .filter(f => f.endsWith('.json') && f.startsWith('save_'))
          .map(async (filename) => {
            const filepath = path.join(LOCAL_SAVES_PATH, filename);
            const content = await fs.readFile(filepath, 'utf-8');
            const stat = await fs.stat(filepath);
            const data = JSON.parse(content);

            return {
              id: filename.replace('.json', ''),
              timestamp: data.timestamp,
              gameTime: data.gameTime,
              stats: data.stats,
              size: stat.size,
              modified: stat.mtime.toISOString(),
            };
          })
      );
    }

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
    let data;

    if (useGCS && bucket) {
      const file = bucket.file(`${id}.json`);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: 'Save not found' });
      }

      const [content] = await file.download();
      data = JSON.parse(content.toString());
    } else {
      // Almacenamiento local
      const filepath = path.join(LOCAL_SAVES_PATH, `${id}.json`);
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        data = JSON.parse(content);
      } catch (error) {
        return res.status(404).json({ error: 'Save not found' });
      }
    }

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
    const content = JSON.stringify(saveData, null, 2);
    let size;

    if (useGCS && bucket) {
      const file = bucket.file(`${saveId}.json`);

      await file.save(content, {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'no-cache',
        },
      });

      const [metadata] = await file.getMetadata();
      size = parseInt(metadata.size);
    } else {
      // Almacenamiento local
      await ensureLocalDir();
      const filepath = path.join(LOCAL_SAVES_PATH, `${saveId}.json`);
      await fs.writeFile(filepath, content, 'utf-8');
      const stat = await fs.stat(filepath);
      size = stat.size;
    }

    res.json({
      success: true,
      saveId,
      size,
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

    if (useGCS && bucket) {
      const file = bucket.file(`${id}.json`);

      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: 'Save not found' });
      }

      await file.delete();
    } else {
      // Almacenamiento local
      const filepath = path.join(LOCAL_SAVES_PATH, `${id}.json`);
      try {
        await fs.unlink(filepath);
      } catch (error) {
        return res.status(404).json({ error: 'Save not found' });
      }
    }

    res.json({ success: true, message: 'Save deleted' });
  } catch (error) {
    console.error('Error deleting save:', error);
    res.status(500).json({ error: 'Failed to delete save' });
  }
});

// Función para limpiar guardados antiguos
async function cleanOldSaves() {
  try {
    let files = [];

    if (useGCS && bucket) {
      const [gcsFiles] = await bucket.getFiles({ prefix: 'save_' });

      if (gcsFiles.length <= 10) return;

      // Obtener metadata para ordenar por fecha
      const filesWithMeta = await Promise.all(
        gcsFiles.map(async (file) => {
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
    } else {
      // Almacenamiento local
      await ensureLocalDir();
      const localFiles = await fs.readdir(LOCAL_SAVES_PATH);
      const saveFiles = localFiles.filter(f => f.endsWith('.json') && f.startsWith('save_'));

      if (saveFiles.length <= 10) return;

      // Obtener timestamps de los archivos
      const filesWithMeta = await Promise.all(
        saveFiles.map(async (filename) => {
          const filepath = path.join(LOCAL_SAVES_PATH, filename);
          const stat = await fs.stat(filepath);
          return {
            filename,
            filepath,
            updated: stat.mtime.getTime()
          };
        })
      );

      // Ordenar por fecha y eliminar los más antiguos
      filesWithMeta.sort((a, b) => b.updated - a.updated);
      const toDelete = filesWithMeta.slice(10);

      await Promise.all(
        toDelete.map(({ filepath }) => fs.unlink(filepath))
      );

      console.log(`Cleaned ${toDelete.length} old saves from local storage`);
    }
  } catch (error) {
    console.error('Error cleaning old saves:', error);
  }
}

app.listen(PORT, () => {
  console.log(`🎮 Save server running on http://localhost:${PORT}`);
  if (useGCS) {
    console.log(`☁️  Using GCS bucket: ${BUCKET_NAME}`);
  } else {
    console.log(`📁 Using local storage: ${LOCAL_SAVES_PATH}`);
  }
});
