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
    "iron-stand": "Soldering iron stand",
    "solder-spool": "Solder spool",
    regulator: "5 V regulator",
    "chip-block": "Timer chip",
    "reed-gate": "Reed switch gate",
    "seven-seg": "Seven-segment digit",
    "logic-chip": "Logic gate chip",
    "dice-block": "LED die",
    "coil-bolt": "Electromagnet crane",
    magnet: "Magnet",
    antenna: "Antenna",
    "mcu-board": "Microcontroller board",
    "spark-gap": ["Spark gap", "Tall spark gap"],
    "pump-house": ["Pump house", "Marble pump house"],
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
    "solder-forge": ["Solder forge", "Busy solder forge", "Great solder forge"],
    "cable-pylon": ["Cable pylon", "Great cable pylon"],
    "perfboard-pier": ["Perfboard pier", "Long perfboard pier"],
    "timer-factory": ["Timer factory", "Great timer factory"],
    "alarm-lighthouse": ["Alarm light", "Alarm lighthouse", "Great alarm lighthouse"],
    "counter-billboard": ["Counter billboard", "Great counter billboard"],
    "logic-castle": ["Logic keep", "Logic castle", "Great logic castle"],
    "dice-arcade": ["Dice arcade", "Busy dice arcade"],
    "coil-windmill": ["Coil windmill", "Great coil windmill"],
    "radio-mast": ["Radio post", "Radio mast", "Great radio mast"],
    "microcontroller-hq": ["Microcontroller headquarters", "Great microcontroller headquarters"],
    "led-sundial": ["LED sundial", "Great LED sundial"],
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
    "start-here": "Start here",
    basics: "Basics",
    switching: "Switching",
    permanent: "Making it permanent",
    chips: "Chips",
    beyond: "Beyond",
  },
  madeUpLesson: (n) => `Practice lesson ${n}`,
  madeUpModule: (n) => `Practice module ${n}`,
};
