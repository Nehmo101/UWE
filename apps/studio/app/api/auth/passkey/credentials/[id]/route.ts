import { handlePasskeyDelete } from "@/src/lib/passkey-routes";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handlePasskeyDelete(request, id);
}
