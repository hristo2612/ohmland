/**
 * Every word the isle shows (labels and reveal captions), in one place so the app can pass a translation to
 * mountIsle({ messages }). Pure data, no three.js.
 */
export type IsleMessages = {
  /** Display names per kind; a landmark may name each tier. */
  names: Record<string, string | string[]>;
  robot: string;
  robotDetail: string;
  dock: string;
  dockDetail: string;
  placedBy(lessonTitle: string): string;
  builtBy(moduleTitle: string): string;
  raisedBy(moduleTitle: string): string;
  tier(n: number, of: number): string;
  moduleDone(moduleTitle: string): string;
  newPiece(name: string): string;
  raised(name: string): string;
  islandGrew: string;
  newIsland(unitTitle: string): string;
  isleGrows: string;
  /** Unit titles for captions; unknown units show their id. */
  units: Record<string, string>;
  /** Titles for the made-up preview events. */
  madeUpLesson(n: number): string;
  madeUpModule(n: number): string;
};

export const EN: IsleMessages = {
  names: {
    resistor: "Resistor row",
    "led-lamp": "LED street lamp",
    battery: "9 V power block",
    "meter-kiosk": "Meter kiosk",
    fuse: "Fuse house",
    "test-lead-arch": "Test lead arch",
    "cell-jar": "Fruit cell",
    switch: "Switch post",
    pushbutton: "Push button",
    relay: "Relay box",
    "breadboard-patch": "Breadboard patch",
    "jumper-arch": "Jumper wire arches",
    capacitor: "Capacitor tower",
    "ceramic-cap": "Ceramic capacitor",
    pot: "Trimmer knob",
    transistor: "Transistor",
    phototransistor: "Light sensor",
    speaker: "Speaker",
    diode: "Diode",
    "wire-spool": "Wire spool",
    heatsink: "Heatsink grove",
    "header-fence": "Pin header fence",
    moss: "Moss",
    tuft: "Grass tuft",
    "lemon-tree": "Lemon tree",
    "meter-tower": ["Meter house", "Meter tower", "Grand meter tower"],
    "resistor-hall": ["Resistor hall", "Great resistor hall"],
    lighthouse: ["First light", "LED lighthouse", "Great LED lighthouse"],
    observatory: ["Ohm's law observatory", "Ohm's law observatory with telescope"],
    "power-station": ["Battery shed", "Power station", "Great power station"],
    "lemon-grove": ["Lemon grove", "Lemon battery grove"],
    switchyard: ["Switchyard", "Great switchyard"],
    "relay-clocktower": ["Relay house", "Relay clock tower"],
    "breadboard-plaza": ["Breadboard plaza", "Busy breadboard plaza"],
    "capacitor-water-tower": ["Capacitor tank", "Capacitor water tower"],
    "transistor-gatehouse": ["Transistor gate", "Transistor gatehouse"],
    "siren-tower": ["Buzzer post", "Siren tower"],
    "solder-forge": "Solder forge",
    "perfboard-pier": "Perfboard pier",
    "timer-factory": "Timer factory",
    "logic-castle": "Logic castle",
    "counter-billboard": "Counter billboard",
    "dice-arcade": "Dice arcade",
    "coil-windmill": "Coil windmill",
    "radio-mast": "Radio mast",
    "microcontroller-hq": "Microcontroller headquarters",
  },
  robot: "Your robot",
  robotDetail: "It keeps the isle running and cheers every new part.",
  dock: "Charging dock",
  dockDetail: "Where your robot rests. The isle starts here.",
  placedBy: (t) => (t ? `Placed when you finished "${t}"` : "Placed after a lesson"),
  builtBy: (t) => (t ? `Built when you finished the module "${t}"` : "Built after a module"),
  raisedBy: (t) => (t ? `Raised when you finished the module "${t}"` : "Raised after a module"),
  tier: (n, of) => `Level ${n} of ${of}`,
  moduleDone: (t) => (t ? `Module finished: ${t}` : "Module finished"),
  newPiece: (n) => `New on the isle: ${n}`,
  raised: (n) => `Grew taller: ${n}`,
  islandGrew: "The board grew a new section.",
  newIsland: (u) => `A new island rose for ${u}.`,
  isleGrows: "Your isle grows",
  units: {
    basics: "Basics",
    switching: "Switching",
    permanent: "Making it permanent",
    chips: "Chips",
    beyond: "Beyond",
  },
  madeUpLesson: (n) => `Practice lesson ${n}`,
  madeUpModule: (n) => `Practice module ${n}`,
};
