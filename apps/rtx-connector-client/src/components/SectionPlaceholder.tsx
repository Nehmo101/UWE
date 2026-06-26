import { CardV2 } from "@uwe/shared-ui";

type SectionPlaceholderProps = {
  title: string;
  phase: string;
  summary: string;
};

export function SectionPlaceholder({ title, phase, summary }: SectionPlaceholderProps) {
  return (
    <CardV2
      title={title}
      footer={
        <p className="connector-muted">
          Diese Ansicht ist fuer spaetere Ausbaustufen reserviert.
        </p>
      }
    >
      <p className="connector-lead">Kommt in {phase}.</p>
      <p className="connector-muted">{summary}</p>
    </CardV2>
  );
}
