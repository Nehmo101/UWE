---
description: Focused security review of UWE changes or the current branch
---

Run a focused, prioritized security review of the current changes.

Follow the canonical scope and output format in **`.cursor/commands/review-security.md`**.
Prioritized scope: auth & sessions (`packages/auth`, `packages/security`) → API route guards
(`apps/*/app/api/**`) → player-data leaks (`packages/database/src/permissions.ts`) → secrets
→ env vars → uploads (`packages/assets`) → rate limits → dependencies.

Automated checks first:

```bash
pnpm secret:scan
pnpm test:security
pnpm security:audit
```

Rules: max 10 prioritized findings; player-leak risks (`dm_only` reaching the Portal) always
outrank style; reference existing tests in `packages/security-tests/`; never print real secrets.
For a full pre-exposure audit, use `.cursor/skills/security-audit/SKILL.md`.
