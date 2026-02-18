import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  replayCompactActions,
  buildCompactActionLog,
} from "@/lib/gameEngine";
import type { GameRow, MakeMovePayload } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/game/[id]
 * Returns the full current game state.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const row = data as GameRow;
  return NextResponse.json({ gameId: id, row });
}

/**
 * PATCH /api/game/[id]
 * Body: { actions: string[] }  e.g. ["j@e4", "e2-e4"] or ["R"]
 *
 * Appends the new action(s) to the game's compact_action_log,
 * replays the full log to get the new state, then saves it.
 *
 * Returns the updated state.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = createServiceClient();

  // 1. Parse request body
  let body: MakeMovePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
    return NextResponse.json({ error: "actions array is required" }, { status: 400 });
  }

  // 2. Load current game
  const { data: row, error: fetchErr } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameRow = row as GameRow;

  if (gameRow.is_game_over) {
    return NextResponse.json({ error: "Game is already over" }, { status: 409 });
  }

  // 3. Build the new compact action log
  const existingActions = gameRow.compact_action_log
    ? gameRow.compact_action_log.split(",").filter(Boolean)
    : [];
  const allActions = [...existingActions, ...body.actions];
  const newLog = allActions.join(",");

  // 4. Replay the full log to produce the authoritative new state
  let newState;
  try {
    newState = replayCompactActions(allActions);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid action: ${err instanceof Error ? err.message : err}` },
      { status: 422 }
    );
  }

  // 5. Determine new status
  let newStatus: GameRow["status"] = gameRow.status;
  if (newState.isGameOver) {
    newStatus = "finished";
  } else if (gameRow.status === "waiting" && newState.plyCount > 0) {
    newStatus = "active";
  }

  // 6. Persist the updated state
  const { error: updateErr } = await supabase
    .from("games")
    .update({
      compact_action_log: newLog,
      board_state: newState.board,
      current_player: newState.currentPlayer,
      game_turn_number: newState.gameTurnNumber,
      ply_count: newState.plyCount,
      spells_state: newState.spells,
      active_spells: newState.activeSpells,
      en_passant_target: newState.enPassantTarget,
      castling_rights: newState.castlingRights,
      is_game_over: newState.isGameOver,
      game_end_message: newState.gameEndMessage,
      move_log: newState.moveLog,
      repetition_counter: newState.repetitionCounter,
      status: newStatus,
    })
    .eq("id", id);

  if (updateErr) {
    console.error("Failed to update game:", updateErr);
    return NextResponse.json({ error: "Failed to save move" }, { status: 500 });
  }

  return NextResponse.json({
    gameId: id,
    state: newState,
    compactActionLog: newLog,
    status: newStatus,
  });
}
