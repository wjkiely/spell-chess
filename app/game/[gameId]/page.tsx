import { createServiceClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import GameClient from "./GameClient";
import type { GameRow } from "@/lib/types";

interface Props {
  params: Promise<{ gameId: string }>;
}

export default async function GamePage({ params }: Props) {
  const { gameId } = await params;

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
      playerColor="moderator"
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { gameId } = await params;
  return {
    title: `Spell Chess – Moderator – Game ${gameId.slice(0, 8)}`,
  };
}
