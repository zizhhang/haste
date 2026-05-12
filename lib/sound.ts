"use client";

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  ensureCtx();
}

function beep(freq: number, duration: number, type: OscillatorType = "sine", gainPeak = 0.18) {
  const ac = ensureCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ac.destination);
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playTick() {
  beep(660, 0.09, "sine", 0.15);
}

export function playStart() {
  // pleasant two-note chime
  beep(880, 0.14, "triangle", 0.22);
  setTimeout(() => beep(1320, 0.22, "triangle", 0.22), 90);
}
