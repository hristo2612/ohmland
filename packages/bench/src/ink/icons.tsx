// Line icons for the ink view's few tools (original drawings, pen style).

import type { ReactElement } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export type InkIconName = "wire" | "xray" | "undo" | "redo" | "rotate" | "delete" | "fit" | "flip" | "press" | "zoomIn" | "zoomOut";

export function InkIcon({ name }: { name: InkIconName }): ReactElement {
  const box = (children: ReactElement | ReactElement[]) => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...S}>
      {children}
    </svg>
  );
  switch (name) {
    case "wire":
      return box([<circle key="a" cx="5" cy="18" r="1.8" />, <circle key="b" cx="19" cy="18" r="1.8" />, <path key="w" d="M5 16.2C5 6 19 6 19 16.2" />]);
    case "xray":
      return box([<rect key="r" x="3" y="6" width="18" height="12" rx="1.5" />, <path key="s" d="M7.5 9v6M12 9v6M16.5 9v6" />]);
    case "undo":
      return box(<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />);
    case "redo":
      return box(<path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />);
    case "rotate":
      return box(<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />);
    case "delete":
      return box(<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />);
    case "fit":
      return box(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
    case "flip":
      return box(<path d="M4 9h13l-3-3M20 15H7l3 3" />);
    case "press":
      return box([<circle key="c" cx="12" cy="12" r="4" />, <path key="r" d="M12 3v3M12 18v3M3 12h3M18 12h3" />]);
    case "zoomIn":
      return box(<path d="M12 5v14M5 12h14" />);
    case "zoomOut":
      return box(<path d="M5 12h14" />);
  }
}
