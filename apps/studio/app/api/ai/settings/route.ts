import { getSettings } from "../../../../src/lib/ai-handlers";

export async function GET() {
  return getSettings();
}
