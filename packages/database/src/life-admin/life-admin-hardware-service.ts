import type { HardwareStatus } from "../generated/prisma/client";
import type { PrismaClient } from "../client";
import { appendHardwareErrorEntry } from "../homelab-cockpit";
import { toPrismaJsonValue } from "../json-utils";
import type { CreateHardwareDeviceInput } from "./life-admin-types";

export class LifeAdminHardwareService {
  constructor(private readonly db: PrismaClient) {}

  async listHardwareDevices(options: {
    status?: HardwareStatus | HardwareStatus[];
    limit?: number;
  } = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.hardwareDevice.findMany({
      where: { status: statusFilter },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async getHardwareFilterCounts(): Promise<{
    all: number;
    active: number;
    issues: number;
    planned: number;
  }> {
    const [all, active, issues, planned] = await Promise.all([
      this.db.hardwareDevice.count(),
      this.db.hardwareDevice.count({ where: { status: "active" } }),
      this.db.hardwareDevice.count({
        where: { status: { in: ["offline", "broken"] } },
      }),
      this.db.hardwareDevice.count({ where: { status: "planned" } }),
    ]);

    return { all, active, issues, planned };
  }

  async createHardwareDevice(input: CreateHardwareDeviceInput) {
    return this.db.hardwareDevice.create({
      data: {
        name: input.name,
        role: input.role ?? "",
        status: input.status ?? "planned",
        hostname: input.hostname ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        localUrl: input.localUrl ?? undefined,
        publicUrl: input.publicUrl ?? undefined,
        operatingSystem: input.operatingSystem ?? "",
        specs: toPrismaJsonValue(input.specs),
        setupSteps: toPrismaJsonValue(input.setupSteps),
        errorNotes: input.errorNotes ?? undefined,
        notes: input.notes ?? "",
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getHardwareDevice(id: string) {
    return this.db.hardwareDevice.findUnique({ where: { id } });
  }

  async updateHardwareDevice(id: string, input: Partial<CreateHardwareDeviceInput>) {
    return this.db.hardwareDevice.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        status: input.status,
        hostname: input.hostname ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        localUrl: input.localUrl ?? undefined,
        publicUrl: input.publicUrl ?? undefined,
        operatingSystem: input.operatingSystem,
        specs: input.specs === undefined ? undefined : toPrismaJsonValue(input.specs),
        setupSteps: input.setupSteps === undefined ? undefined : toPrismaJsonValue(input.setupSteps),
        errorNotes: input.errorNotes ?? undefined,
        notes: input.notes,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async toggleHardwareSetupStep(deviceId: string, stepIndex: number) {
    const device = await this.getHardwareDevice(deviceId);
    if (!device) {
      throw new Error(`Hardware-Gerät ${deviceId} nicht gefunden.`);
    }

    const raw = device.setupSteps;
    if (!Array.isArray(raw)) {
      return device;
    }

    const steps = raw.map((step) => {
      if (typeof step === "string") {
        return { label: step, done: false };
      }
      const record = step as { label?: string; done?: boolean };
      return { label: record.label ?? "", done: Boolean(record.done) };
    });

    if (stepIndex < 0 || stepIndex >= steps.length) {
      return device;
    }

    const current = steps[stepIndex];
    if (!current) {
      return device;
    }

    steps[stepIndex] = { ...current, done: !current.done };
    return this.updateHardwareDevice(deviceId, { setupSteps: steps });
  }

  async addHardwareErrorEntry(
    deviceId: string,
    input: {
      problem: string;
      resolution?: string;
      affectedServices?: string[];
    },
  ) {
    const device = await this.getHardwareDevice(deviceId);
    if (!device) {
      throw new Error(`Hardware-Gerät ${deviceId} nicht gefunden.`);
    }

    const metadata = appendHardwareErrorEntry(
      device.metadata as Record<string, unknown> | null,
      input,
    );

    return this.updateHardwareDevice(deviceId, { metadata });
  }

  async recordHardwareCheck(deviceId: string) {
    const device = await this.getHardwareDevice(deviceId);
    if (!device) {
      throw new Error(`Hardware-Gerät ${deviceId} nicht gefunden.`);
    }

    const base =
      device.metadata && typeof device.metadata === "object"
        ? { ...(device.metadata as Record<string, unknown>) }
        : {};

    return this.updateHardwareDevice(deviceId, {
      metadata: {
        ...base,
        lastCheckedAt: new Date().toISOString(),
      },
    });
  }

  async deleteHardwareDevice(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "hardware_device", sourceId: id },
          { targetType: "hardware_device", targetId: id },
        ],
      },
    });
    return this.db.hardwareDevice.delete({ where: { id } });
  }
}
