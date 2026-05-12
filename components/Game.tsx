"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameSettings, Problem, SolvedProblem, UiSettings } from "@/lib/types";
import { formatProblem, generateProblem } from "@/lib/problems";
import { playStart, playTick, unlockAudio } from "@/lib/sound";

export default function Game({
  settings,
  ui,
  onFinish,
  onExitHome,
}: {
  settings: GameSettings;
  ui: UiSettings;
  onFinish: (
    solved: SolvedProblem[],
    session: { totalAttempts: number; correctAttempts: number },
  ) => void;
  onExitHome: () => void;
}) {
  const [countdown, setCountdown] = useState(settings.countdownSec);
  const [phase, setPhase] = useState<"countdown" | "playing">("countdown");
  const [problem, setProblem] = useState<Problem>(() => generateProblem(settings));
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [solved, setSolved] = useState<SolvedProblem[]>([]);

  const startTimeRef = useRef<number | null>(null);
  const lastSolvedAtRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const finishedRef = useRef(false);

  // attempt tracking
  const prevInputRef = useRef("");
  const wasGrowingRef = useRef(false);
  const currentWrongRef = useRef(0);
  const totalAttemptsRef = useRef(0);
  const correctAttemptsRef = useRef(0);

  // unlock audio on mount (we got here from a Start click, so user gesture is active)
  useEffect(() => {
    unlockAudio();
  }, []);

  // countdown with tick sounds
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      playStart();
      setPhase("playing");
      startTimeRef.current = performance.now();
      lastSolvedAtRef.current = 0;
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    playTick();
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // game timer
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      if (startTimeRef.current == null) return;
      const e = (performance.now() - startTimeRef.current) / 1000;
      if (e >= settings.durationSec) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          setElapsed(settings.durationSec);
          onFinish(solved, {
            totalAttempts: totalAttemptsRef.current,
            correctAttempts: correctAttemptsRef.current,
          });
        }
        return;
      }
      setElapsed(e);
    }, 100);
    return () => clearInterval(id);
  }, [phase, settings.durationSec, solved, onFinish]);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setSolved([]);
    setInput("");
    setProblem(generateProblem(settings));
    setElapsed(0);
    setCountdown(settings.countdownSec);
    prevInputRef.current = "";
    wasGrowingRef.current = false;
    currentWrongRef.current = 0;
    totalAttemptsRef.current = 0;
    correctAttemptsRef.current = 0;
    setPhase("countdown");
  }, [settings]);

  // Tab to restart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        restart();
      } else if (e.key === "Escape") {
        onExitHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart, onExitHome]);

  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase, problem]);

  const onInput = (val: string) => {
    if (finishedRef.current) return;
    if (!/^-?\d*$/.test(val)) return;

    const prev = prevInputRef.current;
    if (val.length > prev.length) {
      wasGrowingRef.current = true;
    } else if (val.length < prev.length) {
      // shrink — first shrink after a growth counts the previous value as a wrong attempt
      if (wasGrowingRef.current && prev !== "" && prev !== "-") {
        currentWrongRef.current += 1;
        totalAttemptsRef.current += 1;
      }
      wasGrowingRef.current = false;
    }
    prevInputRef.current = val;

    setInput(val);
    if (val === "" || val === "-") return;

    const n = Number(val);
    if (n === problem.answer) {
      const now = startTimeRef.current ? (performance.now() - startTimeRef.current) / 1000 : 0;
      if (now > settings.durationSec) return;
      const sp: SolvedProblem = {
        ...problem,
        finishedAt: now,
        timeTaken: now - lastSolvedAtRef.current,
        wrongAttempts: currentWrongRef.current,
      };
      lastSolvedAtRef.current = now;
      totalAttemptsRef.current += 1;
      correctAttemptsRef.current += 1;
      currentWrongRef.current = 0;
      wasGrowingRef.current = false;
      prevInputRef.current = "";
      setSolved((s) => [...s, sp]);
      setInput("");
      setProblem((p) => generateProblem(settings, p));
    }
  };

  const remaining = Math.max(0, Math.ceil(settings.durationSec - elapsed));
  const score = solved.length;

  return (
    <main className="min-h-screen relative" style={{ fontFamily: ui.fontFamily }}>
      {phase === "playing" && ui.timerMode === "corner" && (
        <div className="absolute top-4 left-4 text-2xl font-mono tabular-nums text-neutral-900">
          {remaining}
        </div>
      )}
      {phase === "playing" && ui.countMode === "corner" && (
        <div className="absolute top-4 right-4 text-2xl font-mono tabular-nums text-neutral-900">
          {score}
        </div>
      )}

      <button
        onClick={onExitHome}
        className="absolute bottom-5 left-5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        ← Home
      </button>
      <div className="absolute bottom-5 right-5 text-[11px] text-neutral-400 tracking-wide">
        <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-neutral-200 mr-1">Tab</kbd>
        restart
        <span className="mx-2 text-neutral-300">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-neutral-200 mr-1">Esc</kbd>
        exit
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        {phase === "countdown" ? (
          <div className="text-center">
            <div className="text-neutral-500 mb-3">Starting in</div>
            <div className="text-[10rem] font-bold leading-none tabular-nums">{countdown}</div>
          </div>
        ) : (
          <>
            {ui.timerMode === "large" && (
              <div className="mb-6 text-7xl font-bold tabular-nums">{remaining}</div>
            )}
            <div
              className="font-bold tabular-nums text-neutral-900"
              style={{ fontSize: ui.fontSize }}
            >
              {formatProblem(problem)}
            </div>
            <input
              ref={inputRef}
              className="no-spin mt-3 text-center border-4 border-neutral-200 focus:border-neutral-400 rounded-lg bg-white outline-none tabular-nums px-4 py-2 text-neutral-900 shadow-sm"
              style={{
                fontSize: ui.fontSize * 0.8,
                width: `${Math.max(5, ui.fontSize * 0.09)}ch`,
                caretColor: "transparent",
              }}
              value={input}
              onChange={(e) => onInput(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
            {ui.countMode === "large" && (
              <div className="mt-8 text-7xl font-bold tabular-nums">{score}</div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
