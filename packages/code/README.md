# @ohmland/code

Bench C: the small C-like language of Ohmland's microcontroller board (Unit 5). Pure TypeScript, no DOM: it runs in
the simulator's worker, in Node for tests, and in the page for the code editor.

It is a strict subset of the language Uno-style boards use, with the same function names, so a program written here
runs unchanged on a real board. Anything outside the subset is a friendly error ("Arrays are not on this bench yet."),
never a silent difference.

```ts
import { analyze, format, toBlocks, fromBlocks, compile, Vm, runProgram } from "@ohmland/code";

const { ast, errors, warnings } = analyze(source); // errors[0]: { line, col, kind, message } ("4:18 Each step ends with a semicolon.")
const text = format(ast!);                         // canonical text (formatWithMap also gives each node's span)
const blocks = toBlocks(ast!);                     // plain JSON, one block per statement or value
const again = fromBlocks(blocks);                  // the same tree
const run = runProgram(source, { seconds: 5 });    // traces on a virtual board: run.board.edges(13), run.board.lines
```

The single source of truth is the tree (`src/ast.ts`). Text and blocks are two views of it: edit either and redraw
the other from the tree. Comments, blank lines, the brackets the learner wrote and the spelling of numbers and types
are part of the tree, so both round trips are exact.

## The language

| | |
|---|---|
| Program | Global variables and functions. `void setup()` and `void loop()` are required. Functions may be called before they are written (the board's tools add prototypes); variables must be declared before use. |
| Types | `int` (16 bits, wraps at 32,767), `unsigned int` (`unsigned`, `word`), `long` (32 bits), `unsigned long`, `byte` (8 bits), `bool` (`boolean`), and the stdint names `int16_t`, `uint16_t`, `int32_t`, `uint32_t`, `uint8_t`. `const` and `static` (a static local starts from a fixed value). `short` is `int`. |
| Statements | Declarations (`int a = 1, b;`), expressions, `if`/`else` (with or without braces), `while`, `do`/`while`, `for`, `break`, `continue`, `return`, blocks, `;`. |
| Expressions | Numbers (decimal, `0x`, `0b`, octal with a leading 0, suffixes `U`, `L`, `UL`), `true`, `false`, text in quotes (only for `Serial.print`), names, calls, `+ - * / %`, `<< >> & \| ^ ~`, `< > <= >= == !=`, `&& \|\| !`, `= += -= *= /= %= &= \|= ^= <<= >>=`, `++`/`--` before or after, `?:`, brackets, casts like `(unsigned long)x`. |
| Not here | `float`, `double`, `char`, `String`, arrays, pointers, `switch`, `goto`, `struct`, `class`, `enum`, `#include`, `#define`, interrupts. Each gives its own sentence. |
| Comments | `//` to the end of the line and `/* ... */`. Kept in the tree. |

Arithmetic follows avr-gcc exactly: integer promotion to a 16-bit `int`, the usual arithmetic conversions with a
32-bit `long`, two's complement wrapping on every store, truncating division, `int * int` multiplied as `int` even when
stored in a `long` (300 x 300 gives 24,464), and the board's answers for dividing by zero (all ones, and `x % 0` is
`x`), which also raise a runtime note.

### The board API

| Call | Cost (board time) | Notes |
|---|---|---|
| `pinMode(pin, INPUT \| OUTPUT \| INPUT_PULLUP)` | 4 µs | `OUTPUT` keeps the pin's latch (a pull-up pin turns into a HIGH output, as on the chip). |
| `digitalWrite(pin, value)` | 4 µs | Any non-zero is HIGH; on an input it switches the pull-up; switches PWM off on that pin. |
| `digitalRead(pin)` | 4 µs | The pin through its input buffer (works on outputs too); switches PWM off, as the board does. |
| `analogRead(A0..A5 or 0..5)` | 112 µs | 0 to 1023 against the 5 V rail. |
| `analogWrite(pin, 0..255)` | 4 µs | PWM on 3, 5, 6, 9, 10, 11 (490 Hz, 977 Hz on 5 and 6); 0 and 255 are plain LOW and HIGH; other pins: below 128 LOW, else HIGH. |
| `delay(ms)`, `delayMicroseconds(us)` | exactly that | |
| `millis()`, `micros()` | 0 | 32-bit unsigned counts (micros in steps of 4 µs). |
| `random(max)`, `random(min, max)`, `randomSeed(seed)` | 0 | avr-libc's generator, the same numbers as the real board (seed 1 at reset: 16807, 282475249, ...). `random(1, 7)` gives 1 to 6. |
| `Serial.begin(baud)`, `Serial.print(x [, DEC \| HEX \| OCT \| BIN])`, `Serial.println(...)` | 1 µs a character, more when the buffer is full | 10 bits a character at the baud rate, a 64-character buffer; the program waits when it is full. `println` ends with `\r\n`. Negative numbers in HEX print as 32-bit, as on the board. |
| `map`, `constrain`, `min`, `max`, `abs` | 0 | `map` in 32-bit `long` arithmetic, as on the board. |

