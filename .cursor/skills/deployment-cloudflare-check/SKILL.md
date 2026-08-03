---
name: deployment-cloudflare-check
description: Verify UWE self-hosting and Cloudflare Tunnel deployment — ENV, tunnel scope, Access policies, Studio protection, Maschinenraum isolation, health checks, and production safety warnings. Use before going live, after deployment changes, or when troubleshooting Cloudflare/Proxy setup.
---

# UWE Deployment / Cloudflare Check

## Architecture rule

**Only UWE Studio (:3000) and Portal (:3001) behind Cloudflare Tunnel.**  
**Never** expose Maschinenraum-Agent, Ollama, or LM Studio to the internet.

## Check workflow

1. Review ENV against [references/env-checklist.md](references/env-checklist.md).
2. Verify tunnel ingress (two hostnames: Portal public, Studio protected).
3. Confirm Cloudflare Access on Studio/Admin paths.
4. Run health and safety checks:

```bash
curl -s http://localhost:3000/api/health/public
curl -s http://localhost:3001/api/health/public
pnpm test:security   # optional pre-flight
```

5. Check Studio Admin → Settings/Status or `/admin/security` for runtime warnings.

## Runtime signals

UWE surfaces deployment issues via:

- `/hardware` — Homelab Cockpit (Service-Status, Runbooks, Security Checklist, Maschinenraum-URL-Warnungen)
- `/today` — System-Ampel mit DB/Backup/Cloudflare und kritischen Homelab-Warnungen
- `packages/database/src/production-safety.ts` — startup warnings
- `packages/database/src/studio-security.ts` — Studio exposure assessment
- `packages/database/src/system-status.ts` — `cloudflareTunnel`, `trustProxy` flags

## Output template

```markdown
## Host / Environment
...

## ENV checklist
- [ ] AUTH_SECRET set
- [ ] RUN_DB_SEED=false
- [ ] STUDIO_API_TOKEN set (if public)
- [ ] TRUST_PROXY + CLOUDFLARE_TUNNEL
...

## Tunnel & Access
...

## Blockers
...

## Verdict
ready | not-ready
```

Details: [references/env-checklist.md](references/env-checklist.md)
