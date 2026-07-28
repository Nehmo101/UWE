import { handleGoogleCallback } from "@/src/lib/google-login-routes";

export async function GET(request: Request) {
  return handleGoogleCallback(request);
}
