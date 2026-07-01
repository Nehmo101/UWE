# UWE Portal — UI kit

A click-through recreation of **UWE Portal**, the player-facing wiki. Players
see only *published, player-visible* content; GM secrets appear blurred behind a
reveal. Default **Parchment OS** theme.

## Flow (`index.html`)
1. **Login** — the split auth shell (ink brand panel + form). Any submit logs in.
2. **World hub (Terra)** — hero + card grid of released Orte, NPCs, Handouts, Sessions.
3. **Article (Validori)** — a wiki article with a post-session `SecretReveal` spoiler.

Use the left nav / cards / "Zurück" to move between views; "Abmelden" returns to login.

## Composition
`screens.jsx` composes `Button`, `Card`, `PageTypeBadge`, `VisibilityBadge`,
`SecretReveal`, `Breadcrumb`, `Brand` from `window.UWEDesignSystem_f43eab`.
Icons are Lucide via CDN.

## Notes
Cosmetic recreation only. The player-safety model is central to UWE: this kit
shows exclusively `player_visible` content and demonstrates the spoiler/secret
reveal that keeps GM-only material hidden until the DM releases it.
