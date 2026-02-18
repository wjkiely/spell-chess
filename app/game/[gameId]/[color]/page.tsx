import { createServiceClient } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import GameClient from "../GameClient";
import type { GameRow } from "@/lib/types";

interface Props {
  params: Promise<{ gameId: string; color: string }>;
}

export default async function GameColorPage({ params }: Props) {
  const { gameId, color } = await params;

  if (color !== "white" && color !== "black") {
    redirect(`/game/${gameId}`);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error || !data) notFound();

  return (
    <GameClient
      gameId={gameId}
      initialRow={data as GameRow}
      playerColor={color as "white" | "black"}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { gameId, color } = await params;
  const label = color === "black" ? "Black" : "White";
  return {
    title: `Spell Chess – ${label} – Game ${gameId.slice(0, 8)}`,
  };
}
