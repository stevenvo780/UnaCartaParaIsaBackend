import { logger } from "./logger";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

interface GPUInfo {
  available: boolean;
  backend?: string;
  deviceName?: string;
  vendor?: string;
  version?: string;
  usingGPU: boolean;
  libraries?: {
    tensorflow?: boolean;
    tensorflowGpu?: boolean;
    cuda?: boolean;
  };
  tf?: unknown; // TensorFlow instance if loaded
}

let cachedTf: unknown = null;
let tfLoadAttempted = false;

/**
 * Intenta cargar TensorFlow.js (preferencia GPU)
 */
export function getTensorFlow(): unknown {
  if (tfLoadAttempted) return cachedTf;
  tfLoadAttempted = true;

  try {
    cachedTf = require("@tensorflow/tfjs-node-gpu");
    logger.info("✅ TensorFlow.js GPU cargado exitosamente");
    return cachedTf;
  } catch (gpuErr) {
    logger.debug("TensorFlow GPU no disponible", {
      error: gpuErr instanceof Error ? gpuErr.message : String(gpuErr),
    });
  }

  try {
    cachedTf = require("@tensorflow/tfjs-node");
    logger.info("✅ TensorFlow.js CPU cargado (fallback)");
    return cachedTf;
  } catch (_cpuErr) {
    logger.debug("TensorFlow CPU tampoco disponible");
  }

  return null;
}

/**
 * Detecta si hay GPU disponible y si se está usando para cálculos
 */
export function detectGPUAvailability(): GPUInfo {
  const info: GPUInfo = {
    available: false,
    usingGPU: false,
    libraries: {},
  };

  // Intentar cargar TensorFlow (preferencia GPU)
  const tf = getTensorFlow() as {
    getBackend?: () => string;
    backend?: () => {
      getGpuDeviceInfo?: () => { deviceName?: string; vendor?: string };
    };
  } | null;

  if (tf && typeof tf.getBackend === "function") {
    info.tf = tf;
    info.libraries!.tensorflow = true;

    const backend = tf.getBackend();
    info.backend = backend;
    logger.info(`📦 Backend de TensorFlow: ${backend}`);

    if (backend === "tensorflow") {
      info.usingGPU = true;
      info.available = true;
      info.libraries!.tensorflowGpu = true;

      try {
        const backendInstance = tf.backend?.();
        const deviceInfo = backendInstance?.getGpuDeviceInfo?.();
        if (deviceInfo) {
          info.deviceName = deviceInfo.deviceName;
          info.vendor = deviceInfo.vendor;
          logger.info("🎮 GPU detectada y en uso", {
            backend: backend,
            deviceName: deviceInfo.deviceName,
            vendor: deviceInfo.vendor,
          });
        } else {
          logger.info("🎮 GPU en uso (TensorFlow.js)", { backend });
        }
      } catch (_err) {
        logger.info("🎮 GPU en uso (TensorFlow.js)", { backend });
      }
    } else {
      info.libraries!.tensorflowGpu = false;
      logger.info("⚠️ TensorFlow.js usando backend CPU", { backend });
    }
  } else {
    info.libraries!.tensorflow = false;
    info.libraries!.tensorflowGpu = false;
  }

  // Verificar variables de entorno relacionadas con CUDA/GPU
  const cudaVisible = process.env.CUDA_VISIBLE_DEVICES;
  const cudaHome = process.env.CUDA_HOME;
  const cudaPath = process.env.CUDA_PATH;

  if (cudaVisible || cudaHome || cudaPath) {
    logger.info("🔍 Variables de entorno CUDA detectadas", {
      CUDA_VISIBLE_DEVICES: cudaVisible,
      CUDA_HOME: cudaHome ? "configurado" : "no configurado",
      CUDA_PATH: cudaPath ? "configurado" : "no configurado",
    });
  }

  try {
    const { execSync } = require("child_process") as {
      execSync: (
        cmd: string,
        opts?: { encoding?: string; timeout?: number },
      ) => string;
    };
    try {
      const nvidiaSmi: string = execSync(
        "nvidia-smi --query-gpu=name --format=csv,noheader",
        {
          encoding: "utf8",
          timeout: 2000,
        },
      );
      if (nvidiaSmi && nvidiaSmi.trim()) {
        info.available = true;
        info.deviceName = nvidiaSmi.trim();
        info.libraries!.cuda = true;
        logger.info("🎮 GPU NVIDIA detectada en el sistema", {
          deviceName: nvidiaSmi.trim(),
        });
      }
    } catch (_err) {
      // nvidia-smi no disponible o error
      void _err;
    }
  } catch (_err2) {
    // execSync no disponible
    void _err2;
  }

  if (info.usingGPU) {
    logger.info("✅ GPU está siendo utilizada para cálculos", {
      backend: info.backend,
      deviceName: info.deviceName,
      vendor: info.vendor,
    });
  } else if (info.available) {
    logger.info("ℹ️ GPU detectada pero TensorFlow usa CPU", {
      deviceName: info.deviceName,
      reason: "CUDA Toolkit 11.x no instalado o incompatible",
      note: "El rendimiento en CPU es suficiente para esta simulación",
    });
  } else {
    logger.debug("ℹ️ Ejecutando en modo CPU (normal)", {
      tensorflowInstalled: info.libraries?.tensorflow ?? false,
      note: "GPU no requerida para esta simulación",
    });
  }

  return info;
}
