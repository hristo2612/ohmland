import type { PartSpec } from "../types";
import type { Device } from "../engine/device";
import { FuseDevice, PotDevice, ResistorDevice, SourceDevice, WireDevice } from "./basic";
import { SwitchDevice, ThrowDevice } from "./contacts";
import { DiodeDevice, LedDevice, NpnDevice, PhototransistorDevice } from "./semis";
import { CapacitorDevice, InductorDevice, RelayDevice, SpeakerDevice } from "./reactive";
import { MultimeterDevice } from "./meter";

/**
 * Creates the model for a part, or null for an unknown kind (which is then ignored). `seed` (Netlist.seed) is
 * mixed into per-part spreads.
 */
export function createDevice(spec: PartSpec, seed?: string): Device | null {
  switch (spec.kind) {
    case "wire":
      // A wire with a resistance (clip and test leads) is a small resistor; ideal wires merge their nodes.
      return typeof spec.ohms === "number" && spec.ohms > 0 ? new ResistorDevice(spec, false) : new WireDevice(spec);
    case "resistor":
      return new ResistorDevice(spec, true, seed);
    case "probe-resistance":
      return new ResistorDevice(spec, false);
    case "switch":
    case "pushbutton":
      return new SwitchDevice(spec);
    case "spdt":
    case "dpdt":
      return new ThrowDevice(spec);
    case "pot":
      return new PotDevice(spec);
    case "battery":
    case "cell":
      return new SourceDevice(spec);
    case "fuse":
      return new FuseDevice(spec, seed);
    case "led":
      return new LedDevice(spec);
    case "diode":
      return new DiodeDevice(spec);
    case "npn":
      return new NpnDevice(spec, seed);
    case "phototransistor":
      return new PhototransistorDevice(spec);
    case "capacitor":
      return new CapacitorDevice(spec, seed);
    case "relay":
      return new RelayDevice(spec, seed);
    case "speaker":
      return new SpeakerDevice(spec);
    case "multimeter":
      return new MultimeterDevice(spec);
    case "inductor":
      return new InductorDevice(spec);
    default:
      return null;
  }
}
