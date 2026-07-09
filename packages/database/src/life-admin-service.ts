import type { PrismaClient } from "./client";
import {
  createLifeAdminSubServices,
  type LifeAdminSubServices,
} from "./life-admin/create-life-admin-sub-services";

export type {
  CaptureEntry,
  CaptureStatus,
  CaptureType,
  PersonalProject,
  PersonalProjectCategory,
  PersonalProjectStatus,
  WorkshopProject,
  WorkshopProjectType,
  WorkshopStatus,
  ContractExpense,
  ContractExpenseType,
  ContractExpenseSource,
  ContractStatus,
  HardwareDevice,
  HardwareStatus,
  PersonalBrainDocument,
  PersonalBrainFact,
  AdminEntityLink,
  AdminLinkSourceType,
  AdminLinkTargetType,
  GeneratorPreset,
  GeneratorOutput,
  WorkshopPaintRecipe,
  WorkshopPrintProfile,
  WorkshopTerrainRental,
  WorkshopPaintTarget,
  WorkshopRentalStatus,
  ListCapturesOptions,
  CaptureSourceGroup,
  CreateCaptureInput,
  CreatePersonalProjectInput,
  CreateWorkshopProjectInput,
  CreateWorkshopPaintRecipeInput,
  CreateWorkshopPrintProfileInput,
  CreateWorkshopTerrainRentalInput,
  CreateContractExpenseInput,
  CreateHardwareDeviceInput,
  CreatePersonalBrainDocumentInput,
  CreatePersonalBrainFactInput,
  PromoteCaptureToLifeBrainInput,
  PersonalBrainDocumentDetail,
  PersonalBrainFactDetail,
  PersonalBrainSearchOptions,
  PersonalBrainSearchResult,
  CreateAdminLinkInput,
  CreateGeneratorPresetInput,
  CreateGeneratorOutputInput,
  PersonalProjectCategorySummary,
  PersonalProjectDashboardStats,
} from "./life-admin/life-admin-types";

export type { PersonalProjectDetail } from "./life-admin/life-admin-project-service";
export type { TodayAdminSummary } from "./life-admin/life-admin-today-service";
export type { WorkshopOpenTask } from "./life-admin/life-admin-types";

export {
  CaptureStatusEnum,
  CaptureTypeEnum,
  PersonalProjectStatusEnum,
  PersonalProjectCategoryEnum,
  WorkshopStatusEnum,
  WorkshopProjectTypeEnum,
  ContractStatusEnum,
  ContractExpenseTypeEnum,
  ContractExpenseSourceEnum,
  ContractBillingIntervalEnum,
  HardwareStatusEnum,
  AdminLinkSourceTypeEnum,
  AdminLinkTargetTypeEnum,
  WorkshopPaintTargetEnum,
  WorkshopRentalStatusEnum,
  CAPTURE_TYPE_LABELS,
  CAPTURE_STATUS_LABELS,
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  PROJECT_CATEGORY_LABELS,
  WORKSHOP_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_CATEGORY_ORDER,
  PROJECT_ACTIVE_STATUSES,
  PROJECT_OPEN_STATUSES,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_STATUS_FLOW,
  getNextWorkshopStatus,
  WORKSHOP_PAINT_TARGET_LABELS,
  WORKSHOP_RENTAL_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  HARDWARE_STATUS_LABELS,
} from "./life-admin/life-admin-types";

export class LifeAdminService {
  private readonly capture: LifeAdminSubServices["capture"];
  private readonly project: LifeAdminSubServices["project"];
  private readonly workshop: LifeAdminSubServices["workshop"];
  private readonly contract: LifeAdminSubServices["contract"];
  private readonly hardware: LifeAdminSubServices["hardware"];
  private readonly brain: LifeAdminSubServices["brain"];
  private readonly links: LifeAdminSubServices["links"];
  private readonly today: LifeAdminSubServices["today"];

  constructor(db: PrismaClient) {
    const services = createLifeAdminSubServices(db);
    this.capture = services.capture;
    this.project = services.project;
    this.workshop = services.workshop;
    this.contract = services.contract;
    this.hardware = services.hardware;
    this.brain = services.brain;
    this.links = services.links;
    this.today = services.today;
  }

