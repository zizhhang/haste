"use client";

import { DEFAULT_SETTINGS, DEFAULT_UI, GameSettings, UiSettings } from "./types";

const SETTINGS_KEY = "zetamac+:gameSettings";
const UI_KEY = "zetamac+:uiSettings";

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
