# UWE Cursor Skills

Task-specific workflows for Cursor Agents and subagents. Each skill has a `SKILL.md` with YAML frontmatter (`name`, `description`).

## How to use

1. Match the task to a skill below.
2. Read the skill file at the start of the task.
3. Follow referenced docs and run the listed quality commands before pushing.

## Skill catalog

| Skill | Use when |
|-------|----------|
| [uwe-architecture](./uwe-architecture/SKILL.md) | Package boundaries, where to put code |
| [uwe-feature-implementation](./uwe-feature-implementation/SKILL.md) | New Studio/Portal features end-to-end |
| [api-routes](./api-routes/SKILL.md) | REST API routes, uploads, webhooks |
| [react-next-ui](./react-next-ui/SKILL.md) | Pages, components, Server Actions |
| [auth-rbac-visibility](./auth-rbac-visibility/SKILL.md) | Login, roles, dm_only filters |
| [ai-agent-proposal-workflow](./ai-agent-proposal-workflow/SKILL.md) | AI tasks, Review/Apply, Agent Jobs |
| [local-first-privacy](./local-first-privacy/SKILL.md) | RTX-only context, no cloud brain leak |
| [uwe-brain](./uwe-brain/SKILL.md) | DnD Brain + Life Brain separation |
| [dnd-content-consistency-check](./dnd-content-consistency-check/SKILL.md) | Canon, leaks, generator safety |
| [portal-player-view](./portal-player-view/SKILL.md) | Portal routes, share links, export parity |
| [database-migration-review](./database-migration-review/SKILL.md) | Prisma migrations |
| [ci-quality-gate](./ci-quality-gate/SKILL.md) | `pnpm quality` before PR |
| [security-audit](./security-audit/SKILL.md) | Full security review |
| [pr-review](./pr-review/SKILL.md) | Reviewing pull requests |
| [deployment-cloudflare-check](./deployment-cloudflare-check/SKILL.md) | Tunnel, Access, production ENV |
| [hardware-homelab](./hardware-homelab/SKILL.md) | Self-host scripts, RTX, backups |

## Rules (always-on context)

See `.cursor/rules/` — `uwe-project`, `ci-and-testing`, `security` apply to every session.

## Technical roadmap

Refactor order and large-file split plan: [docs/engineering/TECHNICAL_ROADMAP.md](../../docs/engineering/TECHNICAL_ROADMAP.md)
