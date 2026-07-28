import { handlePasskeyLoginVerify } from "@/src/lib/passkey-routes";

export async function POST(request: Request) {
  return handlePasskeyLoginVerify(request);
}
