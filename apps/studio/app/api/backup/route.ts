import { getBackupList, postBackupCreate } from "../../../src/lib/backup-handlers";

export async function GET() {
  return getBackupList();
}

export async function POST(request: Request) {
  const body = await request.json();
  return postBackupCreate(body);
}
