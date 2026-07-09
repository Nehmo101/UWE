export type FirstRunCheckStatus = "ok" | "warning" | "error";

export interface FirstRunPrerequisiteItem {
  id: "setup-token" | "auth-secret" | "migrations";
  label: string;
  status: FirstRunCheckStatus;
  message: string;
  hint?: string;
}

export interface FirstRunPrerequisites {
  ok: boolean;
  canProceed: boolean;
  items: FirstRunPrerequisiteItem[];
}

export interface FirstRunProductionHint {
  id: string;
  title: string;
  description: string;
  status: FirstRunCheckStatus;
  envKey?: string;
}

export interface FirstRunProductionHints {
  items: FirstRunProductionHint[];
}

export interface FirstRunSetupStatus {
  prerequisites: FirstRunPrerequisites;
  productionHints: FirstRunProductionHints;
}
