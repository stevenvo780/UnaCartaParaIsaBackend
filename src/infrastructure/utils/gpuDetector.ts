import { logger } from "./logger";

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

  // Verificar si TensorFlow.js está instalado
  try {
    // Intentar importar TensorFlow.js (si está instalado)
    const tf = require("@tensorflow/tfjs-node");
    if (tf) {
      info.libraries!.tensorflow = true;
      logger.info("✅ TensorFlow.js Node detectado");

      // Verificar backend de TensorFlow
      const backend = tf.getBackend();
      info.backend = backend;
      logger.info(`📦 Backend de TensorFlow: ${backend}`);

      // Verificar si está usando GPU
      if (backend === "tensorflow" || backend === "gpu") {
        info.usingGPU = true;
        info.available = true;

        // Intentar obtener información del dispositivo
        try {
          const deviceInfo = tf.backend().getGpuDeviceInfo?.();
          if (deviceInfo) {
            info.deviceName = deviceInfo.deviceName;
            info.vendor = deviceInfo.vendor;
            logger.info("🎮 GPU detectada y en uso", {
              backend: backend,
              deviceName: deviceInfo.deviceName,
              vendor: deviceInfo.vendor,
            });
          } else {
            logger.info("🎮 GPU en uso (TensorFlow.js)", {
              backend: backend,
            });
          }
        } catch (err) {
          logger.info("🎮 GPU en uso (TensorFlow.js)", {
            backend: backend,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        logger.warn("⚠️ TensorFlow.js está usando CPU", {
          backend: backend,
        });
      }
    }
  } catch (err) {
    // TensorFlow.js no está instalado
    info.libraries!.tensorflow = false;
  }

  // Verificar si TensorFlow.js GPU está instalado
  try {
    const tfGpu = require("@tensorflow/tfjs-node-gpu");
    if (tfGpu) {
      info.libraries!.tensorflowGpu = true;
      logger.info("✅ TensorFlow.js Node GPU detectado");
      info.available = true;
      info.usingGPU = true;
    }
  } catch (err) {
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

  // Verificar si hay bibliotecas nativas de CUDA disponibles
  try {
    const { execSync } = require("child_process");
    try {
      const nvidiaSmi = execSync("nvidia-smi --query-gpu=name --format=csv,noheader", {
        encoding: "utf8",
        timeout: 2000,
      });
      if (nvidiaSmi && nvidiaSmi.trim()) {
        info.available = true;
        info.deviceName = nvidiaSmi.trim();
        info.libraries!.cuda = true;
        logger.info("🎮 GPU NVIDIA detectada en el sistema", {
          deviceName: nvidiaSmi.trim(),
        });
      }
    } catch (err) {
      // nvidia-smi no disponible o error
    }
  } catch (err) {
    // execSync no disponible
  }

  // Resumen final
  if (info.usingGPU) {
    logger.info("✅ GPU está siendo utilizada para cálculos", {
      backend: info.backend,
      deviceName: info.deviceName,
      vendor: info.vendor,
    });
  } else {
    logger.warn("⚠️ No se detectó uso de GPU para cálculos", {
      tensorflowInstalled: info.libraries?.tensorflow ?? false,
      tensorflowGpuInstalled: info.libraries?.tensorflowGpu ?? false,
      cudaAvailable: info.libraries?.cuda ?? false,
      message:
        "Los cálculos se están ejecutando en CPU. Para usar GPU, instala @tensorflow/tfjs-node-gpu",
    });
  }

  return info;
}

