# ADR TODO: Host-side connector capability allowlist

Date: 2026-06-26
Status: proposed follow-up

## Context

The RTX Host Connector reports its local capabilities in every heartbeat. The
host already normalizes reported values with `normalizeCapabilities`, so unknown
strings are discarded before they can affect queue eligibility. That prevents a
connector from inventing a new capability name.

The remaining hardening step is an admin-controlled allowlist. It should prevent
a valid connector token from self-upgrading from, for example, `system_info` to
`audio_local` or `llm_local` without the host owner allowing that connector to
serve those lanes.

This task intentionally did not add the DB migration because it needs a local
`db:generate` verification pass and both SQLite/PostgreSQL schema updates. The
current projectless workspace could not run the local checkout or pnpm checks.

## Proposed design

Add these fields to `Connector`:

- `reportedCapabilities Json? @map("reported_capabilities")`
- `allowedCapabilities Json? @map("allowed_capabilities")`

Keep `capabilities` as the effective capabilities used by existing UI and queue
logic during the migration.

On heartbeat:

1. `reportedCapabilities = normalizeCapabilities(input.capabilities)`
2. `allowedCapabilities = null` means no admin restriction yet.
3. `effectiveCapabilities = reportedCapabilities` when `allowedCapabilities` is
   null; otherwise use the ordered intersection.
4. Store `reportedCapabilities` and effective `capabilities` separately.

On queue claim:

- Continue to read only effective `capabilities` for eligibility.
- `selectNextJob` and `targetCapability` do not need a product-level rewrite.

## Files to change

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/schema.postgresql.prisma`
- `packages/database/prisma/migrations/<timestamp>_connector_allowed_capabilities/migration.sql`
- `packages/database/src/connector-service.ts`
- `packages/database/src/connector-service.test.ts`
- Studio connector settings UI, only after the backend field exists.

## Tests to add

- Heartbeat stores reported capabilities separately from effective capabilities.
- Unknown reported capabilities are discarded.
- A connector reporting `audio_local` cannot claim `sound_play` when
  `allowedCapabilities` omits `audio_local`.
- An empty allowlist blocks all connector-served jobs for that connector.

## Current guardrail

Until this migration lands, host-side tests assert that unknown reported
capabilities normalize to `[]` and cannot unlock queue claims.
