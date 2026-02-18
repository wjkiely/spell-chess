// ============================================================
// Core domain types for Spell Chess
// ============================================================

export interface Piece {
  /** Single-char type: uppercase = white (K Q R B N P), lowercase = black (k q r b n p) */
  type: string;
  color: "white" | "black";
  /** Stable identity used to track pieces across moves (needed for spell targeting) */
  id: string;
  isFrozen: boolean;
  isJumpable: boolean;
  hasMoved: boolean;
}

export interface SpellState {
  jump: number;
  freeze: number;
  jumpLastUsedTurn: number;
  freezeLastUsedTurn: number;
}

export interface ActiveSpell {
  type: "jump" | "freeze";
  /** ID of the piece made jumpable (jump spells only) */
  targetId?: string;
  /** Center square of the freeze zone (freeze spells only) */
  targetSquare?: { r: number; c: number };
  /** All piece IDs caught in the freeze zone at cast time */
  affectedPieceIds?: string[];
  /** Spell expires when plyCount reaches this value */
  expiresAtPly: number;
}

export interface MoveLogEntry {
  turn: number;
  player: "white" | "black";
  /** Human-readable SAN-like notation (e.g. "Nf3", "jump@e4 e2-e4") */
  notation: string;
  /** Compact machine-readable actions, e.g. ["j@e4", "e2-e4"] or ["e2-e4"] or ["R"] */
  actions: string[];
  /** Index into GameState.history where this position lives */
  plySnapshotIndex: number;
}

export interface CastlingRights {
  white: { K: boolean; Q: boolean };
  black: { k: boolean; q: boolean };
}

export interface AwaitingPromotion {
  r: number;
  c: number;
  color: "white" | "black";
  originalMoveNotation: string;
  movingPiece: Piece;
  fromR: number;
  fromC: number;
}

// ============================================================
// Core game state – this is what gets stored in Supabase
// ============================================================

export interface GameState {
  board: (Piece | null)[][];
  currentPlayer: "white" | "black";
  gameTurnNumber: number;
  plyCount: number;
  spells: {
    white: SpellState;
    black: SpellState;
  };
  activeSpells: ActiveSpell[];
  moveLog: MoveLogEntry[];
  enPassantTarget: { r: number; c: number } | null;
  castlingRights: CastlingRights;
  isGameOver: boolean;
  gameEndMessage: string;
  awaitingPromotion: AwaitingPromotion | null;
  /** Full position snapshots for history navigation (can be rebuilt from moveLog) */
  history: GameSnapshot[];
  /** Tracks position frequency for threefold-repetition detection */
  repetitionCounter: Record<string, number>;
}

/** A single history entry – same as GameState minus the bulky history/repetition fields */
export type GameSnapshot = Omit<GameState, "history" | "repetitionCounter">;

// ============================================================
// UI-only state (never persisted to the database)
// ============================================================

export interface UIState {
  selectedPiece: { r: number; c: number; piece: Piece } | null;
  spellMode: "jump" | "freeze" | null;
  spellCaster: "white" | "black" | null;
  /** Saved so we can undo a pending spell cast */
  spellActivationState: { type: "jump" | "freeze"; originalLastUsedTurn: number } | null;
  /** Notation of the spell cast this turn (before the move is made) */
  pendingSpellNotation: string | null;
  currentHistoryViewIndex: number;
  isBoardFlipped: boolean;
  useStandardPieces: boolean;
  theme: "light" | "dark";
  boardScheme: "wood" | "green" | "blue" | "purple";
  showLastMoveHighlight: boolean;
  showCoordinates: boolean;
  showValidMoves: boolean;
  showChat: boolean;
  showRules: boolean;
}

// ============================================================
// Supabase database row – mirrors the `games` table
// ============================================================

export interface GameRow {
  id: string;
  created_at: string;
  updated_at: string;
  /**
   * Source of truth: all actions ever taken, comma-separated.
   * Format: "j@e4,e2-e4,e7-e5,R"
   */
  compact_action_log: string;
  board_state: (Piece | null)[][];
  current_player: "white" | "black";
  game_turn_number: number;
  ply_count: number;
  spells_state: { white: SpellState; black: SpellState };
  active_spells: ActiveSpell[];
  en_passant_target: { r: number; c: number } | null;
  castling_rights: CastlingRights;
  is_game_over: boolean;
  game_end_message: string;
  move_log: MoveLogEntry[];
  repetition_counter: Record<string, number>;
  status: "waiting" | "active" | "finished";
}

// ============================================================
// API payload types
// ============================================================

/** Body sent to PATCH /api/game/[id] when a player makes a move */
export interface MakeMovePayload {
  /**
   * The new actions for this half-turn.
   * Spell + move:  ["j@e4", "e2-e4"]
   * Move only:     ["e2-e4"]
   * Resign:        ["R"]
   */
  actions: string[];
}

export interface CreateGameResponse {
  gameId: string;
  shareUrl: string;
}

export interface GameStateResponse {
  gameId: string;
  state: GameState;
  compactActionLog: string;
  status: GameRow["status"];
}
