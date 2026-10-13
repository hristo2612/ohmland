/** Interactive widgets an explain card may embed. The registry (registry.ts) lazy-loads each one by kind. */
export const WIDGET_KINDS = ["ohms-law", "resistor-explorer"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];
