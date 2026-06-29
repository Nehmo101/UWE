# UWE Cursor Skills

Task-specific workflows for Cursor Agents. **Start here:** [manifest.json](./manifest.json) (all 23 skills with one-line triggers).

## How to use

1. Match task to a trigger in `manifest.json`.
2. Read **only** that skill's `SKILL.md`.
3. Run quality gate before push — see [ci-quality-gate](./ci-quality-gate/SKILL.md) or `pnpm quality:quiet`.

## Rules (always-on context)

See `.cursor/rules/` — `uwe-project`, `ci-and-testing`, `security`.

## Canonical references

- [AGENTS.md](../../AGENTS.md) — CI gate, auth imports, cloud agent setup
- [docs/engineering/database-service-map.md](../../docs/engineering/database-service-map.md) — `@uwe/database` service index
