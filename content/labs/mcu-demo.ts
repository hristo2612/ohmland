// A demo of the microcontroller board and its code drawer (Unit 5; docs/LABS.md, "Code"), not a lesson's lab. The
// board sits on the desk with a red LED on pin 7 (through 470 Ω, back to the board's GND). The drawer starts with a
// program that lights the board's L lamp; Upload it, then make pin 7 blink with a LOW and two waits. A bonus: print
// to the serial monitor.
import { defineLab, type LabView } from "@ohmland/lab";

/** What the drawer starts with: pin 13 (the L lamp) on, pin 7 ready. */
export const START = `void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
}
`;

/** Pin 7 on for a second, off for a second. */
export const BLINK = `void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(7, HIGH);
  delay(1000);
  digitalWrite(7, LOW);
  delay(1000);
}
`;

/** The blink, saying so on the serial monitor. */
export const HELLO = `void setup() {
  Serial.begin(9600);
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(7, HIGH);
  Serial.println("on");
  delay(1000);
  digitalWrite(7, LOW);
  Serial.println("off");
  delay(1000);
}
`;

const blinking = (lab: LabView) => Math.abs((lab.blinkPeriod("D1") ?? 0) - 2) <= 0.1;

export default defineLab({
  id: "mcu-demo",
  title: "The board and its code",
  bench: {
    board: "half",
    frame: ["desk:-150,-40", "desk:60,40"],
    parts: [
      { id: "U1", kind: "mcu-board", at: "desk:-110,-4", locked: true, label: "Microcontroller board" },
      { id: "R1", kind: "resistor", at: "e10-e14", params: { ohms: 470 } },
      { id: "D1", kind: "led", holes: { anode: "d14", cathode: "d15" }, params: { color: "red" } },
    ],
    leads: [
      { id: "TL1", from: "U1.d7", to: "a10", color: "yellow" },
      { id: "TL2", from: "a15", to: "U1.gnd", color: "black" },
    ],
    tray: [],
    instruments: [],
    code: { board: "U1", source: START, palette: ["digitalWrite(7, HIGH);", "digitalWrite(7, LOW);", "delay(1000);", "Serial.println"] },
  },
  mascot: {
    hint: "Change a block, then Upload.",
    success: "It does as it's told.",
  },
  tasks: [
    {
      id: "first-upload",
      prompt: "Press Upload. The board's L lamp lights.",
      goal: (lab) => lab.uploads("U1") >= 1 && lab.isLit("U1:L"),
      hints: ["Upload is the dark button on the code drawer."],
      success: "Lit. The program runs.",
    },
    {
      id: "blink",
      prompt: "Make the LED on pin 7 blink: on, wait a second, off, wait a second.",
      goal: blinking,
      hints: ["Pin 7 on, a 1000 ms wait, pin 7 off, another wait.", "Every on and every off needs a wait."],
      success: "One second on, one off.",
    },
    {
      id: "hello",
      prompt: "Make the board print to the serial monitor.",
      goal: (lab) => lab.serial("U1").lines.length >= 2,
      hints: ["Start the serial port in setup, then print a line in loop."],
      success: "The board talks back.",
      bonus: true,
    },
  ],
  solution: [
    { do: "code", part: "U1", source: START },
    { do: "check", task: "first-upload" },
    { do: "code", part: "U1", source: BLINK },
    { do: "wait", seconds: 7 },
    { do: "check", task: "blink" },
    { do: "code", part: "U1", source: HELLO },
    { do: "wait", seconds: 3 },
    { do: "check", task: "hello" },
  ],
});
