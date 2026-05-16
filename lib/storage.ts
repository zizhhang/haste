"use client";

import {
  DEFAULT_SETTINGS,
  DEFAULT_UI,
  GameSettings,
  SessionStats,
  SolvedProblem,
  UiSettings,
} from "./types";

const SETTINGS_KEY = "haste:gameSettings";
const UI_KEY = "haste:uiSettings";
const RESULT_KEY = "haste:lastResult";

export interface StoredResult {
  problems: SolvedProblem[];
  settings: GameSettings;
  session: SessionStats;
  finishedAt: number; // epoch ms
}

export function saveResult(r: StoredResult) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(r));
  } catch {
    // ignore quota / disabled storage
  }
}

export function loadResult(): StoredResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredResult;
  } catch {
    return null;
  }
}

export function loadGameSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, ops: { ...DEFAULT_SETTINGS.ops, ...(parsed.ops || {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveGameSettings(s: GameSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadUiSettings(): UiSettings {
  if (typeof window === "undefined") return DEFAULT_UI;
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return DEFAULT_UI;
    return { ...DEFAULT_UI, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_UI;
  }
}

export function saveUiSettings(s: UiSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(UI_KEY, JSON.stringify(s));
}
