import { handleGoogleStart } from "@/src/lib/google-login-routes";

export async function GET(request: Request) {
  return handleGoogleStart(request);
}
