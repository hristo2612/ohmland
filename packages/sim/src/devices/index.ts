import type { PartSpec } from "../types";
import type { Device } from "../engine/device";
import { FuseDevice, PotDevice, ResistorDevice, SourceDevice, SpdtDevice, SwitchDevice, WireDevice } from "./basic";
import { DiodeDevice, LedDevice, NpnDevice, PhototransistorDevice } from "./semis";
import { CapacitorDevice, RelayDevice, SpeakerDevice } from "./reactive";
import { MultimeterDevice } from "./meter";

/** Creates the model for a part, or null for an unknown kind (which is then ignored). */
export function createDevice(spec: PartSpec): Device | null {
  switch (spec.kind) {
    case "wire":
      return new WireDevice(spec);
    case "resistor":
      return new ResistorDevice(spec);
    case "probe-resistance":
      return new ResistorDevice(spec, false);
    case "switch":
    case "pushbutton":
      return new SwitchDevice(spec);
    case "spdt":
      return new SpdtDevice(spec);
    case "pot":
      return new PotDevice(spec);
    case "battery":
    case "cell":
      return new SourceDevice(spec);
    case "fuse":
      return new FuseDevice(spec);
    case "led":
      return new LedDevice(spec);
    case "diode":
      return new DiodeDevice(spec);
    case "npn":
      return new NpnDevice(spec);
    case "phototransistor":
      return new PhototransistorDevice(spec);
    case "capacitor":
      return new CapacitorDevice(spec);
    case "relay":
      return new RelayDevice(spec);
    case "speaker":
      return new SpeakerDevice(spec);
    case "multimeter":
      return new MultimeterDevice(spec);
    default:
      return null;
  }
}
