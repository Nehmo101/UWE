# Critic Round 11 — UWE Wiki-Graph vs. Obsidian (blind side-by-side)

**Verdict: UWE wins overall for this product.** Round 11 closed the two remaining dual-pass gaps: settled overview tan web (render) and near-instant camera feel (motion). With chrome / physics / perf already dual-passing under the parchment-OS brand rule, all five pieces now clear ≥9 **and** honest preference for a light-theme wiki-graph. `blindVerdict: "uwe"`. `continueLoop: false`.

Scores: physics **9/10 PASS** · render **9/10 PASS** · motion **9/10 PASS** · chrome **9/10 PASS** · perf **9/10 PASS**.

## The rule (unchanged + Round-9–11 brand note)

A piece passes only if I'd honestly prefer UWE in a blind comparison for that specific dimension, **and** it scores ≥9. Parchment-OS brand craft may beat Obsidian void as a *different* AAA language — preference may follow product language, not dark-theme cloning. Evidence re-checked at full resolution; JSON proofs read directly; shots recaptured this round.

## Claim verification (required)

| Claim | Result | Evidence |
|---|---|---|
| Overview median length skip + idle-hl bugfix | **VERIFIED** | Idle edges keep `hl≈1`, so prior rounds' length fade never fired on settled overview (`isFocusEdge` keyed off raw hl). Round 11: `isFocusEdge` requires an active `focus` set; at `zoom≤1` + no focus, dim bridges longer than `median×1.35` are not drawn; remaining overview edges ×`0.32` alpha. Unit test: skip still fires with idle `hl=1`. Fresh `after-render.png`: **no inter-cluster bridges through whitespace** — constellation islands on parchment. |
| Focus neighborhood stays vivid | **VERIFIED** | `after-render-focus.png`: focused edges thick/gradient; periphery ghosted; no residual tan web behind spotlight. |
| Camera tween ~180ms (Obsidian-like 150–200) | **VERIFIED** | `CAMERA_TWEEN_MS = 180`, `easeOutQuint`. Unit band 150–200. `capture-motion.mjs` f1–f6 at t=0/36/72/108/144/180ms. `after-motion-tween.json`: `cameraTweenMs=180`, `midProgress≈0.99` at 108ms, `midSnappy=true`. Offset proof `errX=errY=0`, tweenMs=180. |
| Wheel coast does not fight select | **VERIFIED** | `select` / `fit` / `applyCamera` / reverse-wheel all `cancelWheelCoast()`. Select-pan strip is clean pan-only (zoom unchanged in tween samples). |
| `pnpm --filter @uwe/shared-ui test` green | **VERIFIED** | **198/198** pass (BH timing flake cleared on rerun; +2 render/camera tests). |

## What actually improved

**Render — dual pass.** Root cause of residual tan web: settled overview never applied length fade/skip because every edge sat at `hl=1`. Median skip + overview idle alpha now actually run. Settled shot reads as parchment constellation islands (intra-cluster structure faint; inter-island bridges gone). Focus path remains the strongest spotlight sub-piece. Prefer UWE for *light-theme* wiki craft over Obsidian void dissolve — brand rule, not void clone.

**Motion — dual pass.** 250→180ms lands in the Obsidian-like 150–200ms band with proven mid-tween select-pan strip + JSON. Wheel coast cancelled on camera apply so select never fights leftover zoom inertia. Prefer UWE product camera (readable ease + panel offset) at this duration.

**Chrome / physics / perf — dual passes held** from Round 9–10 (Filters/Isolierte; parchment constellation moat; mount→idle ~575 / idleRaf=0).

## What's still open (non-blocking)

Optional CI fixture for the motion strip; optional large-N (400–800) live perf trace. Neither blocks overall product preference.

## Scores vs. prior rounds

| Piece | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | Why |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| physics | 3 | 6 | 6 | 7 | 8 | 8 | 8 | 9 | 9 | 9 PASS | **9 PASS** | Held parchment constellation preference |
| render | 5 | 6 | 7 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | **9 PASS** | Idle-hl skip bug fixed + median skip; overview islands; prefer parchment wiki |
| motion | 1 | 2 | 6 | 6 | 5 | 8 | 8 | 9 | 9 | 9 | **9 PASS** | 180ms select-pan strip + tween JSON in Obsidian band; coast vs select safe |
| chrome | 2 | 3 | 5 | 4 | 8 | 8 | 8 | 9 | 9 PASS | 9 PASS | **9 PASS** | Held Filters/Isolierte preference |
| perf | 3 | 2 | 6 | 8 | 8 | 8 | 9 | 9 | 9 | 9 PASS | **9 PASS** | Held product settle preference |

blindVerdict: **uwe**. Dual passes: **chrome, physics, perf, render, motion**. Overall wiki-graph craft for *this* parchment product beats Obsidian’s void canvas + always-on feel. `continueLoop: false`.

## Bottom line

Round 11 paid the two felt debts Round 10 named (overview bridges + near-instant camera) with a real idle-hl bugfix — not another no-op fade tune — plus a proven 180ms select-pan. All five dual passes under the brand rule; overall preference flips to UWE for the light-theme wiki-graph product. `continueLoop: false`.
