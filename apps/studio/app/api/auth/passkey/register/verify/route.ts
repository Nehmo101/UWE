import { handlePasskeyRegisterVerify } from "@/src/lib/passkey-routes";

export async function POST(request: Request) {
  return handlePasskeyRegisterVerify(request);
}
