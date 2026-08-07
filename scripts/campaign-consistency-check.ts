import { checkCampaignConsistency, createPrismaClient } from "@uwe/database/server";

async function main(): Promise<void> {
  const db = createPrismaClient();
  try {
    const campaignArg = process.argv.find((argument) => argument.startsWith("--campaign="))?.slice("--campaign=".length);
    const campaign = campaignArg
      ? await db.campaign.findFirst({ where: { OR: [{ id: campaignArg }, { slug: campaignArg }] }, select: { id: true } })
      : null;
    if (campaignArg && !campaign) throw new Error(`Kampagne „${campaignArg}“ nicht gefunden.`);
    const findings = await checkCampaignConsistency(db, { campaignId: campaign?.id });
    if (findings.length === 0) {
      console.log("Kampagnen-Konsistenz: OK");
    } else {
      for (const finding of findings) console.error(`[${finding.code}] ${finding.message}`);
      console.error(`Kampagnen-Konsistenz: ${findings.length} Fehler`);
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

void main();
