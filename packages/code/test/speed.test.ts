import { expect, test } from "vitest";
import { compile, Vm, type BoardHost } from "../src";
import { LIGHTHOUSE_SAFE } from "./programs";

// A loop() that only checks the clock runs about 300,000 times a board second. The interpreter must stay far ahead
// of real time so the simulator's worker has room for the circuit.
test("a busy clock-check loop runs well ahead of real time", () => {
  const c = compile(LIGHTHOUSE_SAFE);
  if (!c.ok) throw new Error(c.errors[0]!.message);
  const vm = new Vm(c.program);
  const host: BoardHost = { drive() {}, digitalRead: () => 1, analogRead: () => 0 };
  vm.run(host, 0.2e6); // warm up
  const t0 = performance.now();
  vm.run(host, 5.2e6);
  const ms = performance.now() - t0;
  const rate = vm.steps / ms / 1000;
  console.log(`5 board seconds in ${ms.toFixed(0)} ms (${rate.toFixed(1)} M statements/s)`);
  expect(ms).toBeLessThan(1500);
});
