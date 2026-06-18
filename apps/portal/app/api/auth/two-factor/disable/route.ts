import { handleTwoFactorDisable } from "@/src/lib/two-factor-routes";

export async function POST(request: Request) {
  return handleTwoFactorDisable(request);
}
