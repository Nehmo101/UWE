import { PortalAuthShell } from "@/src/components/PortalAuthShell";

interface ShareGateMessageProps {
  title: string;
  description: string;
}

export function ShareGateMessage({ title, description }: ShareGateMessageProps) {
  return <PortalAuthShell title={title} description={description} />;
}
