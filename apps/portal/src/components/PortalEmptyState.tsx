import { EmptyState } from "@/src/components/ui/states";

const DEFAULT_DESCRIPTION =
  "Für deine Rolle sind hier noch keine Inhalte freigegeben. Wende dich an deinen Spielleiter.";

interface PortalEmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export function PortalEmptyState({
  title,
  description = DEFAULT_DESCRIPTION,
  icon = "inbox",
}: PortalEmptyStateProps) {
  return <EmptyState icon={icon} title={title} description={description} />;
}
