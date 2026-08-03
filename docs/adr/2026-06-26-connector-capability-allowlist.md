# ADR: Host-side connector capability allowlist

Date: 2026-06-26
Status: implemented

## Context

The Maschinenraum reports its local capabilities in every heartbeat. The
host already normalizes reported values with `normalizeCapabilities`, so unknown
strings are discarded before they can affect queue eligibility. That prevents a
connector from inventing a new capability name.

The remaining hardening step was an admin-controlled allowlist. It prevents a
valid connector token from self-upgrading from, for example, `system_info` to
`audio_local` or `llm_local` without the host owner allowing that connector to
serve those lanes.

## Decision

The host now keeps reported and effective capabilities separate:

- `reportedCapabilities`: normalized heartbeat values from the connector.
- `allowedCapabilities`: optional host/admin allowlist. `null` means no extra
  restriction yet; `[]` denies all connector-served capabilities.
- `capabilities`: effective, job-claimable capabilities used by the existing UI
  and queue matching code.

On heartbeat:

1. `reportedCapabilities = normalizeCapabilities(input.capabilities)`
2. `allowedCapabilities = null` means no admin restriction.
3. `effectiveCapabilities = reportedCapabilities` when `allowedCapabilities` is
   null; otherwise use the ordered intersection.
4. Store `reportedCapabilities` and effective `capabilities` separately.

On queue claim:

- Continue to read only effective `capabilities` for eligibility.
- `selectNextJob` and `targetCapability` do not need a product-level rewrite.

## Implementation notes

- Additive SQLite and PostgreSQL migrations create `reported_capabilities` and
  `allowed_capabilities`.
- `packages/database/src/connector-service.ts` exposes `setAllowedCapabilities`
  and applies the policy before connector views are returned.
- Existing claim logic remains compatible because `capabilities` is still the
  effective set.

## Tests

Covered in `packages/database/src/connector-service.test.ts`:

- Heartbeat stores reported capabilities separately from effective capabilities.
- Unknown reported capabilities are discarded.
- A connector reporting `llm_local` cannot claim `llm_generate` when
  `allowedCapabilities` only allows `audio_local`.
- An empty allowlist blocks all connector-served jobs for that connector.
