/**
 * The isle's two looks. "notebook" (the default) sets the isle on the Classic notebook page: grid paper instead of a
 * sky, graphite ink round every voxel, a palette nudged towards the notebook's muted inks, soft pencil shadows, and a
 * night page under a desk lamp. "classic" is the original sky look, unchanged.
 *
 * A look only changes how the plan is drawn, never the plan.
 */
import * as THREE from "three";

export type Look = "notebook" | "classic";
/** What lies under a notebook isle: grid paper, plain paper, or nothing (a transparent canvas over the page's own paper). */
export type Paper = "grid" | "plain" | "clear";

/** Turns a palette colour (an sRGB hex string) into the colour a look draws, written into `out`. */
export type Grade = (hex: string, out: THREE.Color) => THREE.Color;

/** The notebook's own colours, from the Classic notebook tokens (light page and night page). */
export const NOTEBOOK = {
  paper: "#F6F2E9",
  paperNight: "#1B1A18",
  grid: "#E7E0D3",
  gridNight: "#252422",
  ink: "#24221E",
  inkNight: "#8F887B",
  /** The pencil shadow an isle casts on the page. */
  shade: "#CFC5B2",
  shadeNight: "#0B0A09",
  amber: "#F2A531",
  red: "#B23A1C",
  /** Red pencil on the night page. */
  redNight: "#F2906F",
  /** The grid cell and line, in CSS pixels. */
  cell: 24,
} as const;

/**
 * Board, land and robot colours the notebook redraws by hand: solder mask a calmer PCB green, copper and gold a little
 * deeper, silkscreen the paper of a pasted slip, the keel a stack of cream and tan FR4 instead of rock.
 */
const SWAP: Record<string, string> = {
  // solder mask
  "#2E9A5E": "#529C73",
  "#2A925A": "#4E966F",
  "#1F7446": "#3A7053",
  "#4FB27A": "#68A884",
  // copper, gold, silkscreen, drill holes
  "#E39A52": "#D99158",
  "#B8743A": "#AE6C40",
  "#F2C35A": "#E6BC66",
  "#F4F2E8": "#FCFAF5",
  "#33302A": "#2B2925",
  // FR4 edges, and the keel below them
  "#EADDB4": "#EFE0BC",
  "#D8C590": "#DCC699",
  "#9A8B7D": "#DCC8A2",
  "#86786C": "#CFB891",
  "#73675D": "#C3AB83",
  "#C9853F": "#C98C5A",
  // moss
  "#8CC43F": "#8DBA58",
  "#77B23A": "#79A94E",
  "#A9D65C": "#A9CB74",
  // the robot: eyes in the notebook's amber
  "#FFB43A": "#F2A531",
};

const tmp = { h: 0, s: 0, l: 0 };
const PAPER = new THREE.Color(NOTEBOOK.paper);

/** The notebook grade: swapped colours as drawn, everything else a little less saturated and warmed towards the paper. */
function notebookGrade(): Grade {
  const cache = new Map<string, THREE.Color>();
  return (hex, out) => {
    const k = hex.toUpperCase();
    let c = cache.get(k);
    if (!c) {
      const swap = SWAP[k];
      if (swap) c = new THREE.Color(swap);
      else {
        c = new THREE.Color(k);
        c.getHSL(tmp, THREE.SRGBColorSpace);
        c.setHSL(tmp.h, tmp.s * 0.84, tmp.l, THREE.SRGBColorSpace);
        c.lerp(PAPER, 0.05);
      }
      cache.set(k, c);
    }
    return out.copy(c);
  };
}

/** The grade for a look (classic draws the palette as it is). */
export function gradeFor(look: Look): Grade | null {
  return look === "notebook" ? notebookGrade() : null;
}
