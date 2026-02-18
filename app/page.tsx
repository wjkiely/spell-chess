"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "moderator" | "white" | "black";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStartGame(role: Role) {
    setLoading(role);
    setError(null);
    try {
      const res = await fetch("/api/game", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create game");
      const { gameId } = await res.json();
      const path = role === "moderator" ? `/game/${gameId}` : `/game/${gameId}/${role}`;
      router.push(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8 text-center">

      {/* Title */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-6xl font-bold tracking-tight">
          {"♟\uFE0E"} Spell Chess
        </h1>
        <p className="text-lg max-w-md" style={{ opacity: 0.65 }}>
          Chess with jump and freeze spells.
        </p>
      </div>

      {/* Start buttons */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          <button
            onClick={() => handleStartGame("moderator")}
            disabled={isLoading}
            className="w-36 rounded-lg bg-gray-600 px-6 py-3 text-base font-semibold text-white
                       hover:bg-gray-700 disabled:opacity-60 transition-colors shadow-md"
          >
            {loading === "moderator" ? "Creating…" : "Play Both Sides"}
          </button>
          <button
            onClick={() => handleStartGame("white")}
            disabled={isLoading}
            className="w-36 rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white
                       hover:bg-green-700 disabled:opacity-60 transition-colors shadow-md"
          >
            {loading === "white" ? "Creating…" : "Play as White"}
          </button>
          <button
            onClick={() => handleStartGame("black")}
            disabled={isLoading}
            className="w-36 rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white
                       hover:bg-blue-800 disabled:opacity-60 transition-colors shadow-md"
          >
            {loading === "black" ? "Creating…" : "Play as Black"}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <p className="text-sm" style={{ opacity: 0.45 }}>
          No account needed — share a link and play instantly.
        </p>
      </div>

      {/* Rules */}
      <div className="spell-panel rounded-lg border border-gray-200 p-6 max-w-xl w-full text-left">
        <h2 className="font-bold text-lg mb-4 text-center">Spell Chess Rules</h2>
        <ul className="flex flex-col gap-3 text-sm leading-relaxed" style={{ opacity: 0.85 }}>
          <li>Standard chess rules apply. Checkmate or capture your opponent's king to win.</li>
          <li>A player may cast a spell before making their move.</li>
          <li>Each player starts with <strong>two Jump spells</strong> and <strong>five Freeze spells</strong>.</li>
          <li>
            <strong>⚡ Jump Spell:</strong> Target any piece. For your current turn and your
            opponent's next turn, that piece is jumpable by other pieces as if it is not there.
          </li>
          <li>
            <strong>❄️ Freeze Spell:</strong> Target any square. All pieces in a 3×3 area around
            the target square are frozen and cannot move on your turn or your opponent's next turn.
            Frozen pieces cannot put a king in check or checkmate. Frozen kings still attack.
          </li>
          <li>Spells have a <strong>3-turn cooldown</strong> before they can be used again.</li>
        </ul>
      </div>

    </main>
  );
}
