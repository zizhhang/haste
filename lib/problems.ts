import { GameSettings, Op, Problem, RangeConfig } from "./types";

function randInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeAdd(r: RangeConfig): Problem {
  const a = randInt(r.aMin, r.aMax);
  const b = randInt(r.bMin, r.bMax);
  return { op: "add", a, b, answer: a + b };
}

function makeSub(r: RangeConfig): Problem {
  // produce positive results: (a+b) - b = a, where a,b drawn from add-style ranges
  const a = randInt(r.aMin, r.aMax);
  const b = randInt(r.bMin, r.bMax);
  return { op: "sub", a: a + b, b, answer: a };
}

function makeMul(r: RangeConfig): Problem {
  const a = randInt(r.aMin, r.aMax);
  const b = randInt(r.bMin, r.bMax);
  return { op: "mul", a, b, answer: a * b };
}

function makeDiv(r: RangeConfig): Problem {
  // (a*b) / b = a — divisor is the second number
  const a = randInt(r.aMin, r.aMax);
  const b = randInt(r.bMin, r.bMax);
  return { op: "div", a: a * b, b, answer: a };
}

function rangeFor(settings: GameSettings, op: Op): RangeConfig {
  // sub mirrors add. For div, swap mul's ranges so the divisor (b) is always
  // the smaller side and the quotient (a) is the larger side.
  if (op === "sub") return settings.ops.add;
  if (op === "div") {
    const m = settings.ops.mul;
    const [smallMin, smallMax, bigMin, bigMax] =
      m.aMax - m.aMin <= m.bMax - m.bMin
        ? [m.aMin, m.aMax, m.bMin, m.bMax]
        : [m.bMin, m.bMax, m.aMin, m.aMax];
    return {
      enabled: settings.ops.div.enabled,
      aMin: bigMin,
      aMax: bigMax,
      bMin: smallMin,
      bMax: smallMax,
    };
  }
  return settings.ops[op];
}

function makeFor(op: Op, r: RangeConfig): Problem {
  switch (op) {
    case "add":
      return makeAdd(r);
    case "sub":
      return makeSub(r);
    case "mul":
      return makeMul(r);
    case "div":
      return makeDiv(r);
  }
}

export function generateProblem(settings: GameSettings, avoid?: Problem | null): Problem {
  const enabled: Op[] = (Object.keys(settings.ops) as Op[]).filter((k) => settings.ops[k].enabled);
  if (enabled.length === 0) {
    return makeAdd(settings.ops.add);
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const op = enabled[Math.floor(Math.random() * enabled.length)];
    const p = makeFor(op, rangeFor(settings, op));
    if (!avoid || avoid.op !== p.op || avoid.a !== p.a || avoid.b !== p.b) return p;
  }
  const op = enabled[Math.floor(Math.random() * enabled.length)];
  return makeFor(op, rangeFor(settings, op));
}

export function opSymbol(op: Op): string {
  return op === "add" ? "+" : op === "sub" ? "−" : op === "mul" ? "×" : "÷";
}

export function formatProblem(p: Problem): string {
  return `${p.a} ${opSymbol(p.op)} ${p.b}`;
}
