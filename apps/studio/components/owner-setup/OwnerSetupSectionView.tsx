import Link from "next/link";
import type {
  SetupSectionStatus,
  SetupSettingItem,
  SetupSettingSource,
} from "@uwe/database/server";
import {
  Alert,
  Badge,
  type BadgeProps,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

function sourceBadgeVariant(source: SetupSettingSource): BadgeProps["variant"] {
  if (source === "host-secret") return "danger";
  if (source === "db") return "success";
  return "default";
}

function SourceBadge({ source }: { source: SetupSettingSource }) {
  const label =
    source === "db" ? "Datenbank" : source === "env" ? "Umgebung" : "Host-Secret";
  return <Badge variant={sourceBadgeVariant(source)}>{label}</Badge>;
}

function SettingRow({ item }: { item: SetupSettingItem }) {
  return (
    <tr>
      <td className={TD_CLASS}>
        <strong>{item.label}</strong>
        {item.hostSecretRequired && (
          <Badge variant="danger" className="ml-2">
            Host-Secret erforderlich
          </Badge>
        )}
        {item.description && (
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        )}
      </td>
      <td className={TD_CLASS}>{item.configured ? "✓" : "—"}</td>
      <td className={TD_CLASS}>{item.displayValue}</td>
      <td className={TD_CLASS}>
        <SourceBadge source={item.source} />
      </td>
      <td className={TD_CLASS}>
        {item.href ? (
          <Link href={item.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Öffnen
          </Link>
        ) : item.editable ? (
          "Owner-Formular"
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

interface OwnerSetupSettingsTableProps {
  settings: SetupSettingItem[];
}

export function OwnerSetupSettingsTable({ settings }: OwnerSetupSettingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={TH_CLASS}>Prüfpunkt</th>
            <th className={TH_CLASS}>Status</th>
            <th className={TH_CLASS}>Wert</th>
            <th className={TH_CLASS}>Quelle</th>
            <th className={TH_CLASS}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((item) => (
            <SettingRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sectionBadgeVariant(level: SetupSectionStatus["level"]): BadgeProps["variant"] {
  if (level === "ok") return "success";
  if (level === "disabled") return "default";
  return "warning";
}

interface OwnerSetupSectionViewProps {
  section: SetupSectionStatus;
  children?: React.ReactNode;
}

export function OwnerSetupSectionView({ section, children }: OwnerSetupSectionViewProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{section.title}</CardTitle>
        <Badge variant={sectionBadgeVariant(section.level)}>{section.statusLabel}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{section.message}</p>

        {section.nextSteps.length > 0 && (
          <Alert tone="info" title="Nächste Schritte">
            <ul className="list-disc pl-5">
              {section.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </Alert>
        )}

        <OwnerSetupSettingsTable settings={section.settings} />

        {children}
      </CardContent>
    </Card>
  );
}
