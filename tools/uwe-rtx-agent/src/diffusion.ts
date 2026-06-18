import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export interface DiffusionRequest {
  prompt: string;
  task?: string;
  sourceImageBase64?: string;
  maskBase64?: string;
  width?: number;
  height?: number;
}

export interface DiffusionResult {
  imageBase64: string;
  mimeType: string;
  provider: "diffusion_api" | "ollama" | "fallback";
  note?: string;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const chunkType = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([chunkType, data])), 0);
  return Buffer.concat([length, chunkType, data, crc]);
}

function createPatternPng(prompt: string, width = 256, height = 256): string {
  const hash = createHash("sha256").update(prompt).digest();
  const r = hash[0] ?? 120;
  const g = hash[1] ?? 80;
  const b = hash[2] ?? 180;

  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 3;
      const wave = Math.sin((x + y) / 16) * 32;
      raw[offset] = Math.min(255, Math.max(0, r + wave));
      raw[offset + 1] = Math.min(255, Math.max(0, g + wave / 2));
      raw[offset + 2] = Math.min(255, Math.max(0, b - wave / 3));
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk("IHDR", ihdr),
    createChunk("IDAT", deflateSync(raw)),
    createChunk("IEND", Buffer.alloc(0)),
  ]);

  return png.toString("base64");
}

async function callDiffusionApi(
  baseUrl: string,
  request: DiffusionRequest,
  timeoutMs: number,
): Promise<DiffusionResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/sdapi/v1/txt2img`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: request.prompt,
        width: request.width ?? 512,
        height: request.height ?? 512,
        steps: 20,
        cfg_scale: 7,
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { images?: string[] };
    const image = data.images?.[0];
    if (!image) return null;

    return {
      imageBase64: image,
      mimeType: "image/png",
      provider: "diffusion_api",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callOllamaImage(
  ollamaBaseUrl: string,
  request: DiffusionRequest,
  model: string,
  timeoutMs: number,
): Promise<DiffusionResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ollamaBaseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        stream: false,
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { images?: string[]; response?: string };
    const image = data.images?.[0];
    if (!image) return null;

    return {
      imageBase64: image,
      mimeType: "image/png",
      provider: "ollama",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateDiffusionImage(
  request: DiffusionRequest,
  options?: {
    diffusionApiUrl?: string;
    ollamaBaseUrl?: string;
    ollamaImageModel?: string;
    timeoutMs?: number;
  },
): Promise<DiffusionResult> {
  const timeoutMs = options?.timeoutMs ?? 120000;

  if (request.sourceImageBase64 && request.task !== "generate") {
    return {
      imageBase64: request.sourceImageBase64,
      mimeType: "image/png",
      provider: "fallback",
      note: "Edit/inpaint passthrough until diffusion edit backend is configured.",
    };
  }

  const diffusionUrl = options?.diffusionApiUrl?.trim();
  if (diffusionUrl) {
    const fromApi = await callDiffusionApi(diffusionUrl, request, timeoutMs);
    if (fromApi) return fromApi;
  }

  const ollamaModel = options?.ollamaImageModel?.trim();
  if (options?.ollamaBaseUrl && ollamaModel) {
    const fromOllama = await callOllamaImage(options.ollamaBaseUrl, request, ollamaModel, timeoutMs);
    if (fromOllama) return fromOllama;
  }

  return {
    imageBase64: createPatternPng(request.prompt, request.width ?? 256, request.height ?? 256),
    mimeType: "image/png",
    provider: "fallback",
    note: "Diffusion backend nicht erreichbar — deterministisches Platzhalterbild erzeugt.",
  };
}
