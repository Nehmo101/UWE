import { listCookbookEngines } from "./engine-registry";
import { detectHardwareProfile } from "./hardware-profile";
import { listCookbookModels } from "./model-registry";
import { buildCookbookRecommendations } from "./recommendations";
import { buildCookbookRoutingHints, mapTaskToUseCase } from "./routing-hints";
import { buildCookbookRuntimeHealth } from "./runtime-health";
import type {
  CookbookAiContextMode,
  CookbookAiProviderMode,
  CookbookAiTaskType,
  CookbookRuntimeProbeInput,
} from "./ai-types";
import type { CookbookDashboard } from "./types";

export interface CookbookServiceOptions {
  probe: CookbookRuntimeProbeInput;
  localOnlyMode?: boolean;
  env?: NodeJS.ProcessEnv;
  skipDocker?: boolean;
}

export async function getCookbookDashboard(
  options: CookbookServiceOptions,
): Promise<CookbookDashboard> {
  const hardware = await detectHardwareProfile({ env: options.env });
  const runtime = await buildCookbookRuntimeHealth(options.probe, {
    localOnlyMode: options.localOnlyMode,
    env: options.env,
  });
  const installedModels = runtime.ollama.models;
  const recommendations = buildCookbookRecommendations(hardware, installedModels);

  const routingHints = buildCookbookRoutingHints({
    providerMode: "auto",
    contextMode: "current_object_plus_brain",
    taskType: "improve_lore_text",
    localOnlyMode: runtime.localOnlyMode,
    rtxReady: runtime.ok,
    hardware,
    installedModels,
  });

  return {
    hardware,
    installedModels,
    registry: listCookbookModels(),
    engines: listCookbookEngines(),
    recommendations,
    runtime,
    routingHints,
  };
}

export async function getCookbookRoutingContext(input: {
  providerMode: CookbookAiProviderMode;
  contextMode: CookbookAiContextMode;
  taskType: CookbookAiTaskType;
  probe: CookbookRuntimeProbeInput;
  localOnlyMode?: boolean;
  rtxReady?: boolean;
  explicitModel?: string;
}) {
  const hardware = await detectHardwareProfile();
  const runtime = await buildCookbookRuntimeHealth(input.probe, {
    localOnlyMode: input.localOnlyMode,
  });
  const installedModels = runtime.ollama.models;

  return {
    hardware,
    installedModels,
    hints: buildCookbookRoutingHints({
      providerMode: input.providerMode,
      contextMode: input.contextMode,
      taskType: input.taskType,
      localOnlyMode: input.localOnlyMode ?? runtime.localOnlyMode,
      rtxReady: input.rtxReady ?? runtime.ok,
      hardware,
      installedModels,
      explicitModel: input.explicitModel,
    }),
    useCase: mapTaskToUseCase(input.taskType),
  };
}
