# AI Proposal States

## Page / content proposals

| State | Meaning | Portal |
|-------|---------|--------|
| `idea` | Raw AI suggestion | Hidden |
| `draft` | DM-edited, not canon | Hidden |
| `dm_only` | DM notes / secrets | Hidden |
| Published + `player_visible` | After explicit Apply + publish | Visible |

Apply actions must transition through DM confirmation — no silent promotion.

## Job statuses (`Job` model)

`pending` → `running` → `completed` | `failed` | `cancelled`

Poll from UI or `/jobs` admin view. Failed jobs retain error message for DM — no stack traces to Portal.