  listCaptures(...args: Parameters<LifeAdminSubServices["capture"]["listCaptures"]>) {
    return this.capture.listCaptures(...args);
  }
  getCapture(...args: Parameters<LifeAdminSubServices["capture"]["getCapture"]>) {
    return this.capture.getCapture(...args);
  }
  createCapture(...args: Parameters<LifeAdminSubServices["capture"]["createCapture"]>) {
    return this.capture.createCapture(...args);
  }
  updateCapture(...args: Parameters<LifeAdminSubServices["capture"]["updateCapture"]>) {
    return this.capture.updateCapture(...args);
  }
  deleteCapture(...args: Parameters<LifeAdminSubServices["capture"]["deleteCapture"]>) {
    return this.capture.deleteCapture(...args);
  }
  archiveCaptures(...args: Parameters<LifeAdminSubServices["capture"]["archiveCaptures"]>) {
    return this.capture.archiveCaptures(...args);
  }
  getCaptureStatusCounts(...args: Parameters<LifeAdminSubServices["capture"]["getCaptureStatusCounts"]>) {
    return this.capture.getCaptureStatusCounts(...args);
  }
  convertCaptureToProject(...args: Parameters<LifeAdminSubServices["capture"]["convertCaptureToProject"]>) {
    return this.capture.convertCaptureToProject(...args);
  }
  convertCaptureToWorkshop(...args: Parameters<LifeAdminSubServices["capture"]["convertCaptureToWorkshop"]>) {
    return this.capture.convertCaptureToWorkshop(...args);
  }
  listPersonalProjects(...args: Parameters<LifeAdminSubServices["project"]["listPersonalProjects"]>) {
    return this.project.listPersonalProjects(...args);
  }
  createPersonalProject(...args: Parameters<LifeAdminSubServices["project"]["createPersonalProject"]>) {
    return this.project.createPersonalProject(...args);
  }
  getPersonalProject(...args: Parameters<LifeAdminSubServices["project"]["getPersonalProject"]>) {
    return this.project.getPersonalProject(...args);
  }
  getPersonalProjectDetail(...args: Parameters<LifeAdminSubServices["project"]["getPersonalProjectDetail"]>) {
    return this.project.getPersonalProjectDetail(...args);
  }
  updatePersonalProject(...args: Parameters<LifeAdminSubServices["project"]["updatePersonalProject"]>) {
    return this.project.updatePersonalProject(...args);
  }
  deletePersonalProject(...args: Parameters<LifeAdminSubServices["project"]["deletePersonalProject"]>) {
    return this.project.deletePersonalProject(...args);
  }
  getPersonalProjectDashboardStats(...args: Parameters<LifeAdminSubServices["project"]["getPersonalProjectDashboardStats"]>) {
    return this.project.getPersonalProjectDashboardStats(...args);
  }
  addProjectStep(...args: Parameters<LifeAdminSubServices["project"]["addProjectStep"]>) {
    return this.project.addProjectStep(...args);
  }
  setProjectStepDone(...args: Parameters<LifeAdminSubServices["project"]["setProjectStepDone"]>) {
    return this.project.setProjectStepDone(...args);
  }
  updateProjectStepTitle(...args: Parameters<LifeAdminSubServices["project"]["updateProjectStepTitle"]>) {
    return this.project.updateProjectStepTitle(...args);
  }
  deleteProjectStep(...args: Parameters<LifeAdminSubServices["project"]["deleteProjectStep"]>) {
    return this.project.deleteProjectStep(...args);
  }
  addProjectImage(...args: Parameters<LifeAdminSubServices["project"]["addProjectImage"]>) {
    return this.project.addProjectImage(...args);
  }
  getProjectImage(...args: Parameters<LifeAdminSubServices["project"]["getProjectImage"]>) {
    return this.project.getProjectImage(...args);
  }
  deleteProjectImage(...args: Parameters<LifeAdminSubServices["project"]["deleteProjectImage"]>) {
    return this.project.deleteProjectImage(...args);
  }
  listWorkshopProjects(...args: Parameters<LifeAdminSubServices["workshop"]["listWorkshopProjects"]>) {
    return this.workshop.listWorkshopProjects(...args);
  }
  getWorkshopStatusCounts(...args: Parameters<LifeAdminSubServices["workshop"]["getWorkshopStatusCounts"]>) {
    return this.workshop.getWorkshopStatusCounts(...args);
  }
  getWorkshopFilterCounts(...args: Parameters<LifeAdminSubServices["workshop"]["getWorkshopFilterCounts"]>) {
    return this.workshop.getWorkshopFilterCounts(...args);
  }
  advanceWorkshopStatus(...args: Parameters<LifeAdminSubServices["workshop"]["advanceWorkshopStatus"]>) {
    return this.workshop.advanceWorkshopStatus(...args);
  }
  createWorkshopProject(...args: Parameters<LifeAdminSubServices["workshop"]["createWorkshopProject"]>) {
    return this.workshop.createWorkshopProject(...args);
  }
  getWorkshopProject(...args: Parameters<LifeAdminSubServices["workshop"]["getWorkshopProject"]>) {
    return this.workshop.getWorkshopProject(...args);
  }
  updateWorkshopProject(...args: Parameters<LifeAdminSubServices["workshop"]["updateWorkshopProject"]>) {
    return this.workshop.updateWorkshopProject(...args);
  }
  deleteWorkshopProject(...args: Parameters<LifeAdminSubServices["workshop"]["deleteWorkshopProject"]>) {
    return this.workshop.deleteWorkshopProject(...args);
  }
  listWorkshopOpenTasks(...args: Parameters<LifeAdminSubServices["workshop"]["listWorkshopOpenTasks"]>) {
    return this.workshop.listWorkshopOpenTasks(...args);
  }
  promoteCaptureToWorkshop(...args: Parameters<LifeAdminSubServices["workshop"]["promoteCaptureToWorkshop"]>) {
    return this.workshop.promoteCaptureToWorkshop(...args);
  }
  listWorkshopPaintRecipes(...args: Parameters<LifeAdminSubServices["workshop"]["listWorkshopPaintRecipes"]>) {
    return this.workshop.listWorkshopPaintRecipes(...args);
  }
  createWorkshopPaintRecipe(...args: Parameters<LifeAdminSubServices["workshop"]["createWorkshopPaintRecipe"]>) {
    return this.workshop.createWorkshopPaintRecipe(...args);
  }
  updateWorkshopPaintRecipe(...args: Parameters<LifeAdminSubServices["workshop"]["updateWorkshopPaintRecipe"]>) {
    return this.workshop.updateWorkshopPaintRecipe(...args);
  }
  deleteWorkshopPaintRecipe(...args: Parameters<LifeAdminSubServices["workshop"]["deleteWorkshopPaintRecipe"]>) {
    return this.workshop.deleteWorkshopPaintRecipe(...args);
  }
  listWorkshopPrintProfiles(...args: Parameters<LifeAdminSubServices["workshop"]["listWorkshopPrintProfiles"]>) {
    return this.workshop.listWorkshopPrintProfiles(...args);
  }
  createWorkshopPrintProfile(...args: Parameters<LifeAdminSubServices["workshop"]["createWorkshopPrintProfile"]>) {
    return this.workshop.createWorkshopPrintProfile(...args);
  }
  updateWorkshopPrintProfile(...args: Parameters<LifeAdminSubServices["workshop"]["updateWorkshopPrintProfile"]>) {
    return this.workshop.updateWorkshopPrintProfile(...args);
  }
  deleteWorkshopPrintProfile(...args: Parameters<LifeAdminSubServices["workshop"]["deleteWorkshopPrintProfile"]>) {
    return this.workshop.deleteWorkshopPrintProfile(...args);
  }
  listWorkshopTerrainRentals(...args: Parameters<LifeAdminSubServices["workshop"]["listWorkshopTerrainRentals"]>) {
    return this.workshop.listWorkshopTerrainRentals(...args);
  }
  createWorkshopTerrainRental(...args: Parameters<LifeAdminSubServices["workshop"]["createWorkshopTerrainRental"]>) {
    return this.workshop.createWorkshopTerrainRental(...args);
  }
  updateWorkshopTerrainRental(...args: Parameters<LifeAdminSubServices["workshop"]["updateWorkshopTerrainRental"]>) {
    return this.workshop.updateWorkshopTerrainRental(...args);
  }
  deleteWorkshopTerrainRental(...args: Parameters<LifeAdminSubServices["workshop"]["deleteWorkshopTerrainRental"]>) {
    return this.workshop.deleteWorkshopTerrainRental(...args);
  }
  listContractExpenses(...args: Parameters<LifeAdminSubServices["contract"]["listContractExpenses"]>) {
    return this.contract.listContractExpenses(...args);
  }
  createContractExpense(...args: Parameters<LifeAdminSubServices["contract"]["createContractExpense"]>) {
    return this.contract.createContractExpense(...args);
  }
  getContractExpense(...args: Parameters<LifeAdminSubServices["contract"]["getContractExpense"]>) {
    return this.contract.getContractExpense(...args);
  }
  updateContractExpense(...args: Parameters<LifeAdminSubServices["contract"]["updateContractExpense"]>) {
    return this.contract.updateContractExpense(...args);
  }
  deleteContractExpense(...args: Parameters<LifeAdminSubServices["contract"]["deleteContractExpense"]>) {
    return this.contract.deleteContractExpense(...args);
  }
  getAiUsageCostRollups(...args: Parameters<LifeAdminSubServices["contract"]["getAiUsageCostRollups"]>) {
    return this.contract.getAiUsageCostRollups(...args);
  }
  syncAiUsageContractExpense(...args: Parameters<LifeAdminSubServices["contract"]["syncAiUsageContractExpense"]>) {
    return this.contract.syncAiUsageContractExpense(...args);
  }
  listHardwareDevices(...args: Parameters<LifeAdminSubServices["hardware"]["listHardwareDevices"]>) {
    return this.hardware.listHardwareDevices(...args);
  }
  getHardwareFilterCounts(...args: Parameters<LifeAdminSubServices["hardware"]["getHardwareFilterCounts"]>) {
    return this.hardware.getHardwareFilterCounts(...args);
  }
  createHardwareDevice(...args: Parameters<LifeAdminSubServices["hardware"]["createHardwareDevice"]>) {
    return this.hardware.createHardwareDevice(...args);
  }
  getHardwareDevice(...args: Parameters<LifeAdminSubServices["hardware"]["getHardwareDevice"]>) {
    return this.hardware.getHardwareDevice(...args);
  }
  updateHardwareDevice(...args: Parameters<LifeAdminSubServices["hardware"]["updateHardwareDevice"]>) {
    return this.hardware.updateHardwareDevice(...args);
  }
  toggleHardwareSetupStep(...args: Parameters<LifeAdminSubServices["hardware"]["toggleHardwareSetupStep"]>) {
    return this.hardware.toggleHardwareSetupStep(...args);
  }
  addHardwareErrorEntry(...args: Parameters<LifeAdminSubServices["hardware"]["addHardwareErrorEntry"]>) {
    return this.hardware.addHardwareErrorEntry(...args);
  }
  recordHardwareCheck(...args: Parameters<LifeAdminSubServices["hardware"]["recordHardwareCheck"]>) {
    return this.hardware.recordHardwareCheck(...args);
  }
  deleteHardwareDevice(...args: Parameters<LifeAdminSubServices["hardware"]["deleteHardwareDevice"]>) {
    return this.hardware.deleteHardwareDevice(...args);
  }
  listPersonalBrainDocuments(...args: Parameters<LifeAdminSubServices["brain"]["listPersonalBrainDocuments"]>) {
    return this.brain.listPersonalBrainDocuments(...args);
  }
  listAllPersonalBrainDocuments(...args: Parameters<LifeAdminSubServices["brain"]["listAllPersonalBrainDocuments"]>) {
    return this.brain.listAllPersonalBrainDocuments(...args);
  }
  listAllPersonalBrainFacts(...args: Parameters<LifeAdminSubServices["brain"]["listAllPersonalBrainFacts"]>) {
    return this.brain.listAllPersonalBrainFacts(...args);
  }
  searchPersonalBrain(...args: Parameters<LifeAdminSubServices["brain"]["searchPersonalBrain"]>) {
    return this.brain.searchPersonalBrain(...args);
  }
  listPersonalBrainTags(...args: Parameters<LifeAdminSubServices["brain"]["listPersonalBrainTags"]>) {
    return this.brain.listPersonalBrainTags(...args);
  }
  searchPersonalBrainDocumentsForContext(...args: Parameters<LifeAdminSubServices["brain"]["searchPersonalBrainDocumentsForContext"]>) {
    return this.brain.searchPersonalBrainDocumentsForContext(...args);
  }
  searchPersonalBrainFactsForContext(...args: Parameters<LifeAdminSubServices["brain"]["searchPersonalBrainFactsForContext"]>) {
    return this.brain.searchPersonalBrainFactsForContext(...args);
  }
  getPersonalBrainDocumentDetail(...args: Parameters<LifeAdminSubServices["brain"]["getPersonalBrainDocumentDetail"]>) {
    return this.brain.getPersonalBrainDocumentDetail(...args);
  }
  getPersonalBrainFactDetail(...args: Parameters<LifeAdminSubServices["brain"]["getPersonalBrainFactDetail"]>) {
    return this.brain.getPersonalBrainFactDetail(...args);
  }
  promoteCaptureToLifeBrain(...args: Parameters<LifeAdminSubServices["brain"]["promoteCaptureToLifeBrain"]>) {
    return this.brain.promoteCaptureToLifeBrain(...args);
  }
  createPersonalBrainDocument(...args: Parameters<LifeAdminSubServices["brain"]["createPersonalBrainDocument"]>) {
    return this.brain.createPersonalBrainDocument(...args);
  }
  getPersonalBrainDocument(...args: Parameters<LifeAdminSubServices["brain"]["getPersonalBrainDocument"]>) {
    return this.brain.getPersonalBrainDocument(...args);
  }
  updatePersonalBrainDocument(...args: Parameters<LifeAdminSubServices["brain"]["updatePersonalBrainDocument"]>) {
    return this.brain.updatePersonalBrainDocument(...args);
  }
  deletePersonalBrainDocument(...args: Parameters<LifeAdminSubServices["brain"]["deletePersonalBrainDocument"]>) {
    return this.brain.deletePersonalBrainDocument(...args);
  }
  listPersonalBrainFacts(...args: Parameters<LifeAdminSubServices["brain"]["listPersonalBrainFacts"]>) {
    return this.brain.listPersonalBrainFacts(...args);
  }
  createPersonalBrainFact(...args: Parameters<LifeAdminSubServices["brain"]["createPersonalBrainFact"]>) {
    return this.brain.createPersonalBrainFact(...args);
  }
  getPersonalBrainFact(...args: Parameters<LifeAdminSubServices["brain"]["getPersonalBrainFact"]>) {
    return this.brain.getPersonalBrainFact(...args);
  }
  updatePersonalBrainFact(...args: Parameters<LifeAdminSubServices["brain"]["updatePersonalBrainFact"]>) {
    return this.brain.updatePersonalBrainFact(...args);
  }
  deletePersonalBrainFact(...args: Parameters<LifeAdminSubServices["brain"]["deletePersonalBrainFact"]>) {
    return this.brain.deletePersonalBrainFact(...args);
  }
  listLinkedCapturesForTarget(...args: Parameters<LifeAdminSubServices["links"]["listLinkedCapturesForTarget"]>) {
    return this.links.listLinkedCapturesForTarget(...args);
  }
  ensureDefaultGeneratorPresets(...args: Parameters<LifeAdminSubServices["links"]["ensureDefaultGeneratorPresets"]>) {
    return this.links.ensureDefaultGeneratorPresets(...args);
  }
  createAdminLink(...args: Parameters<LifeAdminSubServices["links"]["createAdminLink"]>) {
    return this.links.createAdminLink(...args);
  }
  listLinksForSource(...args: Parameters<LifeAdminSubServices["links"]["listLinksForSource"]>) {
    return this.links.listLinksForSource(...args);
  }
  listLinksForTarget(...args: Parameters<LifeAdminSubServices["links"]["listLinksForTarget"]>) {
    return this.links.listLinksForTarget(...args);
  }
  listGeneratorPresets(...args: Parameters<LifeAdminSubServices["links"]["listGeneratorPresets"]>) {
    return this.links.listGeneratorPresets(...args);
  }
  getGeneratorPreset(...args: Parameters<LifeAdminSubServices["links"]["getGeneratorPreset"]>) {
    return this.links.getGeneratorPreset(...args);
  }
  createGeneratorPreset(...args: Parameters<LifeAdminSubServices["links"]["createGeneratorPreset"]>) {
    return this.links.createGeneratorPreset(...args);
  }
  listGeneratorOutputs(...args: Parameters<LifeAdminSubServices["links"]["listGeneratorOutputs"]>) {
    return this.links.listGeneratorOutputs(...args);
  }
  createGeneratorOutput(...args: Parameters<LifeAdminSubServices["links"]["createGeneratorOutput"]>) {
    return this.links.createGeneratorOutput(...args);
  }
  getTodaySummary(...args: Parameters<LifeAdminSubServices["today"]["getTodaySummary"]>) {
    return this.today.getTodaySummary(...args);
  }
}

export function createLifeAdminService(db: PrismaClient): LifeAdminService {
  return new LifeAdminService(db);
}
