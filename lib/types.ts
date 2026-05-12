export type Op = "add" | "sub" | "mul" | "div";

export type Difficulty = "easy" | "normal" | "hard" | "custom";

export interface RangeConfig {
  enabled: boolean;
  // For add: a in [aMin..aMax] + b in [bMin..bMax]
  // For sub: derived from add (a+b - b style); we reuse add ranges to produce positive results
  // For mul: a in [aMin..aMax] * b in [bMin..bMax]
  // For div: derived from mul (a*b / b style)
  aMin: number;
  aMax: number;
  bMin: number;
  bMax: number;
}

export interface GameSettings {
  durationSec: number; // total play time
  countdownSec: number; // pre-start countdown
  difficulty: Difficulty;
  ops: Record<Op, RangeConfig>;
}

export type TimerMode = "corner" | "hide" | "large";
export type CountMode = "corner" | "hide" | "large";

export interface UiSettings {
  fontSize: number; // px applied to problem and input
  fontFamily: string;
  timerMode: TimerMode;
  countMode: CountMode;
}

export interface Problem {
  op: Op;
  a: number;
  b: number;
  answer: number;
}

export interface SolvedProblem extends Problem {
  // seconds from game start when this problem was finished
  finishedAt: number;
  // seconds spent on this problem (finishedAt - previousFinishedAt or - 0)
  timeTaken: number;
  // wrong "attempts" made on this problem before solving it
  wrongAttempts: number;
}

export interface SessionStats {
  totalAttempts: number;
  correctAttempts: number;
}

export const PRESETS: Record<Exclude<Difficulty, "custom">, Record<Op, RangeConfig>> = {
  easy: {
    add: { enabled: true, aMin: 1, aMax: 20, bMin: 1, bMax: 20 },
    sub: { enabled: true, aMin: 1, aMax: 20, bMin: 1, bMax: 20 },
    mul: { enabled: true, aMin: 1, aMax: 9, bMin: 1, bMax: 9 },
    div: { enabled: true, aMin: 1, aMax: 9, bMin: 1, bMax: 9 },
  },
  normal: {
    add: { enabled: true, aMin: 2, aMax: 100, bMin: 2, bMax: 100 },
    sub: { enabled: true, aMin: 2, aMax: 100, bMin: 2, bMax: 100 },
    mul: { enabled: true, aMin: 2, aMax: 12, bMin: 2, bMax: 100 },
    div: { enabled: true, aMin: 2, aMax: 100, bMin: 2, bMax: 12 },
  },
  hard: {
    add: { enabled: true, aMin: 10, aMax: 1000, bMin: 10, bMax: 1000 },
    sub: { enabled: true, aMin: 10, aMax: 1000, bMin: 10, bMax: 1000 },
    mul: { enabled: true, aMin: 5, aMax: 30, bMin: 5, bMax: 200 },
    div: { enabled: true, aMin: 5, aMax: 30, bMin: 5, bMax: 200 },
  },
};

export const DEFAULT_SETTINGS: GameSettings = {
  durationSec: 120,
  countdownSec: 1,
  difficulty: "normal",
  ops: PRESETS.normal,
};

export const DEFAULT_UI: UiSettings = {
  fontSize: 96,
  fontFamily: "ui-sans-serif",
  timerMode: "corner",
  countMode: "corner",
};

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Sans (System)", value: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { label: "Serif", value: "ui-serif, Georgia, Cambria, serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Rounded", value: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" },
];
