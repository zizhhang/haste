"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Results from "@/components/Results";
import { loadResult, StoredResult } from "@/lib/storage";

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<StoredResult | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const r = loadResult();
    setResult(r);
    setHydrated(true);
    if (!r) router.replace("/");
  }, [router]);

  if (!hydrated || !result) return null;

  return (
    <Results
      problems={result.problems}
      settings={result.settings}
      session={result.session}
      finishedAt={result.finishedAt}
      onHome={() => router.push("/")}
      onRestart={() => router.push("/play")}
    />
  );
}
