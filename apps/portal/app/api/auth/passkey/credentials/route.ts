import { handlePasskeyList } from "@/src/lib/passkey-routes";

export async function GET(request: Request) {
  return handlePasskeyList(request);
}
