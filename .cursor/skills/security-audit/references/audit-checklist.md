# UWE Security Audit Checklist

Based on `SECURITY_REVIEW.md`, `docs/security-testing.md`, and `packages/database/src/studio-security.ts`.

## 1. Authentication & authorization

### Portal
- [ ] Session cookies: httpOnly, SameSite, Secure in production
- [ ] Login rate-limited; logout clears DB session + cookies
- [ ] Role matrix: `packages/auth/src/permissions.ts`
- [ ] Share tokens: password, expiry, scope

### Studio
- [ ] All API routes protected (`requireStudioApiAuth`) except allowlist
- [ ] Restore uses `requireRestoreOwnerAuth` + optional `RESTORE_OWNER_TOKEN`
- [ ] CSRF guard on mutating Studio requests
- [ ] **Never** expose Studio without Cloudflare Access / reverse-proxy auth when public

## 2. Public data leaks

Run `pnpm test:leaks` — scanner checks anonymous portal paths for markers:

- `__DM_ONLY_SECRET_SHOULD_NOT_LEAK__`
- `__PRIVATE_DRAFT_SHOULD_NOT_LEAK__`
- `__HIDDEN_SECRET_SHOULD_NOT_LEAK__`
- `__PRIVATE_MEDIA_SHOULD_NOT_LEAK__`

Paths: page listings, search, graph, assets, share.

Also review: `packages/database/src/visibility-security.test.ts`

## 3. Uploads & media

- [ ] Magic-byte validation + MIME allowlist (`packages/assets/src/upload-validation.ts`)
- [ ] HTML, JS, SVG blocked
- [ ] Size limits enforced
- [ ] Asset delivery respects visibility on Portal

## 4. Backup / restore / import

- [ ] Backup API authenticated
- [ ] Restore owner guard; audit events logged
- [ ] Import: preview + `confirmed: true`, size limit
- [ ] Zip-slip protection on restore

## 5. AI & inference

- [ ] AI routes require Studio auth
- [ ] Rate limit on inference (30/min/IP typical)
- [ ] Inference URL guard (no SSRF to internal networks)
- [ ] No secrets in AI API responses
- [ ] Cloud provider blocked for local/campaign context (`packages/ai-brain/src/privacy.ts`)
- [ ] RTX/Ollama **not** reachable via public URL

## 6. Secrets & configuration

- [ ] `.env` gitignored; `.env.example` has no real secrets
- [ ] Production warnings: `AUTH_SECRET`, `RUN_DB_SEED=false`
- [ ] `pnpm secret:scan` clean
- [ ] Log redaction via `@uwe/env`

## 7. HTTP headers & middleware

- [ ] CSP, nosniff, HSTS (production)
- [ ] No permissive CORS on sensitive routes
- [ ] Portal middleware active in production (`AUTH_REQUIRED`)

## 8. Security packages

| Package | Role |
|---------|------|
| `@uwe/security` | Validation, CSRF, rate limits, guards |
| `@uwe/env` | Zod ENV, log redaction |
| `@uwe/security-tests` | Role matrix, route authz, leak scanner |
| `packages/auth` | Headers, route policy, `authorize()` |

## 9. Extending coverage

When adding Studio API routes:

1. Add `requireStudioApiAuth` to the route
2. Register in `packages/security-tests` if applicable
3. Update `STUDIO_PROTECTED_API_ROUTES` in `route-authz.test.ts`
4. Re-run `scripts/studio-route-auth.test.ts`

## Related files

- `DEPLOYMENT_SECURITY.md`
- `docs/deployment-hardening.md`
- `packages/database/src/production-safety.ts`
- `packages/database/src/security-dashboard.ts`
