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
  tf?: unknown;
}

/**
 * Detects GPU availability and usage status.
 *
 * Checks multiple sources:
 * - NVIDIA GPU via nvidia-smi command
 * - CUDA environment variables
 *
 * NOTE: Does NOT load TensorFlow.js to avoid CPU thread spinning.
 * TensorFlow will be lazy-loaded only when GPU operations are actually needed.
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

  if (info.available) {
    logger.info(
      "✅ GPU available for computations (will be used when needed)",
      {
        deviceName: info.deviceName,
        note: "TensorFlow.js will lazy-load when entity count exceeds threshold",
      },
    );
  } else {
    logger.debug("ℹ️ Running in CPU mode (normal)", {
      note: "GPU not detected or not required for this simulation",
    });
  }

  return info;
}
