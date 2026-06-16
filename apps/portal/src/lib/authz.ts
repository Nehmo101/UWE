import type { AccessContext } from "@uwe/auth";
import {
  assertCanEditContentWithContext,
  assertCanReadContentWithContext,
  assertCanReadWorldWithContext,
  type ContentAuthTarget,
} from "@uwe/auth";

export function assertPortalCanReadWorld(ctx: AccessContext, worldId: string): void {
  assertCanReadWorldWithContext(ctx, worldId);
}

export function assertPortalCanReadContent(
  ctx: AccessContext,
  content: ContentAuthTarget,
  worldId: string,
): void {
  assertCanReadContentWithContext(ctx, content, worldId);
}

export function assertPortalCanEditContent(
  ctx: AccessContext,
  content: ContentAuthTarget,
  worldId: string,
): void {
  assertCanEditContentWithContext(ctx, content, worldId);
}
