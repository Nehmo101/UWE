import type { PrismaClient } from "./client";
import type { InferenceProvider } from "./generated/prisma/client";
import { classifyEndpointUrl } from "./studio-security";
import { encryptSecret, decryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { toPrismaJsonValue } from "./json-utils";

export interface InferenceEndpointRecord {
  id: string;
  name: string;
  baseUrl: string;
  provider: InferenceProvider;
  isEnabled: boolean;
  lastProbeAt: Date | null;
  probeStatus: string | null;
  cachedModels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInferenceEndpointInput {
  name: string;
  baseUrl: string;
  provider?: InferenceProvider;
  apiKey?: string | null;
  isEnabled?: boolean;
}

export interface ProbeResult {
  ok: boolean;
  status: string;
  models: string[];
  error?: string;
}

function parseModels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toRecord(row: {
  id: string;
  name: string;
  baseUrl: string;
  provider: InferenceProvider;
  isEnabled: boolean;
  lastProbeAt: Date | null;
  probeStatus: string | null;
  cachedModels: unknown;
  createdAt: Date;
  updatedAt: Date;
}): InferenceEndpointRecord {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    provider: row.provider,
    isEnabled: row.isEnabled,
    lastProbeAt: row.lastProbeAt,
    probeStatus: row.probeStatus,
    cachedModels: parseModels(row.cachedModels),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function assertInferenceEndpointUrlAllowed(baseUrl: string): void {
  const kind = classifyEndpointUrl(baseUrl);
  if (kind === "invalid") {
    throw new Error("Ungültige Inference-URL.");
  }
  if (kind === "public") {
    throw new Error("Öffentliche Inference-URLs sind nicht erlaubt — nur Heimnetz/Loopback.");
  }
}

export class InferenceEndpointService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  async list(): Promise<InferenceEndpointRecord[]> {
    const rows = await this.db.inferenceEndpoint.findMany({ orderBy: { name: "asc" } });
    return rows.map(toRecord);
  }

  async create(input: CreateInferenceEndpointInput): Promise<InferenceEndpointRecord> {
    assertInferenceEndpointUrlAllowed(input.baseUrl);
    const row = await this.db.inferenceEndpoint.create({
      data: {
        name: input.name.trim(),
        baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
        provider: input.provider ?? "ollama",
        apiKeyEnc: input.apiKey
          ? encryptSecret(input.apiKey, this.encryptionSecret)
          : null,
        isEnabled: input.isEnabled ?? true,
      },
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.inferenceEndpoint.deleteMany({ where: { id } });
    return result.count > 0;
  }

  async probe(id: string): Promise<ProbeResult> {
    const row = await this.db.inferenceEndpoint.findUnique({ where: { id } });
    if (!row) {
      return { ok: false, status: "not_found", models: [], error: "Endpoint nicht gefunden." };
    }

    assertInferenceEndpointUrlAllowed(row.baseUrl);
    const headers: Record<string, string> = {};
    if (row.apiKeyEnc) {
      headers.Authorization = `Bearer ${decryptSecret(row.apiKeyEnc, this.encryptionSecret)}`;
    }

    try {
      const response = await fetch(`${row.baseUrl}/api/tags`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        const status = `http_${response.status}`;
        await this.db.inferenceEndpoint.update({
          where: { id },
          data: { lastProbeAt: new Date(), probeStatus: status, cachedModels: toPrismaJsonValue([]) },
        });
        return { ok: false, status, models: [], error: `HTTP ${response.status}` };
      }

      const payload = (await response.json()) as { models?: Array<{ name?: string }> };
      const models =
        payload.models?.map((entry) => entry.name).filter((name): name is string => Boolean(name)) ??
        [];

      await this.db.inferenceEndpoint.update({
        where: { id },
        data: {
          lastProbeAt: new Date(),
          probeStatus: "ok",
          cachedModels: toPrismaJsonValue(models),
        },
      });

      return { ok: true, status: "ok", models };
    } catch (error) {
      const message = error instanceof Error ? error.message : "probe_failed";
      await this.db.inferenceEndpoint.update({
        where: { id },
        data: { lastProbeAt: new Date(), probeStatus: "unreachable" },
      });
      return { ok: false, status: "unreachable", models: [], error: message };
    }
  }
}

export function createInferenceEndpointService(db: PrismaClient): InferenceEndpointService {
  return new InferenceEndpointService(db);
}

export function estimateHardwareFit(totalRamGb: number, modelSizeGb: number): {
  fits: boolean;
  message: string;
} {
  if (modelSizeGb <= 0) {
    return { fits: false, message: "Modellgröße unbekannt." };
  }
  const headroom = totalRamGb * 0.7;
  if (modelSizeGb <= headroom) {
    return { fits: true, message: `Passt vermutlich (${modelSizeGb}GB Modell, ${totalRamGb}GB RAM).` };
  }
  return {
    fits: false,
    message: `Zu groß für verfügbares RAM (${modelSizeGb}GB Modell, ${totalRamGb}GB RAM).`,
  };
}
