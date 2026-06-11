import { postRestorePreview } from "../../../../../src/lib/backup-handlers";

export async function POST(request: Request) {
  const body = await request.json();
  return postRestorePreview(body);
}
