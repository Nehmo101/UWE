import type { RoleCapabilityMatrixRow } from "@uwe/auth";

export interface CapabilityGroupView {
  id: string;
  title: string;
  rows: RoleCapabilityMatrixRow[];
}

const CAPABILITY_GROUP_DEFS: Array<{ id: string; title: string; capabilities: string[] }> = [
  {
    id: "system",
    title: "System & Admin",
    capabilities: [
      "system_admin",
      "user_management",
      "security_settings",
      "backup_restore",
      "calendar_admin",
      "api_tokens",
    ],
  },
  {
    id: "studio",
    title: "Studio",
    capabilities: ["studio_access"],
  },
  {
    id: "world",
    title: "Welt & Kampagne",
    capabilities: [
      "world_read",
      "world_edit",
      "canon_edit",
      "session_manage",
      "handout_manage",
      "player_manage",
    ],
  },
  {
    id: "ai",
    title: "KI & Reviews",
    capabilities: ["ai_use", "ai_review", "review_approve", "proposal_submit"],
  },
  {
    id: "player",
    title: "Spieler & Portal",
    capabilities: ["player_note_edit_own", "player_note_moderate", "portal_unlock_grant"],
  },
];

export function groupCapabilityRows(matrix: RoleCapabilityMatrixRow[]): CapabilityGroupView[] {
  const byCapability = new Map(matrix.map((row) => [row.capability, row]));
  const assigned = new Set<string>();

  const groups: CapabilityGroupView[] = CAPABILITY_GROUP_DEFS.map((group) => {
    const rows: RoleCapabilityMatrixRow[] = [];
    for (const cap of group.capabilities) {
      const row = byCapability.get(cap as RoleCapabilityMatrixRow["capability"]);
      if (row) {
        rows.push(row);
        assigned.add(cap);
      }
    }
    return { id: group.id, title: group.title, rows };
  }).filter((group) => group.rows.length > 0);

  const otherRows = matrix.filter((row) => !assigned.has(row.capability));
  if (otherRows.length > 0) {
    groups.push({ id: "other", title: "Weitere", rows: otherRows });
  }

  return groups;
}
