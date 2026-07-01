import {
  createFactionStateService,
  createPrismaClient,
  createWorldCalendarService,
  formatInGameDate,
  listGeneratorActions,
  parseInGameDate,
  parseWorldCalendarMonths,
  resolveGeneratorContextFromPage,
  summarizeFactionStateForUi,
  type PageType,
} from "@uwe/database/server";
import { FactionSimulatorPanel } from "./FactionSimulatorPanel";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  pageId: string;
  pageType: string;
  worldId: string;
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export async function FactionSimulatorSection({
  worldSlug,
  pageSlug,
  pageTitle,
  pageId,
  pageType,
  worldId,
  rtxReady,
  rtxEnabled,
}: Props) {
  if (pageType !== "faction") {
    return null;
  }

  const context = resolveGeneratorContextFromPage({
    pageId,
    pageType: pageType as PageType,
    pageTitle,
    worldId,
    worldSlug,
  });
  const actions = listGeneratorActions(context);
  const action = actions.find((entry) => entry.id === "simulate_faction");
  if (!action) {
    return null;
  }

  const db = createPrismaClient();
  const calendars = createWorldCalendarService(db);
  const factions = createFactionStateService(db);
  const [calendar, factionState] = await Promise.all([
    calendars.getByWorldId(worldId),
    factions.getByPageId(pageId),
  ]);
  await db.$disconnect();

  const months = parseWorldCalendarMonths(calendar?.months);
  const currentDate = parseInGameDate(calendar?.currentDate);
  const currentDateLabel = formatInGameDate(currentDate, months);
  const factionStateSummary = summarizeFactionStateForUi(factionState);

  return (
    <FactionSimulatorPanel
      worldSlug={worldSlug}
      pageSlug={pageSlug}
      pageTitle={pageTitle}
      action={action}
      currentDateLabel={currentDateLabel}
      factionStateSummary={factionStateSummary}
      rtxReady={rtxReady}
      rtxEnabled={rtxEnabled}
    />
  );
}
