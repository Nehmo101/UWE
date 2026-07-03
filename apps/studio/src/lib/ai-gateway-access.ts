import { createAiGatewayService, prisma } from "@uwe/database/server";
import type { AuthUser } from "@uwe/auth";

const AI_CHAT_BLOCKED_MESSAGE =
  "KI-Chat ist für deinen Account nicht freigeschaltet. Bitte den Master-Admin, dir AI-Freigaben unter KI & RTX Fallback zu vergeben.";

const AI_KNOWLEDGE_BLOCKED_MESSAGE =
  "Wissens-KI ist für deinen Account nicht freigeschaltet. Bitte den Master-Admin, dir AI-Freigaben unter KI & RTX Fallback zu vergeben.";

async function resolveGatewayFeatureAccess(
  user: AuthUser | null,
  permission: "AI_CHAT_USE" | "AI_KNOWLEDGE_USE",
  blockedMessage: string,
): Promise<{ allowed: boolean; message: string }> {
  if (!user) {
    return { allowed: false, message: "Bitte anmelden, um KI zu nutzen." };
  }

  const service = createAiGatewayService(prisma);
  const config = await service.getConfig();

  if (config.routingMode === "DISABLED") {
    return { allowed: false, message: "KI ist systemweit deaktiviert." };
  }

  if (user.role === "owner" || user.role === "admin" || user.role === "dm") {
    return { allowed: true, message: "" };
  }

  const grant = await service.getUserGrant(user.id);
  if (!grant?.permissions.includes(permission)) {
    return { allowed: false, message: blockedMessage };
  }

  return { allowed: true, message: "" };
}

export async function resolveAiChatAccess(user: AuthUser | null): Promise<{
  allowed: boolean;
  message: string;
}> {
  return resolveGatewayFeatureAccess(user, "AI_CHAT_USE", AI_CHAT_BLOCKED_MESSAGE);
}

export async function resolveAiKnowledgeAccess(user: AuthUser | null): Promise<{
  allowed: boolean;
  message: string;
}> {
  return resolveGatewayFeatureAccess(user, "AI_KNOWLEDGE_USE", AI_KNOWLEDGE_BLOCKED_MESSAGE);
}
