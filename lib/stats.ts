import { Difficulty, Op, SolvedProblem } from "./types";

export function digits(n: number): number {
  return Math.abs(n).toString().length;
}

// normalised speed is always out of 120s
export const NS_DURATION = 120;
export function ns(mean: number | null): number | null {
  if (mean == null || mean <= 0) return null;
  return Math.floor(NS_DURATION / mean);
}

export function meanTime(problems: SolvedProblem[]): number | null {
  if (problems.length === 0) return null;
  const total = problems.reduce((s, p) => s + p.timeTaken, 0);
  return total / problems.length;
}

export interface Bucket {
  label: string;
  problems: SolvedProblem[];
}

export interface OpBreakdown {
  add: Bucket[];
  sub: Bucket[];
  mul: Bucket[];
  div: Bucket[];
}

const DIGIT_WORD = ["", "single", "double", "triple", "quad"] as const;
function digitWord(n: number) {
  return DIGIT_WORD[n] || `${n}-digit`;
}

function bucketByDigitPair(
  problems: SolvedProblem[],
  pairs: [number, number][],
): Bucket[] {
  const map = new Map<string, SolvedProblem[]>();
  for (const [da, db] of pairs) map.set(`${da}x${db}`, []);
  for (const p of problems) {
    const da = digits(p.a);
    const db = digits(p.b);
    // try exact, otherwise nearest by sorted pair (low,high)
    const k = `${da}x${db}`;
    if (map.has(k)) {
      map.get(k)!.push(p);
      continue;
    }
    const sortedK = `${Math.min(da, db)}x${Math.max(da, db)}`;
    if (map.has(sortedK)) map.get(sortedK)!.push(p);
  }
  return pairs.map(([da, db]) => ({
    label: `${digitWord(da)} × ${digitWord(db)}`,
    problems: map.get(`${da}x${db}`) || [],
  }));
}

function bucketByKey(
  problems: SolvedProblem[],
  keys: number[],
  pick: (p: SolvedProblem) => number,
  fmt: (k: number) => string,
): Bucket[] {
  const map = new Map<number, SolvedProblem[]>();
  for (const k of keys) map.set(k, []);
  for (const p of problems) {
    const k = pick(p);
    if (map.has(k)) map.get(k)!.push(p);
  }
  return keys.map((k) => ({ label: fmt(k), problems: map.get(k) || [] }));
}

export function breakdown(problems: SolvedProblem[], difficulty: Difficulty): OpBreakdown {
  const byOp = groupByOp(problems);
  const out: OpBreakdown = { add: [], sub: [], mul: [], div: [] };

  if (difficulty === "easy") return out; // no subcategories at all

  if (difficulty === "hard") {
    const addPairs: [number, number][] = [
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 3],
      [3, 4],
      [4, 4],
    ];
    out.add = bucketByDigitPair(byOp.add, addPairs);
    out.sub = bucketByDigitPair(byOp.sub, addPairs);

    const muldivPairs: [number, number][] = [
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 2],
      [2, 3],
    ];
    out.mul = bucketByDigitPair(byOp.mul, muldivPairs);
    out.div = bucketByDigitPair(byOp.div, muldivPairs);
    return out;
  }

  // normal / custom — current behaviour
  const addSubPairs: { label: string; test: (da: number, db: number) => boolean }[] = [
    { label: "single × single", test: (da, db) => da === 1 && db === 1 },
    { label: "single × multi", test: (da, db) => (da === 1) !== (db === 1) },
    { label: "multi × multi", test: (da, db) => da > 1 && db > 1 },
  ];
  for (const op of ["add", "sub"] as const) {
    out[op] = addSubPairs.map((b) => ({
      label: b.label,
      problems: byOp[op].filter((p) => b.test(digits(p.a), digits(p.b))),
    }));
  }

  // mul: bucket by first number across the range present in problems (fallback 2..12)
  const mulKeys = new Set<number>();
  byOp.mul.forEach((p) => mulKeys.add(p.a));
  // ensure 2..12 at minimum for normal preset
  for (let i = 2; i <= 12; i++) mulKeys.add(i);
  out.mul = bucketByKey(
    byOp.mul,
    Array.from(mulKeys).sort((a, b) => a - b),
    (p) => p.a,
    (k) => `×${k}`,
  );
  const divKeys = new Set<number>();
  byOp.div.forEach((p) => divKeys.add(p.b));
  for (let i = 2; i <= 12; i++) divKeys.add(i);
  out.div = bucketByKey(
    byOp.div,
    Array.from(divKeys).sort((a, b) => a - b),
    (p) => p.b,
    (k) => `÷${k}`,
  );
  return out;
}

export function groupByOp(problems: SolvedProblem[]): Record<Op, SolvedProblem[]> {
  const out: Record<Op, SolvedProblem[]> = { add: [], sub: [], mul: [], div: [] };
  for (const p of problems) out[p.op].push(p);
  return out;
}

export function accuracy(problems: SolvedProblem[]): number | null {
  if (problems.length === 0) return null;
  const correct = problems.length;
  const wrong = problems.reduce((s, p) => s + p.wrongAttempts, 0);
  const total = correct + wrong;
  if (total === 0) return null;
  return correct / total;
}

export function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

// returns quintile boundaries (4 cut points) sorted asc; if not enough samples
// returns equal-spaced cuts spanning min..max.
export function quintiles(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0, 0];
  const sorted = [...values].sort((x, y) => x - y);
  const cuts: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const idx = (i / 5) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const w = idx - lo;
    cuts.push(sorted[lo] * (1 - w) + sorted[hi] * w);
  }
  return cuts;
}

// returns quintile index 0..4 (0 fastest/green, 4 slowest/red)
export function quintileOf(t: number, cuts: number[]): number {
  for (let i = 0; i < cuts.length; i++) if (t < cuts[i]) return i;
  return 4;
}

export const QUINTILE_COLORS = [
  "#16a34a", // 0 fastest – green
  "#84cc16",
  "#facc15",
  "#f97316",
  "#dc2626", // 4 slowest – red
];

export function perSecondCumulative(
  problems: SolvedProblem[],
  duration: number,
): { second: number; solved: number }[] {
  const data: { second: number; solved: number }[] = [{ second: 0, solved: 0 }];
  for (let s = 1; s <= duration; s++) {
    const solved = problems.filter((p) => Math.min(p.finishedAt, duration) <= s).length;
    data.push({ second: s, solved });
  }
  if (data.length > 0) data[data.length - 1].solved = problems.length;
  return data;
}
