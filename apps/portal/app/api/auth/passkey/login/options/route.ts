import { handlePasskeyLoginOptions } from "@/src/lib/passkey-routes";

export async function POST(request: Request) {
  return handlePasskeyLoginOptions(request);
}
