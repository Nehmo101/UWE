import type { BrainPrismaClient as PrismaClient } from "../brain-client";
import { endOfWeek } from "../calendar-aggregation-service";
import {
  buildContractAlerts,
  summarizeContractCosts,
  type ContractAlert,
  type ContractCostSummary,
} from "../contract-expense-utils";
import {
  countOpenSetupSteps,
  detectHardwareUrlWarnings,
  type HardwareUrlWarning,
} from "../hardware-utils";
import type { LifeAdminCaptureService } from "./life-admin-capture-service";
import type { LifeAdminContractService } from "./life-admin-contract-service";
import type { LifeAdminHardwareService } from "./life-admin-hardware-service";
import type { LifeAdminProjectService } from "./life-admin-project-service";
import type { LifeAdminWorkshopService } from "./life-admin-workshop-service";
import { PROJECT_ACTIVE_STATUSES } from "./life-admin-types";
// Die Family-Modelle (Vertraege, Dokumente, Kueche, Haushalt, Kalender,
// Scan-Eingang) liegen seit Abschnitt G in uwe-family.db. Der Singleton statt
// eines weiteren Konstruktor-Parameters: sonst muesste jede Aufrufstelle im
// Repo einen dritten Client durchreichen.
import { familyPrisma, type FamilyPrismaClient } from "../family-client";

export interface TodayAdminSummary {
  inboxCaptureCount: number;
  activeProjectCount: number;
  activeWorkshopCount: number;
  contractsNeedingReview: number;
  contractAlerts: ContractAlert[];
  contractCosts: ContractCostSummary;
  hardwareIssues: number;
  hardwareUrlWarnings: HardwareUrlWarning[];
  openSetupSteps: number;
  recentCaptures: Awaited<ReturnType<LifeAdminCaptureService["listCaptures"]>>;
  activeProjects: Awaited<ReturnType<LifeAdminProjectService["listPersonalProjects"]>>;
  activeWorkshops: Awaited<ReturnType<LifeAdminWorkshopService["listWorkshopProjects"]>>;
  workshopOpenTasks: Awaited<ReturnType<LifeAdminWorkshopService["listWorkshopOpenTasks"]>>;
  duePersonalProjects: Awaited<ReturnType<LifeAdminProjectService["listPersonalProjects"]>>;
  dueWorkshopProjects: Awaited<ReturnType<LifeAdminWorkshopService["listWorkshopProjects"]>>;
}

export interface LifeAdminTodayDeps {
  capture: LifeAdminCaptureService;
  project: LifeAdminProjectService;
  workshop: LifeAdminWorkshopService;
  contract: LifeAdminContractService;
  hardware: LifeAdminHardwareService;
}

export class LifeAdminTodayService {
  constructor(
    private readonly db: PrismaClient,
    private readonly deps: LifeAdminTodayDeps,
    private readonly familyDb: FamilyPrismaClient = familyPrisma,
  ) {}

  async getTodaySummary(): Promise<TodayAdminSummary> {
    const [contracts, hardwareDevices] = await Promise.all([
      this.deps.contract.listContractExpenses({ limit: 500 }),
      this.deps.hardware.listHardwareDevices({ limit: 500 }),
    ]);

    const contractAlerts = buildContractAlerts(contracts);
    const contractCosts = summarizeContractCosts(contracts);
    const hardwareUrlWarnings = detectHardwareUrlWarnings(hardwareDevices);
    const openSetupSteps = hardwareDevices.reduce(
      (sum, device) => sum + countOpenSetupSteps(device.setupSteps),
      0,
    );

    const [
      inboxCaptureCount,
      activeProjectCount,
      activeWorkshopCount,
      contractsNeedingReview,
      hardwareIssues,
      recentCaptures,
      activeProjects,
      activeWorkshops,
      workshopOpenTasks,
      duePersonalProjects,
      dueWorkshopProjects,
    ] = await Promise.all([
      this.db.captureEntry.count({ where: { status: "inbox" } }),
      this.db.personalProject.count({
        where: { status: { in: PROJECT_ACTIVE_STATUSES } },
      }),
      this.db.workshopProject.count({
        where: { status: { in: ["in_progress", "material_missing", "planned"] } },
      }),
      this.familyDb.contractExpense.count({ where: { status: "review" } }),
      this.db.hardwareDevice.count({
        where: { status: { in: ["offline", "broken"] } },
      }),
      this.deps.capture.listCaptures({ status: "inbox", limit: 5 }),
      this.deps.project.listPersonalProjects({
        status: PROJECT_ACTIVE_STATUSES,
        limit: 5,
      }),
      this.deps.workshop.listWorkshopProjects({
        status: ["in_progress", "material_missing", "planned"],
        limit: 5,
      }),
      this.deps.workshop.listWorkshopOpenTasks(8),
      this.deps.project.listPersonalProjects({
        status: PROJECT_ACTIVE_STATUSES,
        limit: 8,
        dueBefore: endOfWeek(new Date()),
      }),
      this.deps.workshop.listWorkshopProjects({
        status: ["in_progress", "material_missing", "planned"],
        limit: 8,
        dueBefore: endOfWeek(new Date()),
      }),
    ]);

    return {
      inboxCaptureCount,
      activeProjectCount,
      activeWorkshopCount,
      contractsNeedingReview,
      contractAlerts,
      contractCosts,
      hardwareIssues,
      hardwareUrlWarnings,
      openSetupSteps,
      recentCaptures,
      activeProjects,
      activeWorkshops,
      workshopOpenTasks,
      duePersonalProjects,
      dueWorkshopProjects,
    };
  }
}
