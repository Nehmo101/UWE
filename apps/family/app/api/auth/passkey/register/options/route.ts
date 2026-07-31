import { handlePasskeyRegisterOptions } from "@/src/lib/passkey-routes";

export async function POST(request: Request) {
  return handlePasskeyRegisterOptions(request);
}
