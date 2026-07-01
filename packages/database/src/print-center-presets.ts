/** System label template slugs exposed in Print Center. */
export const PRINT_CENTER_TEMPLATE_SLUGS = {
  npcCard: "npc-card-6x4",
  itemCard: "item-card-6x4",
  handoutCompact: "handout-compact",
  standard: "standard-6x4",
} as const;

export type PrintCenterTemplateSlug =
  (typeof PRINT_CENTER_TEMPLATE_SLUGS)[keyof typeof PRINT_CENTER_TEMPLATE_SLUGS];