Constants: `HIGH`, `LOW`, `INPUT`, `OUTPUT`, `INPUT_PULLUP`, `LED_BUILTIN` (13), `A0` to `A5` (14 to 19), `DEC`, `HEX`,
`OCT`, `BIN`. Pins are 0 to 19; a pin the board lacks is ignored with a runtime note.

## Friendly errors

`analyze(text)` returns `errors` (sorted by position, the editor shows the first) and `warnings`. Each is a
`Diagnostic`: `{ line, col, endLine?, endCol?, kind, message, severity }`, lines and columns counted from 1;
`describe(d)` gives `"5:3 Did you mean digitalWrite? Capitals matter."`. A missing semicolon points just after the
step that needs it (`"6:13 Each step ends with a semicolon."`).

Kinds (stable, for `lab.code(board).errorsSeen`): `semicolon`, `case` (wrong capitals), `name` (unknown, with a "did
you mean" when one is close), `brace`, `paren`, `syntax`, `args`, `type`, `const`, `duplicate`, `setup`, `loop`,
`unsupported`, `char`, `string`, `comment`, `number`. Warnings (the program still runs): `assign-in-if` (`if (face = 6)`),
`no-effect` (`x == 5;`), `overflow` (`int x = 40000;`), `pin`, `return` (a function that can end without giving a value
back), `serial` (printing without `Serial.begin`).

## Blocks

`toBlocks(ast)` gives `{ type: "program", items: BlockNode[] }`:

```ts
type BlockNode = {
  type: string;           // a statement or value kind, or a built-in's name ("digitalWrite", "millis")
  id?: number;            // the tree node it shows (missing on a block made in the editor)
  fields?: Record<string, string | number | boolean>; // typed in place: numbers, names, operators
  inputs?: Record<string, BlockNode>;  // value slots, by name: a built-in's parameters (pin, value, ms...)
  args?: BlockNode[];     // values of a call to one of the program's own functions
  body?: BlockNode[];     // statement lists
  else?: BlockNode[];
  params?: { name; type; id? }[];      // a function's parameters
  more?: { name; id?; value? }[];      // more names in one declaration
  refs?: { var?; expr?; target?; body?; elseBody? }; // ids of tree nodes without a block of their own
  layout?: BlockLayout;   // comments, blank lines, braces: the text view's business, a block editor can ignore it
};
```

Block types: `setup`, `loop`, `function`, `prototype`, `declare`, `set`, `change`, `call`, `expr`, `if`, `every`,
`while`, `do`, `for`, `return`, `break`, `continue`, `empty`, `comment`, `group`, and the values `number`, `bool`,
`text`, `constant`, `get`, `math`, `compare`, `logic`, `not`, `negate`, `unary`, `choose`, `brackets`, `cast`, plus one
type per built-in (`digitalWrite` with inputs `pin` and `value`, `delay` with `ms`, `random` with `max` or `min` and
`max`...). `BLOCK_TYPES` lists the non-built-in ones.

The clock check `if (millis() - last >= 1000) { last = millis(); ... }` is shown as one `every` block (`fields.var`,
`inputs.ms`, the rest of the body); edited out of that shape (brackets around the subtraction, an `else`), it is a
plain `if` again. `fromBlocks` keeps every id it is given and mints fresh ones for new blocks, and throws `BlockError`
for a block it cannot read.

To light a block's line: `formatWithMap(ast).spans.get(id)` (any tree, including one built from blocks), or the
parser's `span` on each node; `nodeAt(ast, line, col)` finds the statement under the cursor.

## Running on virtual time

`compile(text | ast)` checks and turns the tree into bytecode for a small stack machine. A `Vm` runs it on **virtual
time**: a board clock in microseconds since reset that only the program moves. Each statement costs 1 µs (each loop
test too), pin calls and `analogRead` add their cost, `delay` adds exactly its time, and nothing waits for real time.

```ts
const vm = new Vm(program, { clockStart?: ms, seed?: n, trace?: n });
vm.run(host, untilMicros);   // "time" | "wait" | "budget" | "step" | "error"
vm.step(host);               // one statement (step mode); vm.stmt indexes program.stmts (node id and span)
vm.traced();                 // the last n statements as { t, stmt } (trace mode)
vm.reset();                  // the reset button
vm.setMillis(ms, atMicros?); // the day-49 jump: millis() reads ms at that board time
vm.millis(atMicros?);        // the 32-bit clock
vm.notes;                    // runtime notes: printing before Serial.begin, dividing by zero, a missing pin
```

The `BoardHost` is the board around the program: `drive(pin, mode, t, duty, hz)` when a pin's drive changes (input,
pull-up, LOW, HIGH, PWM), `digitalRead(pin, t)` and `analogRead(pin, t)` (return -1 to make the run wait and retry the
same read later), `serialBegin`, `serialChar(ch, t)` (the time each character is fully sent). The simulator's
`mcuboard` device is the electrical host; `VirtualBoard` is an ideal one for tests, solution checks and the referee
below, and `runProgram(text, { seconds, input, analog, clockStart, clockJumps, resets })` runs a program on it.

