"use client";

import { useEffect, useRef, useState } from "react";
import { Difficulty, FONT_OPTIONS, GameSettings, Op, PRESETS, UiSettings } from "@/lib/types";
import { opSymbol } from "@/lib/problems";

const OP_LABELS: Record<Op, string> = {
  add: "Addition",
  sub: "Subtraction",
  mul: "Multiplication",
  div: "Division",
};

export default function Home({
  settings,
  setSettings,
  ui,
  setUi,
  onStart,
}: {
  settings: GameSettings;
  setSettings: (s: GameSettings) => void;
  ui: UiSettings;
  setUi: (u: UiSettings) => void;
  onStart: () => void;
}) {
  const [durationText, setDurationText] = useState(String(settings.durationSec));
  const [showUi, setShowUi] = useState(false);
  const uiPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showUi) return;
    let raf = 0;
    // estimate the panel's eventual bottom position immediately (don't wait for
    // the slide-down animation), so the scroll feels instant.
    const el = uiPanelRef.current;
    // Fixed velocity in px/sec. Constant throughout — independent of whether the
    // panel is still expanding, so it never feels "fast then slow".
    const VELOCITY = 900;
    let lastFrame = performance.now();
    const step = (now: number) => {
      const rect = el?.getBoundingClientRect();
      if (!rect) return;
      const target = window.scrollY + rect.bottom - window.innerHeight + 28;
      const remaining = target - window.scrollY;
      if (remaining <= 0.5) return;
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      const move = Math.min(remaining, VELOCITY * dt);
      window.scrollTo(0, window.scrollY + move);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showUi]);

  const setOp = (op: Op, patch: Partial<GameSettings["ops"][Op]>) =>
    setSettings({
      ...settings,
      difficulty: "custom",
      ops: { ...settings.ops, [op]: { ...settings.ops[op], ...patch } },
    });

  const setDifficulty = (d: Difficulty) => {
    if (d === "custom") {
      setSettings({ ...settings, difficulty: "custom" });
      return;
    }
    setSettings({ ...settings, difficulty: d, ops: PRESETS[d] });
  };

  const commitDuration = () => {
    const n = Math.max(1, Math.floor(Number(durationText) || 1));
    setSettings({ ...settings, durationSec: n });
    setDurationText(String(n));
  };

  const DURATION_PRESETS = [15, 30, 60, 120] as const;
  type DurationChoice = (typeof DURATION_PRESETS)[number] | "custom";
  const [customDuration, setCustomDuration] = useState(
    !(DURATION_PRESETS as readonly number[]).includes(settings.durationSec),
  );
  const durationChoice: DurationChoice = customDuration
    ? "custom"
    : (settings.durationSec as DurationChoice);
  const setDurationChoice = (c: DurationChoice) => {
    if (c === "custom") {
      setCustomDuration(true);
      setDurationText(String(settings.durationSec));
      return;
    }
    setCustomDuration(false);
    setSettings({ ...settings, durationSec: c });
    setDurationText(String(c));
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-end gap-4 mb-1 -mt-2">
          <div className="translate-y-3">
            <WindMark />
          </div>
          <span className="haste-logo-wrap" data-text="Haste">
            <h1 className="haste-logo">Haste</h1>
          </span>
        </div>
        <p className="text-neutral-500 mb-8 ml-1 text-sm">
          A mental arithmetic game
        </p>

        <div className="card p-4 mb-4 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-medium text-neutral-700 w-20 shrink-0">Time</span>
            <div className="flex-1">
              <Pills
                value={String(durationChoice)}
                onChange={(v) =>
                  setDurationChoice(v === "custom" ? "custom" : (Number(v) as DurationChoice))
                }
                options={[
                  ...DURATION_PRESETS.map((n) => [String(n), `${n}s`] as [string, string]),
                  ["custom", "Custom"] as [string, string],
                ]}
              />
            </div>
            {durationChoice === "custom" && (
              <label className="flex items-center gap-1.5 text-neutral-700 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  value={durationText}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d*$/.test(v)) setDurationText(v);
                  }}
                  onBlur={commitDuration}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="input-clean w-20 text-center tabular-nums"
                  autoFocus
                />
                s
              </label>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium text-neutral-700 w-20 shrink-0">Difficulty</span>
            <div className="flex-1">
              <Pills
                value={settings.difficulty}
                onChange={(v) => setDifficulty(v as Difficulty)}
                options={[
                  ["easy", "Easy"],
                  ["normal", "Normal"],
                  ["hard", "Hard"],
                  ["custom", "Custom"],
                ]}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {(Object.keys(settings.ops) as Op[]).map((op) => {
            const r = settings.ops[op];
            const derived = op === "sub" || op === "div";
            return (
              <div
                key={op}
                className="card p-4 flex items-center gap-3"
              >
                <label className="flex items-center gap-2.5 font-semibold w-36 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => setOp(op, { enabled: e.target.checked })}
                    className="w-4 h-4 accent-neutral-900"
                  />
                  <span className="text-neutral-900">{OP_LABELS[op]}</span>
                </label>

                <div className="flex items-center gap-2 flex-1 justify-end">
                  {derived ? (
                    <span className="text-neutral-500 text-sm italic">
                      {op === "sub" ? "Addition" : "Multiplication"} problems in reverse.
                    </span>
                  ) : (
                    <>
                      <NumBox value={r.aMin} onChange={(v) => setOp(op, { aMin: v })} />
                      <span className="text-neutral-500">to</span>
                      <NumBox value={r.aMax} onChange={(v) => setOp(op, { aMax: v })} />
                      <span className="text-xl font-bold mx-3">{opSymbol(op)}</span>
                      <NumBox value={r.bMin} onChange={(v) => setOp(op, { bMin: v })} />
                      <span className="text-neutral-500">to</span>
                      <NumBox value={r.bMax} onChange={(v) => setOp(op, { bMax: v })} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button
            onClick={() => {
              commitDuration();
              onStart();
            }}
            className="btn-primary ml-auto"
          >
            Start
          </button>

          <button
            onClick={() => setShowUi((s) => !s)}
            className={`p-2 rounded-lg border transition-all ${
              showUi
                ? "bg-neutral-900 text-white border-neutral-900 rotate-45"
                : "border-neutral-300 hover:bg-white hover:border-neutral-400"
            }`}
            aria-label="Display settings"
            title="Display settings"
          >
            <GearIcon />
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-[12px] text-neutral-500">
          <span>During game:</span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-300 shadow-sm text-neutral-700 text-[11px] font-medium">
              Tab
            </kbd>
            <span>restart</span>
          </span>
          <span className="text-neutral-300">·</span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-300 shadow-sm text-neutral-700 text-[11px] font-medium">
              Esc
            </kbd>
            <span>back to home</span>
          </span>
        </div>

        <div className={`smooth-collapse ${showUi ? "open mt-4" : ""}`}>
          <div>
            <div ref={uiPanelRef} className="card p-4 space-y-4 text-sm">
              <div>
                <label className="block mb-1 font-medium">
                  Countdown before start: {settings.countdownSec}s
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={settings.countdownSec}
                  onChange={(e) =>
                    setSettings({ ...settings, countdownSec: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Font size: {ui.fontSize}px</label>
                <input
                  type="range"
                  min={48}
                  max={240}
                  step={4}
                  value={ui.fontSize}
                  onChange={(e) => setUi({ ...ui, fontSize: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Font family</label>
                <select
                  value={ui.fontFamily}
                  onChange={(e) => setUi({ ...ui, fontFamily: e.target.value })}
                  className="w-full border border-neutral-300 rounded px-2 py-1"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <Pills
                label="Timer"
                value={ui.timerMode}
                onChange={(m) => setUi({ ...ui, timerMode: m })}
                options={[
                  ["corner", "Top-left"],
                  ["hide", "Hide"],
                  ["large", "Large above"],
                ]}
              />
              <Pills
                label="Score"
                value={ui.countMode}
                onChange={(m) => setUi({ ...ui, countMode: m })}
                options={[
                  ["corner", "Top-right"],
                  ["hide", "Hide"],
                  ["large", "Large below"],
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NumBox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        if (/^-?\d*$/.test(v)) setText(v);
      }}
      onBlur={() => {
        const n = Number(text);
        if (Number.isFinite(n)) {
          onChange(n);
          setText(String(n));
        } else {
          setText(String(value));
        }
      }}
      className="input-clean w-16 text-center tabular-nums"
    />
  );
}

function Pills<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  const idx = options.findIndex(([v]) => v === value);
  const widthPct = 100 / options.length;
  return (
    <div>
      {label && <div className="font-medium mb-1">{label}</div>}
      <div
        className="relative grid bg-neutral-200/70 rounded-xl p-1 shadow-inner"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <div
          className="absolute top-1 bottom-1 rounded-lg bg-neutral-900 transition-all duration-300 ease-out shadow"
          style={{ width: `calc(${widthPct}% - 8px)`, left: `calc(${idx * widthPct}% + 4px)` }}
        />
        {options.map(([v, l]) => (
          <button
            key={v}
            className={`relative z-10 px-2 py-1 text-sm font-medium transition-colors ${
              value === v ? "text-white" : "text-neutral-700 hover:text-black"
            }`}
            onClick={() => onChange(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function WindMark() {
  const strokeProps = {
    fill: "none",
    stroke: "url(#windStroke)",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg
      width="120"
      height="96"
      viewBox="0 0 220 140"
      fill="none"
      aria-hidden="true"
      className="drop-shadow-[0_3px_10px_rgba(245,158,11,0.30)]"
    >
      <defs>
        <linearGradient id="windStroke" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0%" stopColor="#0b1220" />
          <stop offset="65%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="windStrokeSoft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#475569" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="windGlow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <filter id="windBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <ellipse cx="115" cy="75" rx="100" ry="55" fill="url(#windGlow)" />

      <g opacity="0.18" filter="url(#windBlur)">
        <use href="#windGroup" transform="translate(-22 0)" />
      </g>
      <g opacity="0.32" filter="url(#windBlur)">
        <use href="#windGroup" transform="translate(-12 0)" />
      </g>

      <g id="windGroup">
        {/* top stream — short, curl on the left */}
        <path
          {...strokeProps}
          strokeWidth="9"
          d="M 40 36
             C 24 36, 24 22, 40 22
             L 96 22
             Q 124 22, 138 38
             Q 148 50, 168 44"
        />
        {/* middle stream — longest, biggest curl */}
        <path
          {...strokeProps}
          strokeWidth="11"
          d="M 24 76
             C 6 76, 6 58, 24 58
             L 138 58
             Q 174 58, 192 78
             Q 202 90, 178 96"
        />
        {/* bottom stream — short, lower */}
        <path
          {...strokeProps}
          strokeWidth="8"
          d="M 46 114
             C 32 114, 32 102, 46 102
             L 104 102
             Q 124 102, 134 114"
        />
        {/* small faint accent above */}
        <path
          fill="none"
          stroke="url(#windStrokeSoft)"
          strokeWidth="5"
          strokeLinecap="round"
          d="M 110 10
             Q 134 10, 144 22"
        />
      </g>

      <g fill="#fde68a">
        <circle cx="200" cy="44" r="1.8" />
        <circle cx="184" cy="22" r="1.4" />
        <circle cx="162" cy="116" r="1.6" />
      </g>
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
