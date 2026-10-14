// How clip leads and probe cords are drawn between their clips (docs/BENCH-VIEWS.md, "Cable styles"). Every style
// keeps the same anchors, clip points and netlist: only the drawn path between the clips changes.
//
// - classic: the original look (a loose curve out of each clip; in 3D a hanging rope with plenty of slack).
// - drape:   smooth hanging curves, slack growing with distance, routed round part bodies; clips on one terminal fan
//            out evenly and parallel runs keep a constant gap.
// - taped:   straight runs with rounded right-angle corners on an invisible grid, like leads taped to a lab bench.
// - tidy:    short gentle arcs, for benches laid out by the tidy layout pass (src/cables/tidy.ts).

export type CableStyle = "classic" | "drape" | "taped" | "tidy";

export const CABLE_STYLES: readonly CableStyle[] = ["classic", "drape", "taped", "tidy"];

export const isCableStyle = (v: unknown): v is CableStyle => typeof v === "string" && (CABLE_STYLES as readonly string[]).includes(v);
