"use client";

import { useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { GameSettings, Op, SessionStats, SolvedProblem } from "@/lib/types";
import {
  accuracy,
  breakdown,
  formatPct,
  groupByOp,
  meanTime,
  ns,
  NS_DURATION,
  perSecondNs,
  QUINTILE_COLORS,
  quintileOf,
  quintiles,
} from "@/lib/stats";
import type { Bucket } from "@/lib/stats";
import { formatProblem } from "@/lib/problems";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export default function Results({
  problems,
  settings,
  session,
  finishedAt: finishedAtMs,
  onHome,
  onRestart,
}: {
  problems: SolvedProblem[];
  settings: GameSettings;
  session: SessionStats;
  finishedAt: number;
  onHome: () => void;
  onRestart: () => void;
}) {
  const finishedAt = new Date(finishedAtMs);
  const stampDate = finishedAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const stampTime = finishedAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const overallAcc =
    session.totalAttempts > 0 ? session.correctAttempts / session.totalAttempts : null;
  const duration = settings.durationSec;
  const score = problems.length;

  const grouped = groupByOp(problems);
  const opLabel: Record<Op, string> = {
    add: "Addition",
    sub: "Subtraction",
    mul: "Multiplication",
    div: "Division",
  };

  const br = breakdown(problems, settings.difficulty);
  // overall NS = projected score at 120s based on actual sustained pace
  // (final score / duration), not per-problem mean (which ignores idle time).
  const overallNs = duration > 0 ? Math.floor((NS_DURATION * score) / duration) : null;

  const perSecond = perSecondNs(problems, duration);
  const errorsBySecond = (() => {
    const m = new Map<number, number>();
    for (const p of problems) {
      if (p.wrongAttempts <= 0) continue;
      const s = Math.min(duration, Math.max(1, Math.ceil(p.finishedAt)));
      m.set(s, (m.get(s) ?? 0) + p.wrongAttempts);
    }
    return m;
  })();
  const chartData = perSecond.map((d) => ({
    second: d.second,
    ns: d.ns,
    even: overallNs,
    score: problems.filter((p) => p.finishedAt <= d.second).length,
    errors: errorsBySecond.get(d.second) ?? null,
  }));

  // Y-axis range excludes the warmup zeros so the post-warmup amplitude is
  // legible. The line still draws warmup values — they just sit off-screen.
  const positiveNs = chartData.map((d) => d.ns).filter((n) => n > 0);
  const nsLower =
    positiveNs.length > 0 ? Math.max(0, Math.min(...positiveNs) - 10) : 0;
  const nsUpper =
    positiveNs.length > 0 ? Math.max(...positiveNs) + 10 : 120;
  const hasBreakdown = settings.difficulty === "normal";

  const allSubNs = useMemo(() => {
    const vals: number[] = [];
    const push = (probs: SolvedProblem[]) => {
      const v = ns(meanTime(probs));
      if (v != null) vals.push(v);
    };
    for (const op of ["add", "sub", "mul", "div"] as const) {
      for (const b of br[op]) push(b.problems);
    }
    return vals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [br]);

  const heatRange = useMemo(() => {
    if (allSubNs.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...allSubNs), max: Math.max(...allSubNs) };
  }, [allSubNs]);

  const subBg = (probs: SolvedProblem[]): string | undefined => {
    const v = ns(meanTime(probs));
    if (v == null) return undefined;
    if (heatRange.max === heatRange.min) return "rgba(132, 204, 22, 0.25)";
    const t = (v - heatRange.min) / (heatRange.max - heatRange.min);
    const h = Math.round(120 * t);
    return `hsl(${h}, 70%, 75%)`;
  };

  // separate heatmap range for the four main category cards
  const mainNs = useMemo(() => {
    const vals: number[] = [];
    for (const op of ["add", "sub", "mul", "div"] as const) {
      const v = ns(meanTime(grouped[op]));
      if (v != null) vals.push(v);
    }
    return vals;
  }, [grouped]);
  const mainRange = useMemo(() => {
    if (mainNs.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...mainNs), max: Math.max(...mainNs) };
  }, [mainNs]);
  const mainBg = (probs: SolvedProblem[]): string | undefined => {
    const v = ns(meanTime(probs));
    if (v == null) return undefined;
    if (mainNs.length < 2 || mainRange.max === mainRange.min)
      return "rgba(132, 204, 22, 0.18)";
    const t = (v - mainRange.min) / (mainRange.max - mainRange.min);
    const h = Math.round(120 * t);
    return `hsl(${h}, 70%, 82%)`;
  };

  const times = problems.map((p) => p.timeTaken);
  const cuts = quintiles(times);
  const minT = times.length ? Math.min(...times) : 0;
  const maxT = times.length ? Math.max(...times) : 0;

  const shotRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [shooting, setShooting] = useState(false);

  const handleScreenshot = async () => {
    const node = shotRef.current;
    if (!node || shooting) return;
    setShooting(true);
    node.classList.add("shot-mode");
    try {
      // Allow the browser a frame to apply .shot-mode style overrides
      // before we measure & rasterise.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const rect = node.getBoundingClientRect();
      // Measure to the last child's bottom so the trailing card margin
      // doesn't add empty space at the bottom of the capture, without
      // having to mutate the live layout.
      const last = node.lastElementChild as HTMLElement | null;
      const bottom = last ? last.getBoundingClientRect().bottom : rect.bottom;
      const opts = {
        pixelRatio: 2,
        cacheBust: true,
        width: Math.ceil(rect.width),
        height: Math.ceil(bottom - rect.top),
        style: { transform: "none", margin: "0" },
      } as const;
      // First pass primes Recharts / lazy styles; some elements render
      // blank on the very first call. The second pass is the real capture.
      await toBlob(node, opts);
      await new Promise((r) => setTimeout(r, 50));
      const blob = await toBlob(node, opts);
      if (!blob) throw new Error("Failed to render image");
      if (
        typeof ClipboardItem === "undefined" ||
        !navigator.clipboard?.write
      ) {
        throw new Error("Clipboard images not supported in this browser");
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setToast({ kind: "ok", msg: "Screenshot copied to clipboard" });
    } catch (e: any) {
      setToast({
        kind: "err",
        msg: e?.message ?? "Could not copy screenshot",
      });
    } finally {
      node.classList.remove("shot-mode");
      setShooting(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const xTicks = (() => {
    const step = duration <= 30 ? 5 : duration <= 90 ? 10 : 15;
    const out: number[] = [];
    for (let i = step; i <= duration; i += step) out.push(i);
    if (out[out.length - 1] !== duration) out.push(duration);
    return out;
  })();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Results</h1>
          <div className="flex gap-2">
            <button
              onClick={onHome}
              className="btn-ghost"
            >
              <HomeIcon /> Home
            </button>
            <button
              onClick={handleScreenshot}
              className="btn-ghost"
              disabled={shooting}
              aria-label="Copy screenshot of results to clipboard"
            >
              <CameraIcon /> {shooting ? "Capturing…" : "Screenshot"}
            </button>
            <button onClick={onRestart} className="btn-primary">
              <RetryIcon /> Restart
            </button>
          </div>
        </div>

        <div ref={shotRef}>
        <section className="card p-6 mb-6 flex items-end justify-between gap-6">
          <div>
            <div className="eyebrow">Final score</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-6xl font-bold tabular-nums text-neutral-900 leading-none">
                {score}
              </div>
              {duration !== NS_DURATION && (
                <div
                  className="inline-flex items-baseline gap-1 px-2 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-600"
                  title="Normalised: projected score in 120s at your sustained pace"
                >
                  <span className="text-[11px]">≈</span>
                  <span className="text-lg font-semibold tabular-nums text-neutral-800">
                    {overallNs ?? "—"}
                  </span>
                  <span className="text-[11px]">in 120s</span>
                </div>
              )}
            </div>
            <div className="text-neutral-500 text-sm mt-2 flex items-center gap-2">
              <span>in {duration}s</span>
              <span className="text-neutral-300">·</span>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                  settings.difficulty === "easy"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : settings.difficulty === "normal"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : settings.difficulty === "hard"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-neutral-100 text-neutral-700 border-neutral-200"
                }`}
              >
                {settings.difficulty[0].toUpperCase() + settings.difficulty.slice(1)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Typing accuracy</div>
            <div className="text-4xl font-bold tabular-nums text-neutral-900">
              {formatPct(overallAcc)}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              {session.correctAttempts}/{session.totalAttempts} attempts
            </div>
            <div className="text-[11px] text-neutral-400 mt-2 tabular-nums">
              {stampDate} · {stampTime}
            </div>
          </div>
        </section>

        <section className="card p-6 mb-6">
          <h2 className="section-title text-lg mb-3">Normalised Score</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 10, right: 24, bottom: 28, left: 16 }}>
                <CartesianGrid stroke="#eee" />
                <XAxis
                  dataKey="second"
                  type="number"
                  domain={[1, duration]}
                  ticks={xTicks}
                  tickMargin={6}
                  label={{ value: "Seconds", position: "insideBottom", offset: -16 }}
                />
                <YAxis
                  yAxisId="ns"
                  width={56}
                  allowDecimals={false}
                  domain={[nsLower, nsUpper]}
                  label={{
                    value: "NS",
                    angle: -90,
                    position: "insideLeft",
                    offset: 4,
                    style: { textAnchor: "middle" },
                  }}
                />
                <YAxis
                  yAxisId="errors"
                  orientation="right"
                  width={44}
                  allowDecimals={false}
                  domain={[0, (max: number) => Math.max(1, max)]}
                  label={{
                    value: "Errors",
                    angle: 90,
                    position: "insideRight",
                    offset: 4,
                    style: { textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  shared
                  cursor={{ stroke: "#ccc", strokeDasharray: "3 3" }}
                  content={(props: any) => {
                    if (!props.active) return null;
                    let sec: number | null = null;
                    if (typeof props.label === "number") sec = Math.round(props.label);
                    else if (props.payload?.[0]?.payload?.second != null) {
                      sec = props.payload[0].payload.second;
                    }
                    if (sec == null || sec < 1 || sec > duration) return null;
                    const d = chartData[sec - 1];
                    if (!d) return null;
                    return (
                      <div className="bg-white border border-neutral-200 rounded-lg shadow px-3 py-2 text-sm">
                        <div className="text-xs text-neutral-400 mb-1 tabular-nums">
                          {sec}s
                        </div>
                        <div>
                          <span className="text-neutral-500">NS: </span>
                          <span className="font-semibold tabular-nums">{d.ns ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Score: </span>
                          <span className="font-semibold tabular-nums">{d.score ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-red-600">Even pace: </span>
                          <span className="font-semibold tabular-nums">{d.even ?? "—"}</span>
                        </div>
                        {d.errors != null && (
                          <div>
                            <span className="text-red-700">Errors: </span>
                            <span className="font-semibold tabular-nums">{d.errors}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={28} />
                <Line
                  yAxisId="ns"
                  type="monotone"
                  dataKey="ns"
                  stroke="#111"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#111", strokeWidth: 0 }}
                  name="NS"
                  connectNulls={false}
                />
                <Line
                  yAxisId="ns"
                  type="linear"
                  dataKey="even"
                  stroke="#dc2626"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Even pace"
                />
                <Line
                  yAxisId="errors"
                  dataKey="errors"
                  stroke="transparent"
                  strokeWidth={0}
                  activeDot={false}
                  dot={ErrorDot}
                  connectNulls={false}
                  name="Errors"
                  legendType="cross"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-6 mb-6">
          <h2 className="section-title text-lg mb-3 flex items-center gap-2">
            Normalised speed by category
            <NSHelp />
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(grouped) as Op[]).map((op) => {
              const m = meanTime(grouped[op]);
              const acc = accuracy(grouped[op]);
              const bg = mainBg(grouped[op]);
              return (
                <div
                  key={op}
                  className={`rounded-2xl p-4 border transition-shadow ${
                    bg ? "border-black/10 shadow-sm" : "bg-white border-neutral-200 opacity-70"
                  }`}
                  style={bg ? { backgroundColor: bg } : undefined}
                >
                  <div className="eyebrow">{opLabel[op]}</div>
                  <div className="text-[2.5rem] font-bold tabular-nums text-neutral-900 mt-1 leading-none">
                    {ns(m) ?? "—"}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-sm">
                      <span className="text-neutral-500">Acc </span>
                      <span className="font-semibold tabular-nums text-neutral-800">
                        {formatPct(acc)}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {grouped[op].length} solved
                      {m ? ` · ${m.toFixed(2)}s` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        </div>

        {hasBreakdown && (
          <section className="card p-6 mb-6 space-y-6">
            <h2 className="section-title text-lg">Detailed breakdown</h2>

            {(["add", "sub", "mul", "div"] as const).map((op) =>
              br[op].length === 0 ? null : (
                <div key={op}>
                  <h3 className="font-medium mb-2">{opLabel[op]}</h3>
                  <BucketGrid buckets={br[op]} bg={subBg} />
                </div>
              ),
            )}
          </section>
        )}

        <section className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">All problems</h2>
            <div className="text-xs text-neutral-500">
              fastest {minT.toFixed(2)}s → slowest {maxT.toFixed(2)}s
            </div>
          </div>
          <div className="flex gap-1 mb-3 text-xs">
            {QUINTILE_COLORS.map((c, i) => {
              const lo = i === 0 ? minT : cuts[i - 1];
              const hi = i === 4 ? maxT : cuts[i];
              return (
                <div
                  key={i}
                  className="flex-1 rounded px-2 py-1 text-white text-center"
                  style={{ backgroundColor: c }}
                >
                  {lo.toFixed(2)}–{hi.toFixed(2)}s
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {problems.map((p, i) => (
              <ProblemChip key={i} p={p} cuts={cuts} />
            ))}
            {problems.length === 0 && (
              <div className="text-neutral-500 text-sm">No problems solved.</div>
            )}
          </div>
        </section>

        <div className="flex justify-center gap-3 mb-12">
          <button onClick={onHome} className="btn-ghost">
            <HomeIcon /> Home
          </button>
          <button onClick={onRestart} className="btn-primary">
            <RetryIcon /> Restart
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 border ${
            toast.kind === "ok"
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}

function ErrorDot(props: any) {
  const { cx, cy, value, index } = props;
  const key = `e-${index}`;
  if (value == null || value <= 0 || cx == null || cy == null) {
    return <g key={key} />;
  }
  const size = 5;
  return (
    <g key={key} stroke="#b91c1c" strokeWidth={2} strokeLinecap="round">
      <line x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} />
      <line x1={cx - size} y1={cy + size} x2={cx + size} y2={cy - size} />
    </g>
  );
}

function BucketGrid({
  buckets,
  bg,
}: {
  buckets: Bucket[];
  bg: (probs: SolvedProblem[]) => string | undefined;
}) {
  const cols = Math.min(6, Math.max(3, Math.ceil(buckets.length / 2)));
  const compact = buckets.length > 5;
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {buckets.map((b) => (
        <NSCard
          key={b.label}
          label={b.label}
          problems={b.problems}
          bg={bg(b.problems)}
          compact={compact}
        />
      ))}
    </div>
  );
}

function NSCard({
  label,
  problems,
  compact,
  bg,
}: {
  label: string;
  problems: SolvedProblem[];
  compact?: boolean;
  bg?: string;
}) {
  const m = meanTime(problems);
  const v = ns(m);
  const empty = problems.length === 0;
  return (
    <div
      className={`border border-neutral-200 rounded-lg p-2 ${empty ? "opacity-60" : ""}`}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      <div className="text-xs text-neutral-600">{label}</div>
      <div
        className={`${compact ? "text-xl" : "text-2xl"} font-bold tabular-nums ${
          empty ? "text-neutral-400" : ""
        }`}
      >
        {v ?? "—"}
      </div>
      <div className="text-[10px] text-neutral-500">
        n={problems.length}
        {m ? ` · ${m.toFixed(2)}s` : ""}
      </div>
    </div>
  );
}

function ProblemChip({ p, cuts }: { p: SolvedProblem; cuts: number[] }) {
  const [hover, setHover] = useState(false);
  const q = quintileOf(p.timeTaken, cuts);
  const nsThis = ns(p.timeTaken);
  return (
    <span
      className="relative px-2 py-1 rounded text-white text-sm font-mono tabular-nums cursor-help"
      style={{ backgroundColor: QUINTILE_COLORS[q] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {formatProblem(p)}
      {hover && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-neutral-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {p.timeTaken.toFixed(2)}s · ns = {nsThis ?? "—"}
        </span>
      )}
    </span>
  );
}

function NSHelp() {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 text-xs font-bold cursor-help"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      ?
      {hover && (
        <span className="absolute z-20 left-full ml-2 top-1/2 -translate-y-1/2 bg-neutral-900 text-white text-xs font-normal rounded px-3 py-2 w-72 shadow-lg">
          <b>Normalised Speed (ns):</b> based on your mean time per problem in this
          category, the number of problems you&apos;d solve in 120 seconds at that pace,
          floored.
        </span>
      )}
    </span>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h3l2-3h8l2 3h3v12H3z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
