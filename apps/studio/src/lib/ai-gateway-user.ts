import { prisma } from "@uwe/database/server";
import type { AiGatewayUserContext } from "@uwe/ai-brain";
import type { AuthUser } from "@uwe/auth";

export function toGatewayUser(user: AuthUser): AiGatewayUserContext {
  return { userId: user.id };
}

export async function resolveGatewayUserById(
  userId: string | null | undefined,
): Promise<AiGatewayUserContext | null> {
  if (!userId?.trim()) {
    return null;
  }

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!row) {
    return null;
  }

  return { userId: row.id };
}
