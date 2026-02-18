import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createInitialGameState, buildCompactActionLog } from "@/lib/gameEngine";
import type { GameState } from "@/lib/types";

/**
 * POST /api/game
 * Creates a new game with the initial board position.
 * Returns { gameId, shareUrl }.
 */
export async function POST() {
  const supabase = createServiceClient();
  const initialState: GameState = createInitialGameState();

  const { data, error } = await supabase
    .from("games")
    .insert({
      compact_action_log: "",
      board_state: initialState.board,
      current_player: initialState.currentPlayer,
      game_turn_number: initialState.gameTurnNumber,
      ply_count: initialState.plyCount,
      spells_state: initialState.spells,
      active_spells: initialState.activeSpells,
      en_passant_target: initialState.enPassantTarget,
      castling_rights: initialState.castlingRights,
      is_game_over: false,
      game_end_message: "",
      move_log: [],
      repetition_counter: initialState.repetitionCounter,
      status: "waiting",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create game:", error);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }

  const gameId: string = data.id;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const shareUrl = `${baseUrl}/game/${gameId}`;

  return NextResponse.json({ gameId, shareUrl }, { status: 201 });
}
