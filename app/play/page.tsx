"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Game from "@/components/Game";
import { DEFAULT_SETTINGS, DEFAULT_UI, GameSettings, UiSettings } from "@/lib/types";
import { loadGameSettings, loadUiSettings, saveResult } from "@/lib/storage";

export default function PlayPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [ui, setUi] = useState<UiSettings>(DEFAULT_UI);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadGameSettings());
    setUi(loadUiSettings());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  return (
    <Game
      settings={settings}
      ui={ui}
      onFinish={(problems, session) => {
        saveResult({
          problems,
          settings,
          session,
          finishedAt: Date.now(),
        });
        // replace so browser-back from /results lands on Home, not a
        // mid-game /play that would auto-restart.
        router.replace("/results");
      }}
      onExitHome={() => router.push("/")}
    />
  );
}