The interpreter runs about 16 million statements a second in Node on an M-series Mac (a `loop()` that only checks
`millis()` costs about 60 ms of CPU per board second); `test/speed.test.ts` guards it.

## Tests

`pnpm --filter @ohmland/code test`: golden programs from the Unit 5 lessons on a virtual board (blink and its exact
2.000011 s period, a loop with no delay at about 100 kHz, a button through the pull-up, five bouncing presses
over-counted and the 50 ms debounce counting five, serial timing at 9600 baud, a blocking blink that misses a tap and
the `millis()` version that catches it, the day-49 wrap: the subtraction keeps 5 s periods and `millis() + 5000`
flickers for 4 s, avr-libc's random sequence and 10,000 fair rolls of `random(1, 7)`, the dice pips always matching the
printed number, PWM, reset), integer wrapping (16-bit `int`, the `int * int` trap, unsigned subtraction across the
wrap, division by zero, printing bases, signed and unsigned comparison), functions, statics and every loop form,
friendly errors at their exact positions, warnings, both round trips on every golden program and on a program full of
comments and odd spellings, the `every` block, blocks made in an editor, spans, step and trace, and the speed guard.

## CI referee (later): holding bench C to the real chip with avr8js

Bench C is an interpreter, so it could drift from the real board. The plan (curriculum unit 5, section 3.2) is a
referee in CI only, never shipped. Nothing of it is installed yet; this is how it would work.

1. **Compile the real thing.** For every lesson solution and fix-it program, CI wraps the source in a `.ino` (it is
   already valid Arduino code) and compiles it with `arduino-cli compile --fqbn arduino:avr:uno` (avr-gcc, GPL and
   LGPL tools, so CI only: no binary ships), keeping the `.hex`.
2. **Run it on avr8js** (MIT): load the hex into an `ATmega328P`-style CPU (`CPU` with 32 KB of flash), attach the
   timers (`AVRTimer` with `timer0Config`, `timer1Config`, `timer2Config`), the serial port (`AVRUSART` with
   `usart0Config`, collecting `onByteTransmit`) and the GPIO ports (`AVRIOPort` B, C, D, with `addListener` recording
   every pin change). Step `avrInstruction(cpu)` and `cpu.tick()` for N seconds at 16 MHz; a pin change's time is
   `cpu.cycles / 16e6`. Inputs come from the same script the bench test uses (`port.setPin(n, level)` at given cycles),
   analog values through avr8js's ADC peripheral (or the referee skips the `analogRead` programs).
3. **Run bench C** on `runProgram` with the same input script, collecting `board.events` and `board.lines`.
4. **Compare**: the same sequence of pin levels on every output pin with each edge within 1 ms (the lessons' blinks,
   debounce and dice), the same serial lines, and for PWM the same duty within 1%. A mismatch fails the build and
   names the program, the pin and the first edge that differs.

Known differences the referee would allow for: the real `millis()` steps by 1.024 ms and sometimes jumps by 2 (bench C
counts true milliseconds), real statements do not cost exactly 1 µs (only delays and `millis()` checks set lesson
timing, so this stays far under 1 ms), the real `delay()` drifts by a few microseconds a call, a real board waits
about half a second in its bootloader after a reset (load the hex directly, without the bootloader), and the serial TX
pin carries real bits where bench C holds it high. Random numbers match exactly (bench C uses avr-libc's algorithm).

The likely shape: a `scripts/referee/` Node script with `avr8js` as a dev dependency (pinned), run by a CI job that
installs `arduino-cli` and the AVR core, over a list of programs exported from the lab files (`program.source` plus
each solution's code steps).
