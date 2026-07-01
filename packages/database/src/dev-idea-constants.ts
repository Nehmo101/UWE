/** Client-safe DevIdea registry constants (mirrors dev-idea-service labels). */

export const DEV_IDEA_TYPES = ["feature", "bug", "prompt"] as const;
export type DevIdeaTypeId = (typeof DEV_IDEA_TYPES)[number];

export const DEV_IDEA_LIFECYCLES = ["existing", "planned", "broken", "deprecated"] as const;
export type DevIdeaLifecycleId = (typeof DEV_IDEA_LIFECYCLES)[number];

export const DEV_IDEA_TYPE_LABELS: Record<DevIdeaTypeId, string> = {
  feature: "Feature",
  bug: "Bug",
  prompt: "Prompt",
};

export const DEV_IDEA_LIFECYCLE_LABELS: Record<DevIdeaLifecycleId, string> = {
  existing: "Vorhanden",
  planned: "Geplant",
  broken: "Defekt",
  deprecated: "Veraltet",
};

export const DEV_IDEA_MODULES = [
  "studio", "portal", "daily_admin", "dnd", "life_brain", "integrations",
  "auth", "media", "generators", "hosting", "other",
] as const;
export type DevIdeaModuleId = (typeof DEV_IDEA_MODULES)[number];

export const DEV_IDEA_MODULE_LABELS: Record<DevIdeaModuleId, string> = {
  studio: "Studio", portal: "Portal", daily_admin: "Daily Admin OS", dnd: "DnD / Welten",
  life_brain: "Life Brain", integrations: "Integrationen", auth: "Auth / Security",
  media: "Medien / Assets", generators: "Generators / AI", hosting: "Hosting / Deploy", other: "Sonstiges",
};

export const DEV_IDEA_MATURITY_LEVELS = ["stable", "beta", "lab", "deprecated"] as const;
export type DevIdeaMaturityLevelId = (typeof DEV_IDEA_MATURITY_LEVELS)[number];

export const DEV_IDEA_MATURITY_LABELS: Record<DevIdeaMaturityLevelId, string> = {
  stable: "Stable / Core", beta: "Beta", lab: "Lab", deprecated: "Deprecated",
};

export type IdeaWorkspaceView = "all" | "features" | "prompts";
export const IDEA_WORKSPACE_VIEWS: readonly IdeaWorkspaceView[] = ["all", "features", "prompts"];
export const IDEA_WORKSPACE_VIEW_LABELS: Record<IdeaWorkspaceView, string> = {
  all: "Alle", features: "Feature-Registry", prompts: "Prompt-Bibliothek",
};

export function parseIdeaWorkspaceView(value: string | undefined): IdeaWorkspaceView {
  if (value === "features" || value === "prompts") return value;
  return "all";
}
