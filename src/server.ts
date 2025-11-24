import app from './app.js';
import { CONFIG } from './config/config.js';

app.listen(CONFIG.PORT, () => {
  console.log(`🎮 Save server running on http://localhost:${CONFIG.PORT}`);
  if (!CONFIG.USE_LOCAL_STORAGE) {
    console.log(`☁️  Using GCS bucket: ${CONFIG.BUCKET_NAME}`);
  } else {
    console.log(`📁 Using local storage: ${CONFIG.LOCAL_SAVES_PATH}`);
  }
});
