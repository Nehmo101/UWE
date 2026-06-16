import { NextResponse } from "next/server";
import {
  createImageStudioService,
  createJobService,
  getAppRepository,
  prisma,
  resolveImageStudioConfig,
} from "@uwe/database/server";
import {
  guardStudioMutation,
  nonEmptyString,
  optionalString,
  parseBody,
  requireStudioApiAuth,
  slugSchema,
} from "@uwe/security";
import { dispatchJob } from "@/src/lib/job-executor";
import { z } from "zod";

const imageStudioCreateSchema = z.object({
  worldSlug: slugSchema,
  title: optionalString,
  prompt: nonEmptyString.max(10_000),
  task: z.enum(["generate", "edit", "inpaint", "remove_background", "variant"]),
  providerMode: optionalString,
  linkTargetType: optionalString,
  linkTargetId: optionalString,
});

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
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
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const config = resolveImageStudioConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Image Studio ist deaktiviert." }, { status: 403 });
  }

  const parsed = await parseBody(request, imageStudioCreateSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(body.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
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
      body.linkTargetType as "page" | "asset" | "label" | "game_session" | "handout" | "brain_document" | "capture",
      body.linkTargetId,
    );
  }

  await imageStudio.updateProjectStatus(project.id, "processing");

  const jobs = createJobService(prisma);
  const job = await jobs.enqueue({
    type: "image_studio",
    title: `Image Studio: ${body.task}`,
    worldId: world.id,
    worldSlug: world.slug,
    payload: {
      projectId: project.id,
      worldId: world.id,
      worldSlug: world.slug,
      task: body.task,
      prompt: body.prompt,
      providerMode: body.providerMode,
      title: body.title,
    },
    relatedType: "image_studio_project",
    relatedId: project.id,
  });

  void dispatchJob(job.id);

  return NextResponse.json({ project, jobId: job.id }, { status: 201 });
}
