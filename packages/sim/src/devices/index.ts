import type { PartSpec } from "../types";
import type { Device } from "../engine/device";
import { FuseDevice, PotDevice, ResistorDevice, SourceDevice, WireDevice } from "./basic";
import { SwitchDevice, ThrowDevice } from "./contacts";
import { DiodeDevice, LedDevice, NpnDevice, PhototransistorDevice } from "./semis";
import { CapacitorDevice, InductorDevice, RelayDevice, SpeakerDevice } from "./reactive";
import { MultimeterDevice } from "./meter";
import { LogicDevice, Timer555Device } from "./chips";
import { SevenSegDevice } from "./display";
import { RegulatorDevice } from "./regulator";
import { SupplyDevice } from "./supply";
import { McuBoardDevice } from "./mcu";

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
      return new SwitchDevice(spec, seed);
    case "spdt":
    case "dpdt":
      return new ThrowDevice(spec, seed);
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
    case "timer555":
      return new Timer555Device(spec, seed);
    case "logic":
      return new LogicDevice(spec, seed);
    case "sevenseg":
      return new SevenSegDevice(spec);
    case "regulator7805":
      return new RegulatorDevice(spec, seed);
    case "supply":
      return new SupplyDevice(spec);
    case "mcuboard":
      return new McuBoardDevice(spec);
    default:
      return null;
  }
}
