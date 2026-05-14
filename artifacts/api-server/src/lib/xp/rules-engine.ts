/**
 * Closed-DSL rule evaluator for badge unlocks and similar declarative
 * predicates. NEVER uses eval/Function — only walks a typed JSON tree.
 *
 * Supported nodes:
 *   { stat: <key>, op: ">="|">"|"<="|"<"|"=="|"!=", value: number }
 *   { all: [ ...nodes ] }   // logical AND
 *   { any: [ ...nodes ] }   // logical OR
 *   { not: <node> }
 *   true | false
 *
 * `stat` keys come from a TeacherStats-shaped object passed in.
 */
export type RuleNode =
  | { stat: string; op: string; value: number }
  | { all: RuleNode[] }
  | { any: RuleNode[] }
  | { not: RuleNode }
  | boolean;

export type StatLookup = Record<string, number | undefined>;

const ALLOWED_OPS = new Set([">=", ">", "<=", "<", "==", "!="]);

function compareNumbers(a: number, op: string, b: number): boolean {
  switch (op) {
    case ">=":
      return a >= b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case "<":
      return a < b;
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    default:
      return false;
  }
}

export function evaluateRule(node: unknown, stats: StatLookup): boolean {
  if (node === true) return true;
  if (node === false) return false;
  if (!node || typeof node !== "object") return false;

  const obj = node as Record<string, unknown>;

  if ("all" in obj && Array.isArray(obj.all)) {
    return obj.all.every((n) => evaluateRule(n, stats));
  }
  if ("any" in obj && Array.isArray(obj.any)) {
    return obj.any.some((n) => evaluateRule(n, stats));
  }
  if ("not" in obj) {
    return !evaluateRule(obj.not, stats);
  }
  if ("stat" in obj && "op" in obj && "value" in obj) {
    const key = obj.stat;
    const op = obj.op;
    const val = obj.value;
    if (typeof key !== "string") return false;
    if (typeof op !== "string" || !ALLOWED_OPS.has(op)) return false;
    if (typeof val !== "number" || !Number.isFinite(val)) return false;
    const actual = stats[key];
    if (typeof actual !== "number") return false;
    return compareNumbers(actual, op, val);
  }
  return false;
}
