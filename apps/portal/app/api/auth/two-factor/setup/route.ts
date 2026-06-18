import { handleTwoFactorSetup } from "@/src/lib/two-factor-routes";

export async function POST(request: Request) {
  return handleTwoFactorSetup(request);
}
