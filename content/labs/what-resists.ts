// Blueprint: docs/curriculum/unit-1.md, L4. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "OL just means bigger than this range. Step the dial up."
//   success "Distilled water, terrible conductor. Salty water, much better. Science!"
//
// Props (N4): every material is a `probe-resistance` part whose `ohms` the lab sets from the prop's state (input key
// `ohms`), with ±4% random drift once per second for skin and water. Probes snap to the props.
// - P1 skin: a stylised forearm patch with controls for moisture (dry, damp, wet, salty), probe spacing marks
//   (1, 2, 3, 4 cm) and pressure (light, firm). ohms = 2 × contact + spacing × bulk.
//   Contact per probe (light / firm): dry 400 kΩ / 250 kΩ, damp 80 kΩ / 50 kΩ, wet 18 kΩ / 12 kΩ, salty 4 kΩ / 3 kΩ.
//   Bulk per cm: dry 20 kΩ, damp 10 kΩ, wet 5 kΩ, salty 2 kΩ.
//   Examples (light): dry 2 cm 840 kΩ; wet 2 cm 46 kΩ; wet 4 cm 56 kΩ; salty 2 cm 12 kΩ.
// - P2 to P4: three labelled cups; dipping both probes in a cup connects that cup.
// - P5: a 10 cm bare copper wire. P6: a plastic ruler.
import { defineLab } from "@ohmland/lab";
import { baseReading, between, meterMode, meterRange, showsOL } from "./lib/goals";

export default defineLab({
  id: "what-resists",
  title: "What resists?",
  bench: {
    board: "none",
    parts: [
      { id: "P1", kind: "probe-resistance", at: "prop:skin", props: { ohms: 840_000, moisture: "dry", spacing: 2, pressure: "light" } },
      { id: "P2", kind: "probe-resistance", at: "prop:cup-distilled", props: { ohms: 1_200_000 } },
      { id: "P3", kind: "probe-resistance", at: "prop:cup-tap", props: { ohms: 40_000 } },
      { id: "P4", kind: "probe-resistance", at: "prop:cup-salty", props: { ohms: 1_500 } },
      { id: "P5", kind: "probe-resistance", at: "prop:copper-wire", props: { ohms: 0.02 } },
      { id: "P6", kind: "probe-resistance", at: "prop:ruler", props: { ohms: 1e13 } },
      { id: "M1", kind: "multimeter", props: { mode: "off", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "dry-skin",
      prompt: "Set the dial to Ω, **200k** range. Touch both probes to the dry skin, 2 cm apart.",
      // GOAL: meter.mode == "ohm" && prop(skin).moisture == "dry" && prop(skin).spacing == 2 && meter.range == "2M"
      //   && meter.value >= 0.3 && meter.value <= 1.9 (value in MΩ on the 2M range)
      goal: (lab) => meterMode(lab) === "ohm" && meterRange(lab) === "2M" && between(baseReading(lab), 300_000, 1_900_000),
      hints: ["OL on 200k? The skin is over 200 kΩ. Step up a range.", "The 2M range goes up to just under 2 MΩ."],
      success: "Hundreds of kilohms. Dry skin is a pretty poor conductor.",
    },
    {
      id: "wet-skin",
      prompt: "Tap **Wet** to moisten the skin and measure again, same spacing.",
      // GOAL: prop(skin).moisture == "wet" && prop(skin).spacing == 2 && meter.display != "OL" && reading < 100 kΩ
      goal: (lab) => meterMode(lab) === "ohm" && !showsOL(lab) && between(baseReading(lab), 20_000, 100_000),
      hints: ["Wet skin reads much lower. A smaller range gives more digits."],
      success: "Tens of kilohms. Water where the probes touch lets current in far more easily.",
    },
    {
      id: "double-spacing",
      prompt: "Keep the skin wet and the pressure the same. Measure at 2 cm, then at 4 cm. Does the reading double?",
      // GOAL: logged("skin wet 2cm") && logged("skin wet 4cm"), with the same pressure setting for both
      // Interim: the 4 cm reading with light pressure (56 kΩ ± 10%).
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 50_000, 62_000),
      hints: ["Move both probes to the 4 cm marks, or one probe to the far mark."],
      // NOTICE: contact resistance dominates; distance is only a small part.
      success:
        "It went up, but nowhere near double. Most of the resistance is where the probes touch the skin, and that part didn't change.",
    },
    {
      id: "three-cups",
      prompt: "Measure all three cups of water: distilled, tap and salty.",
      // GOAL: logged("cup-distilled") && logged("cup-tap") && logged("cup-salty"), each a non-OL reading
      // Interim: the salty cup's reading (1.5 kΩ ± 12%).
      goal: (lab) => meterMode(lab) === "ohm" && !showsOL(lab) && between(baseReading(lab), 1_320, 1_680),
      hints: ["Distilled water may need the 2M range.", "Salty water reads low. Try 2k."],
      success: "Pure water barely conducts. It's what's dissolved in it that carries the current.",
    },
    {
      id: "extremes",
      prompt: "Last two: the copper wire and the plastic ruler.",
      // GOAL: logged("copper-wire") && reading < 1 Ω, and logged("ruler") && meter.range == "2M" && meter.display == "OL"
      // Interim: the ruler half only.
      goal: (lab) => meterMode(lab) === "ohm" && meterRange(lab) === "2M" && showsOL(lab),
      hints: ["Copper reads best on the 200 range.", "Plastic needs the biggest range, and even that won't be enough."],
      success:
        "Copper: next to nothing (most of that is your probe leads). Plastic: OL on every range. A conductor and an insulator.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
