import { handleTwoFactorStatus } from "@/src/lib/two-factor-routes";

export async function GET(request: Request) {
  return handleTwoFactorStatus(request);
}
