import { createAiGatewayService, prisma } from "@uwe/database/server";
import type { AuthUser } from "@uwe/auth";

const AI_CHAT_BLOCKED_MESSAGE =
  "KI-Chat ist für deinen Account nicht freigeschaltet. Bitte den Master-Admin, dir AI-Freigaben unter KI & RTX Fallback zu vergeben.";

export async function resolveAiChatAccess(user: AuthUser | null): Promise<{
  allowed: boolean;
  message: string;
}> {
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
  if (!grant?.permissions.includes("AI_CHAT_USE")) {
    return { allowed: false, message: AI_CHAT_BLOCKED_MESSAGE };
  }

  return { allowed: true, message: "" };
}
