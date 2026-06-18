import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type {
  CookbookGpuGroup,
  CookbookGpuInfo,
  CookbookHardwareProfile,
  GpuBackend,
} from "./types";

const execFileAsync = promisify(execFile);

function roundGb(value: number): number {
  return Math.round(value * 10) / 10;
}

function groupGpus(gpus: CookbookGpuInfo[]): CookbookGpuGroup[] {
  const groups = new Map<string, CookbookGpuGroup>();
  const order: string[] = [];

  for (const gpu of gpus) {
    const key = `${gpu.name}|${Math.round(gpu.vramGb)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        name: gpu.name,
        vramEachGb: roundGb(gpu.vramGb),
        count: 0,
        indices: [],
        vramTotalGb: 0,
      });
      order.push(key);
    }
    const group = groups.get(key)!;
    group.count += 1;
    group.indices.push(gpu.index);
    group.vramTotalGb = roundGb(group.vramEachGb * group.count);
  }

  return order
    .map((key) => groups.get(key)!)
    .sort((a, b) => b.vramTotalGb - a.vramTotalGb);
}

async function probeNvidiaGpus(): Promise<{
  gpus: CookbookGpuInfo[];
  message: string;
  unifiedMemory: boolean;
} | null> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      ["--query-gpu=memory.total,name", "--format=csv,noheader,nounits"],
      { timeout: 8000 },
    );

    const lines = stdout.trim().split("\n").filter(Boolean);
    const gpus: CookbookGpuInfo[] = [];
    const unified: CookbookGpuInfo[] = [];

    for (const [idx, line] of lines.entries()) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) continue;
      const vramMb = Number.parseFloat(parts[0] ?? "");
      const name = parts[1] ?? "NVIDIA GPU";
      if (Number.isFinite(vramMb) && vramMb > 0) {
        gpus.push({ index: idx, name, vramGb: vramMb / 1024 });
      } else if (name) {
        unified.push({ index: idx, name, vramGb: 0 });
      }
    }

    if (gpus.length > 0) {
      return { gpus, message: "NVIDIA GPU via nvidia-smi erkannt.", unifiedMemory: false };
    }

    if (unified.length > 0) {
      const ramGb = roundGb(os.totalmem() / 1024 ** 3);
      return {
        gpus: unified.map((g) => ({ ...g, vramGb: ramGb })),
        message: "Unified-Memory NVIDIA GPU erkannt — RAM-Pool als VRAM-Schätzung.",
        unifiedMemory: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function profileFromEnv(env: NodeJS.ProcessEnv): Partial<CookbookHardwareProfile> | null {
  const vram = Number.parseFloat(env.COOKBOOK_GPU_VRAM_GB ?? "");
  const gpuName = env.COOKBOOK_GPU_NAME?.trim();
  if (!Number.isFinite(vram) || vram <= 0 || !gpuName) {
    return null;
  }

  const gpus: CookbookGpuInfo[] = [{ index: 0, name: gpuName, vramGb: vram }];
  const groups = groupGpus(gpus);
  return {
    backend: "cuda",
    gpuName,
    gpuVramGb: vram,
    gpuCount: 1,
    gpus,
    gpuGroups: groups,
    unifiedMemory: false,
    homogeneousGpus: true,
    probeSource: "env",
    probeMessage: "Hardware-Profil aus COOKBOOK_GPU_* ENV.",
  };
}

export async function detectHardwareProfile(
  options?: { env?: NodeJS.ProcessEnv },
): Promise<CookbookHardwareProfile> {
  const env = options?.env ?? process.env;
  const ramGb = roundGb(os.totalmem() / 1024 ** 3);
  const base: CookbookHardwareProfile = {
    platform: process.platform,
    arch: process.arch,
    cpuCores: os.cpus().length,
    ramGb,
    backend: "cpu",
    gpuName: null,
    gpuVramGb: 0,
    gpuCount: 0,
    gpus: [],
    gpuGroups: [],
    unifiedMemory: false,
    homogeneousGpus: true,
    probeSource: "fallback",
    probeMessage: "Keine GPU erkannt — CPU-only Schätzung.",
    probedAt: new Date().toISOString(),
  };

  const envProfile = profileFromEnv(env);
  if (envProfile) {
    return { ...base, ...envProfile, probedAt: new Date().toISOString() };
  }

  const nvidia = await probeNvidiaGpus();
  if (nvidia) {
    const groups = groupGpus(nvidia.gpus);
    const totalVram = roundGb(nvidia.gpus.reduce((sum, g) => sum + g.vramGb, 0));
    return {
      ...base,
      backend: "cuda" as GpuBackend,
      gpuName: nvidia.gpus[0]?.name ?? null,
      gpuVramGb: totalVram,
      gpuCount: nvidia.gpus.length,
      gpus: nvidia.gpus,
      gpuGroups: groups,
      unifiedMemory: nvidia.unifiedMemory,
      homogeneousGpus: groups.length <= 1,
      probeSource: "nvidia-smi",
      probeMessage: nvidia.message,
      probedAt: new Date().toISOString(),
    };
  }

  if (process.platform === "darwin") {
    return {
      ...base,
      backend: "metal",
      gpuName: "Apple Silicon (geschätzt)",
      gpuVramGb: ramGb,
      gpuCount: 1,
      gpus: [{ index: 0, name: "Apple Silicon", vramGb: ramGb }],
      gpuGroups: groupGpus([{ index: 0, name: "Apple Silicon", vramGb: ramGb }]),
      unifiedMemory: true,
      homogeneousGpus: true,
      probeSource: "fallback",
      probeMessage: "Apple Silicon — unified memory, RAM als VRAM-Pool.",
      probedAt: new Date().toISOString(),
    };
  }

  return base;
}
