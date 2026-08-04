import { createAiGatewayService, prisma } from "@uwe/database/server";
import type { AuthUser } from "@uwe/auth";

const AI_CHAT_BLOCKED_MESSAGE =
  "KI-Chat ist für deinen Account nicht freigeschaltet. Bitte den Master-Admin, dir AI-Freigaben unter KI & Maschinenraum Fallback zu vergeben.";

async function resolveGatewayFeatureAccess(
  user: AuthUser | null,
  permission: "AI_CHAT_USE",
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

  // Per-user AI grants existed to ration cloud spend. With the Maschinenraum host as the
  // only backend there is nothing to ration: whoever reaches the app may use it.
  void permission;
  void blockedMessage;
  return { allowed: true, message: "" };
}

export async function resolveAiChatAccess(user: AuthUser | null): Promise<{
  allowed: boolean;
  message: string;
}> {
  return resolveGatewayFeatureAccess(user, "AI_CHAT_USE", AI_CHAT_BLOCKED_MESSAGE);
}
