// @ohmland/code: bench C, the language of Ohmland's microcontroller board.
//
//   parse(text)        -> { ast, errors }           text to tree (first syntax error only)
//   analyze(text)      -> { ast, errors, warnings } parse plus the checker (names, types, friendly errors)
//   format(ast)        -> text                      tree to canonical text (formatWithMap also gives spans)
//   toBlocks(ast)      -> BlockProgram              tree to blocks
//   fromBlocks(blocks) -> ast                       blocks to tree
//   compile(text|ast)  -> { ok, program, errors }   tree to bytecode for the interpreter
//   new Vm(program)    -> a run on virtual time     run(host, untilMicros), step, reset, setMillis
//   runProgram(text, { seconds }) -> traces on a virtual board (tests, solution checks, the CI referee)

import type { Program } from "./ast";
import { check } from "./check";
import { byPosition, type Diagnostic } from "./errors";
import { parse } from "./parser";

export * from "./ast";
export { parse, type ParseResult } from "./parser";
export { check, literalValue, type Checked, type VarSym, type ConstSym, type FuncInfo } from "./check";
export { format, formatWithMap, formatExpr, typeText, type FormatOptions } from "./format";
export { toBlocks, fromBlocks, BlockError, BLOCK_TYPES, type BlockNode, type BlockProgram, type BlockLayout } from "./blocks";
export { compile, Op, type Compiled, type CompileResult, type CompiledFunc } from "./compile";
export { Vm, Drive, formatNumber, type BoardHost, type DriveMode, type RunStop, type RunNote, type VmOptions } from "./vm";
export { VirtualBoard, runProgram, type PinEvent, type SerialLine, type RunOptions, type RunResult, type VirtualBoardOptions } from "./board";
export { describe, byPosition, type Diagnostic, type ErrorKind } from "./errors";
export { BUILTINS, BUILTIN_BY_NAME, CONSTANTS, PWM_PINS, PIN_COUNT, TYPE_NAMES, pinName, type Builtin } from "./builtins";
export { wrapTo, common, promote, literalType, typeName } from "./types";

export type Analysis = { ast: Program | null; errors: Diagnostic[]; warnings: Diagnostic[] };

/** Reads and checks a program: the tree (null when the text cannot be read) and every mistake, first one first. */
export function analyze(source: string): Analysis {
  const p = parse(source);
  if (!p.ast) return { ast: null, errors: p.errors, warnings: [] };
  const c = check(p.ast);
  return { ast: p.ast, errors: [...c.errors].sort(byPosition), warnings: c.warnings };
}
