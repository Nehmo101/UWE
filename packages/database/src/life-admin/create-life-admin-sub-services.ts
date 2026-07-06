import type { PrismaClient } from "../client";
import { LifeAdminBrainService } from "./life-admin-brain-service";
import { LifeAdminCaptureService, type LifeAdminCaptureDeps } from "./life-admin-capture-service";
import { LifeAdminContractService } from "./life-admin-contract-service";
import { LifeAdminHardwareService } from "./life-admin-hardware-service";
import { LifeAdminLinksService } from "./life-admin-links-service";
import { LifeAdminProjectService } from "./life-admin-project-service";
import { LifeAdminTodayService } from "./life-admin-today-service";
import { LifeAdminWorkshopService, type LifeAdminWorkshopDeps } from "./life-admin-workshop-service";

export interface LifeAdminSubServices {
  links: LifeAdminLinksService;
  project: LifeAdminProjectService;
  workshop: LifeAdminWorkshopService;
  contract: LifeAdminContractService;
  hardware: LifeAdminHardwareService;
  capture: LifeAdminCaptureService;
  brain: LifeAdminBrainService;
  today: LifeAdminTodayService;
}

export function createLifeAdminSubServices(db: PrismaClient): LifeAdminSubServices {
  const links = new LifeAdminLinksService(db);
  const project = new LifeAdminProjectService(db, links);
  const contract = new LifeAdminContractService(db);
  const hardware = new LifeAdminHardwareService(db);

  const captureDeps: LifeAdminCaptureDeps = {
    links,
    project,
    workshop: null as unknown as LifeAdminWorkshopService,
  };
  const workshopDeps: LifeAdminWorkshopDeps = {
    links,
    capture: null as unknown as LifeAdminCaptureService,
  };

  const capture = new LifeAdminCaptureService(db, captureDeps);
  const workshop = new LifeAdminWorkshopService(db, workshopDeps);
  captureDeps.workshop = workshop;
  workshopDeps.capture = capture;

  const brain = new LifeAdminBrainService(db, { links, capture });
  const today = new LifeAdminTodayService(db, {
    capture,
    project,
    workshop,
    contract,
    hardware,
  });

  return { links, project, workshop, contract, hardware, capture, brain, today };
}
