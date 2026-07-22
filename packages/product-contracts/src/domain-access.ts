// Audience x DataDomain access matrix. Canonical spec: docs/rework/three-product-split/02-domain-contracts.md §3.

import type { AppAudience, DataDomain } from "./domain-boundaries";

export const DOMAIN_ACCESS_MODE = {
  none: "none",
  read: "read",
  readWrite: "read_write",
  filteredProjection: "filtered_projection",
  scopedPort: "scoped_port",
  opaqueOrchestration: "opaque_orchestration",
} as const;

export type DomainAccessMode =
  (typeof DOMAIN_ACCESS_MODE)[keyof typeof DOMAIN_ACCESS_MODE];

const N = DOMAIN_ACCESS_MODE.none;
const R = DOMAIN_ACCESS_MODE.read;
const RW = DOMAIN_ACCESS_MODE.readWrite;
const FP = DOMAIN_ACCESS_MODE.filteredProjection;
const SP = DOMAIN_ACCESS_MODE.scopedPort;
const OO = DOMAIN_ACCESS_MODE.opaqueOrchestration;

export const AUDIENCE_DOMAIN_ACCESS = {
  portal: {
    dnd_world: FP, dnd_brain: N, portal_player: SP, personal_brain: N,
    admin_life: N, platform_auth: SP, platform_ops: N, assets: FP,
    jobs: SP, integrations: N, ai_control: N, shared_reference: R,
  },
  studio: {
    dnd_world: RW, dnd_brain: RW, portal_player: SP, personal_brain: N,
    admin_life: N, platform_auth: SP, platform_ops: N, assets: RW,
    jobs: SP, integrations: SP, ai_control: SP, shared_reference: R,
  },
  brain: {
    dnd_world: N, dnd_brain: N, portal_player: N, personal_brain: RW,
    admin_life: RW, platform_auth: SP, platform_ops: N, assets: N,
    jobs: SP, integrations: N, ai_control: SP, shared_reference: N,
  },
  platform: {
    dnd_world: OO, dnd_brain: OO, portal_player: OO, personal_brain: OO,
    admin_life: OO, platform_auth: RW, platform_ops: RW, assets: OO,
    jobs: RW, integrations: RW, ai_control: RW, shared_reference: RW,
  },
} as const satisfies Record<AppAudience, Record<DataDomain, DomainAccessMode>>;

export function getDomainAccess(
  audience: AppAudience,
  domain: DataDomain,
): DomainAccessMode {
  return AUDIENCE_DOMAIN_ACCESS[audience][domain];
}
