import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { resolveClientIp } from "@uwe/auth";
import {
  createImageStudioService,
  createJobService,
  getAppRepository,
  prisma,
  resolveImageStudioConfig,
} from "@uwe/database/server";
import { enforceAiAccessPolicy, nonEmptyString, optionalString, parseBody, slugSchema } from "@uwe/security";
import { dispatchJob } from "@/src/lib/job-executor";
import { aiPolicyErrorResponse } from "@/src/lib/ai-security";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { z } from "zod";
import { validateImageContextForProvider } from "@uwe/image-studio";
import type { ImageStudioPromptContextMode } from "@uwe/image-studio";

const imageStudioCreateSchema = z.object({
  worldSlug: slugSchema,
  title: optionalString,
  prompt: nonEmptyString.max(10_000),
  task: z.enum(["generate", "edit", "inpaint", "remove_background", "variant"]),
  providerMode: optionalString,
  linkTargetType: optionalString,
  linkTargetId: optionalString,
  contextMode: z.enum(["prompt_only", "page_context", "brain_context", "object_context"]).optional(),
  contextSnippet: optionalString,
  cloudContextApproved: z.boolean().optional(),
});

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const worldId = url.searchParams.get("worldId") ?? undefined;
  const imageStudio = createImageStudioService(prisma);
  const projects = await imageStudio.listProjects(worldId);

  return NextResponse.json({
    projects,
    config: resolveImageStudioConfig(),
  });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  try {
    enforceAiAccessPolicy({
      role: "owner",
      studioTrusted: true,
      userKey: resolveClientIp(request.headers),
    });
  } catch (error) {
    return aiPolicyErrorResponse(error);
  }

  const config = resolveImageStudioConfig();
  if (!config.enabled) {
    return jsonError("Image Studio ist deaktiviert.", 403);
  }

  const parsed = await parseBody(request, imageStudioCreateSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const contextMode = (body.contextMode ?? "prompt_only") as ImageStudioPromptContextMode;

  if (body.providerMode === "cloud" || config.allowCloud) {
    try {
      validateImageContextForProvider("cloud", contextMode, {
        cloudContextApproved: body.cloudContextApproved,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Datenschutzfehler" },
        { status: 403 },
      );
    }
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(body.worldSlug);
  if (!world) {
    return jsonError("Welt nicht gefunden.", 404);
  }

  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.createProject({
    worldId: world.id,
    title: body.title ?? `Image Studio — ${body.task}`,
    prompt: body.prompt,
  });

  if (body.linkTargetType && body.linkTargetId) {
    await imageStudio.linkProject(
      project.id,
      body.linkTargetType as
        | "page"
        | "asset"
        | "label"
        | "game_session"
        | "handout"
        | "brain_document"
        | "capture"
        | "workshop_project"
        | "hardware_device"
        | "contract_expense",
      body.linkTargetId,
    );
  }

  await imageStudio.updateProjectStatus(project.id, "processing");

  const actor = await getCurrentAuthUser();
  const jobs = createJobService(prisma);
  const job = await jobs.enqueue({
    type: "image_studio",
    title: `Image Studio: ${body.task}`,
    worldId: world.id,
    worldSlug: world.slug,
    userId: actor?.id ?? null,
    payload: {
      projectId: project.id,
      worldId: world.id,
      worldSlug: world.slug,
      task: body.task,
      prompt: body.prompt,
      providerMode: body.providerMode,
      title: body.title,
      contextMode,
      contextSnippet: body.contextSnippet,
      cloudContextApproved: body.cloudContextApproved,
    },
    relatedType: "image_studio_project",
    relatedId: project.id,
  });

  void dispatchJob(job.id);

  return NextResponse.json({ project, jobId: job.id }, { status: 201 });
}
