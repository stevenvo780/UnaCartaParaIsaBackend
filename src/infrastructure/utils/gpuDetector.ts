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
 * Attempts to load TensorFlow.js with GPU preference.
 *
 * Tries to load the GPU version first (@tensorflow/tfjs-node-gpu),
 * falling back to CPU version if GPU is unavailable.
 * Results are cached to avoid repeated load attempts.
 *
 * @returns {unknown} TensorFlow.js instance or null if unavailable
 */
export function getTensorFlow(): unknown {
  if (tfLoadAttempted) return cachedTf;
  tfLoadAttempted = true;

  try {
    cachedTf = require("@tensorflow/tfjs-node-gpu");
    logger.info("✅ TensorFlow.js GPU loaded successfully");
    return cachedTf;
  } catch (gpuErr) {
    logger.debug("TensorFlow GPU not available", {
      error: gpuErr instanceof Error ? gpuErr.message : String(gpuErr),
    });
  }

  try {
    cachedTf = require("@tensorflow/tfjs-node");
    logger.info("✅ TensorFlow.js CPU loaded (fallback)");
    return cachedTf;
  } catch (cpuErr) {
    logger.debug("TensorFlow CPU also unavailable", {
      error: cpuErr instanceof Error ? cpuErr.message : String(cpuErr),
    });
  }

  return null;
}

/**
 * Detects GPU availability and usage status.
 *
 * Checks multiple sources:
 * - TensorFlow.js backend (GPU vs CPU)
 * - NVIDIA GPU via nvidia-smi command
 * - CUDA environment variables
 *
 * Logs detailed information about GPU detection and usage.
 *
 * @returns {GPUInfo} Information about GPU availability and current usage
 */
export function detectGPUAvailability(): GPUInfo {
  const info: GPUInfo = {
    available: false,
    usingGPU: false,
    libraries: {},
  };

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
    logger.info(`📦 TensorFlow backend: ${backend}`);

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
          logger.info("🎮 GPU detected and in use", {
            backend: backend,
            deviceName: deviceInfo.deviceName,
            vendor: deviceInfo.vendor,
          });
        } else {
          logger.info("🎮 GPU in use (TensorFlow.js)", { backend });
        }
      } catch (err) {
        logger.debug("Error getting GPU device info, assuming GPU available", {
          error: err instanceof Error ? err.message : String(err),
          backend,
        });
        logger.info("🎮 GPU in use (TensorFlow.js)", { backend });
      }
    } else {
      info.libraries!.tensorflowGpu = false;
      logger.info("⚠️ TensorFlow.js using CPU backend", { backend });
    }
  } else {
    info.libraries!.tensorflow = false;
    info.libraries!.tensorflowGpu = false;
  }

  const cudaVisible = process.env.CUDA_VISIBLE_DEVICES;
  const cudaHome = process.env.CUDA_HOME;
  const cudaPath = process.env.CUDA_PATH;

  if (cudaVisible || cudaHome || cudaPath) {
    logger.info("🔍 CUDA environment variables detected", {
      CUDA_VISIBLE_DEVICES: cudaVisible,
      CUDA_HOME: cudaHome ? "configured" : "not configured",
      CUDA_PATH: cudaPath ? "configured" : "not configured",
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
        logger.info("🎮 NVIDIA GPU detected in system", {
          deviceName: nvidiaSmi.trim(),
        });
      }
    } catch (err) {
      logger.debug("nvidia-smi not available or command execution error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err2) {
    logger.debug("Error checking for NVIDIA GPU via child_process", {
      error: err2 instanceof Error ? err2.message : String(err2),
    });
  }

  if (info.usingGPU) {
    logger.info("✅ GPU is being used for computations", {
      backend: info.backend,
      deviceName: info.deviceName,
      vendor: info.vendor,
    });
  } else if (info.available) {
    logger.info("ℹ️ GPU detected but TensorFlow using CPU", {
      deviceName: info.deviceName,
      reason: "CUDA Toolkit 11.x not installed or incompatible",
      note: "CPU performance is sufficient for this simulation",
    });
  } else {
    logger.debug("ℹ️ Running in CPU mode (normal)", {
      tensorflowInstalled: info.libraries?.tensorflow ?? false,
      note: "GPU not required for this simulation",
    });
  }

  return info;
}
