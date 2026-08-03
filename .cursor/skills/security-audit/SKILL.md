---
name: security-audit
description: Run a structured UWE security audit covering Studio/Portal auth, API route protection, player data leaks, uploads, AI/Maschinenraum exposure, secrets, and headers. Use before Cloudflare exposure, after security-related PRs, or when asked for a security review.
---

# UWE Security Audit

## Workflow

1. **Inventory** — list changed or in-scope surfaces (Studio API, Portal, uploads, backup, AI).
2. **Automated checks** — run the security test suite and route inventory.
3. **Manual review** — walk the checklist in [references/audit-checklist.md](references/audit-checklist.md).
4. **Report** — severity table: Critical / High / Medium / Low + fixed vs open.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm test:security
pnpm test:authz
pnpm test:leaks
pnpm secret:scan
node --import tsx --test scripts/studio-route-auth.test.ts
```

## UWE security model (short)

| Surface | Protection |
|---------|------------|
| **Studio** | Session login (`AUTH_REQUIRED=true`) + optional Cloudflare Access / `STUDIO_API_TOKEN` + CSRF |
| **Portal** | Session cookies, role matrix (`owner`/`dm`/`player`/`guest`) |
| **Public paths** | Visibility filters; leak scanner must pass |
| **Maschinenraum / Ollama** | LAN only — never in Cloudflare Tunnel |

## Report template

```markdown
## Scope
...

## Automated results
- test:security: pass/fail
- test:leaks: pass/fail
- studio-route-auth: pass/fail

## Findings
| Severity | Issue | Location | Status |
|----------|-------|----------|--------|

## Recommendations
...
```

Details: [references/audit-checklist.md](references/audit-checklist.md)
