/**
 * Mandatory prompt excerpts for the RTX Gouache asset proposal.
 *
 * These are inlined on purpose: the prompt names `docs/prompts/atlas-pictogram-
 * styleguide.md` and `docs/design/atlas-redesign/asset-catalog.md` as sources,
 * but a model that cannot open them still has to see the binding rules. The
 * paths stay advisory pointers; these excerpts are the contract.
 *
 * Was `@uwe/atlas/src/rtx-asset-prompt-context.ts`.
 */

export const RTX_ATLAS_ASSET_STYLEGUIDE_EXCERPT = [
  "Gouache assets use filled painterly shapes with body color, darker pigment edge, shadow, and highlight.",
  "The object anchor is base-center: the placement point sits at the lower middle and the drawing grows upward.",
  "Use muted map colors: earthy reds, ochres, greens, greys, and blues; no bright UI colors or photoreal textures.",
  "Never copy external Canvas of Kings assets; proposals must be original data reviewed by UWE.",
] as const;

export const RTX_ATLAS_ASSET_CATALOG_EXCERPT = [
  "Stamp is a single AtlasObject asset; Plot fills an area; Path follows routes; Landmark can use pseudo-3D shadow/aura.",
  "Gen assets are settlement-generator parts; Terrain assets affect biome or ground texture.",
  "Useful backlog examples include fields, swamps, cliffs, ruins, market variants, ships, bridges, harbors, and fantasy landmarks.",
] as const;
