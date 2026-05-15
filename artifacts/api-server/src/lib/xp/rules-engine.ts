/**
 * Closed-DSL rule evaluator for badge unlocks and declarative predicates.
 * NEVER uses eval/Function — only walks a typed JSON tree.
 *
 * Node types:
 *
 *   Simple stat:
 *     { stat: <key>, op: ">="|">"|"<="|"<"|"=="|"!=", value: number }
 *
 *   Named predicates (spec-required):
 *     { predicate: "count_action";  action: string; since?: "season"; gte: number }
 *     { predicate: "total_xp";      scope: "season" | "all_time";     gte: number }
 *     { predicate: "streak_days_at_least"; n: number }
 *     { predicate: "has_badge";     key: string }
 *     { predicate: "seasonal_rank_at_most"; n: number }
 *     { predicate: "student_plays_on_shared_content"; at_least: number }
 *
 *   Combinators:
 *     { all: [ ...nodes ] }   — logical AND
 *     { any: [ ...nodes ] }   — logical OR
 *     { not: <node> }
 *     true | false
 *
 * `stats` is a flat key→number map.  Named predicates resolve against
 * namespaced keys that are pre-computed by the badge evaluator before
 * calling this function:
 *
 *   count_action:{action}            → number of events with that action_key
 *   count_action:{action}:season     → same, restricted to current season
 *   has_badge:{badge_key}            → 1 if earned, 0 if not
 *   seasonal_rank                    → teacher's rank in current season (1 = top)
 *   student_plays_on_shared_content  → cumulative student plays on shared content
 *   current_streak_days, total_xp, season_xp, …   (from teacher_stats)
 */

export type RuleNode =
  | boolean
  | StatNode
  | PredicateNode
  | AllNode
  | AnyNode
  | NotNode;

interface StatNode {
  stat: string;
  op: string;
  value: number;
}

type PredicateNode =
  | { predicate: "count_action"; action: string; since?: "season"; gte: number }
  | { predicate: "total_xp"; scope: "season" | "all_time"; gte: number }
  | { predicate: "streak_days_at_least"; n: number }
  | { predicate: "has_badge"; key: string }
  | { predicate: "seasonal_rank_at_most"; n: number }
  | {
      predicate: "student_plays_on_shared_content";
      at_least: number;
    };

interface AllNode {
  all: RuleNode[];
}
interface AnyNode {
  any: RuleNode[];
}
interface NotNode {
  not: RuleNode;
}

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

function evalPredicate(node: PredicateNode, stats: StatLookup): boolean {
  switch (node.predicate) {
    case "count_action": {
      const key = node.since === "season"
        ? `count_action:${node.action}:season`
        : `count_action:${node.action}`;
      return (stats[key] ?? 0) >= node.gte;
    }
    case "total_xp": {
      const key = node.scope === "season" ? "season_xp" : "total_xp";
      return (stats[key] ?? 0) >= node.gte;
    }
    case "streak_days_at_least":
      return (stats["current_streak_days"] ?? 0) >= node.n;
    case "has_badge":
      return (stats[`has_badge:${node.key}`] ?? 0) >= 1;
    case "seasonal_rank_at_most": {
      const rank = stats["seasonal_rank"];
      if (rank == null || rank <= 0) return false;
      return rank <= node.n;
    }
    case "student_plays_on_shared_content":
      return (stats["student_plays_on_shared_content"] ?? 0) >= node.at_least;
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

  // Named predicate node
  if ("predicate" in obj && typeof obj.predicate === "string") {
    return evalPredicate(obj as unknown as PredicateNode, stats);
  }

  // Simple stat node
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
