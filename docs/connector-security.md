# Connector security

The RTX Host Connector is a **worker**, never a user. Its access is deliberately
narrow.

## Token authentication

- A connector token is generated on the host (Studio → System → RTX Connector) or
  set manually. Format: `uwec_…`.
- The host stores **only the SHA-256 hash** (`Connector.tokenHash`), never the
  plaintext. The raw token is shown exactly once.
- Every connector request carries `Authorization: Bearer uwec_…`. The host looks
  the connector up by token hash; verification is timing-safe.
- Rotating a token immediately invalidates the old one.

## Separation from user auth

- Connector endpoints (`/api/connectors/*`) authenticate **only** via the
  connector token — never via user sessions or the Studio API token. A worker
  cannot log in as a user.
- A connector receives **only job-specific context** in `claim-job` (job type,
  payload, world id). It cannot read admin or user data, and `/api/connectors/config`
  returns only operating parameters (poll/heartbeat timing, queue flag, cloud
  fallback policy).

## Network posture

- Communication is **outbound only**: the connector connects to the host. No
  public port, SSH, or HTTP server is opened on the RTX machine.
- There is no public RTX API and no Cloudflare Tunnel to the RTX as a required
  path.
- No DB replication between host and RTX. The host stays the source of truth.

## Rate limiting & abuse

- Connector endpoints use a dedicated rate-limit bucket (`connector`).
- Job claims are capability- and lane-checked server-side; a connector can only
  claim jobs matching the capabilities it advertised.
- Claims are optimistic and atomic — two connectors cannot run the same job.

## Logging

- The connector redacts tokens (`uwec_***`) and never logs full job payloads.
- The host does not log secrets in connector responses.

## Data boundary for AI

- World / brain data is never sent to the cloud automatically. Local models on the
  connector receive context only through explicit jobs. Cloud fallback is
  off unless `UWE_AI_CLOUD_FALLBACK=true` on the host.
