"use client";

import { useEffect, useState } from "react";
import Home from "@/components/Home";
import Game from "@/components/Game";
import Results from "@/components/Results";
import { DEFAULT_SETTINGS, DEFAULT_UI, GameSettings, SessionStats, SolvedProblem, UiSettings } from "@/lib/types";
import { loadGameSettings, loadUiSettings, saveGameSettings, saveUiSettings } from "@/lib/storage";

type View = "home" | "game" | "results";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [ui, setUi] = useState<UiSettings>(DEFAULT_UI);
  const [solved, setSolved] = useState<SolvedProblem[]>([]);
  const [session, setSession] = useState<SessionStats>({ totalAttempts: 0, correctAttempts: 0 });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadGameSettings());
    setUi(loadUiSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveGameSettings(settings);
  }, [settings, hydrated]);
  useEffect(() => {
    if (hydrated) saveUiSettings(ui);
  }, [ui, hydrated]);

  if (!hydrated) return null;

  if (view === "home")
    return (
      <Home
        settings={settings}
        setSettings={setSettings}
        ui={ui}
        setUi={setUi}
        onStart={() => setView("game")}
      />
    );

  if (view === "game")
    return (
      <Game
        settings={settings}
        ui={ui}
        onFinish={(s, sess) => {
          setSolved(s);
          setSession(sess);
          setView("results");
        }}
        onExitHome={() => setView("home")}
      />
    );

  return (
    <Results
      problems={solved}
      settings={settings}
      session={session}
      onHome={() => setView("home")}
      onRestart={() => setView("game")}
    />
  );
}
