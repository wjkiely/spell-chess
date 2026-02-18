/**
 * gameEngine.ts
 *
 * Pure TypeScript game engine extracted from index.html.
 * No DOM dependencies – all functions take state and return new state.
 *
 * Compact action format (matches the existing URL share format):
 *   Spell  – "j@e4"  (jump) or "f@e4" (freeze)
 *   Move   – "e2-e4" or "e7-e8=Q" (with promotion piece)
 *   Resign – "R"
 *
 * Spell cooldown: a spell can be re-cast only when
 *   lastUsedTurn === 0  OR  currentTurn >= lastUsedTurn + 3
 */

import type {
  Piece,
  GameState,
  GameSnapshot,
  SpellState,
  ActiveSpell,
  MoveLogEntry,
  CastlingRights,
  AwaitingPromotion,
} from "./types";

// ============================================================
// Constants
// ============================================================

export const INITIAL_BOARD_SETUP: (string | null)[][] = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

// \uFE0E forces text (non-emoji) rendering on all platforms
export const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔\uFE0E", Q: "♕\uFE0E", R: "♖\uFE0E", B: "♗\uFE0E", N: "♘\uFE0E", P: "♙\uFE0E",
  k: "♚\uFE0E", q: "♛\uFE0E", r: "♜\uFE0E", b: "♝\uFE0E", n: "♞\uFE0E", p: "♟\uFE0E",
};

export const SPELL_COOLDOWN_TURNS = 3;

let _pieceIdSeq = 0;
function newPieceId(r: number, c: number): string {
  return `p-${r}-${c}-${++_pieceIdSeq}`;
}

// ============================================================
// Initialization
// ============================================================

export function createInitialGameState(): GameState {
  const board: (Piece | null)[][] = INITIAL_BOARD_SETUP.map((row, r) =>
    row.map((t, c) => {
      if (!t) return null;
      return {
        type: t,
        color: t === t.toUpperCase() ? "white" : "black",
        id: newPieceId(r, c),
        isFrozen: false,
        isJumpable: false,
        hasMoved: false,
      } as Piece;
    })
  );

  const state: GameState = {
    board,
    currentPlayer: "white",
    gameTurnNumber: 1,
    plyCount: 0,
    spells: {
      white: { jump: 2, freeze: 5, jumpLastUsedTurn: 0, freezeLastUsedTurn: 0 },
      black: { jump: 2, freeze: 5, jumpLastUsedTurn: 0, freezeLastUsedTurn: 0 },
    },
    activeSpells: [],
    moveLog: [],
    enPassantTarget: null,
    castlingRights: {
      white: { K: true, Q: true },
      black: { k: true, q: true },
    },
    isGameOver: false,
    gameEndMessage: "",
    awaitingPromotion: null,
    history: [],
    repetitionCounter: {},
  };

  const snap = createSnapshot(state);
  state.history.push(snap);
  const sig = generateStateSignature(snap);
  state.repetitionCounter[sig] = 1;

  return state;
}

// ============================================================
// Deep copy helpers
// ============================================================

export function deepCopyState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s));
}

export function createSnapshot(s: GameState): GameSnapshot {
  return JSON.parse(
    JSON.stringify({
      board: s.board,
      currentPlayer: s.currentPlayer,
      gameTurnNumber: s.gameTurnNumber,
      plyCount: s.plyCount,
      spells: s.spells,
      activeSpells: s.activeSpells,
      moveLog: s.moveLog,
      enPassantTarget: s.enPassantTarget,
      castlingRights: s.castlingRights,
      isGameOver: s.isGameOver,
      gameEndMessage: s.gameEndMessage,
      awaitingPromotion: s.awaitingPromotion,
    })
  );
}

// ============================================================
// Coordinate helpers
// ============================================================

export function algebraicFromCoords(r: number, c: number): string {
  return `${String.fromCharCode(97 + c)}${8 - r}`;
}

export function parseAlgebraicToCoords(
  alg: string
): { r: number; c: number } | null {
  if (!alg || alg.length !== 2) return null;
  const file = alg.charCodeAt(0) - 97; // 'a' = 0
  const rank = 8 - parseInt(alg[1], 10);
  if (file < 0 || file > 7 || isNaN(rank) || rank < 0 || rank > 7) return null;
  return { r: rank, c: file };
}

// ============================================================
// Spell helpers
// ============================================================

export function isSpellOnCooldown(
  spellState: SpellState,
  spellType: "jump" | "freeze",
  currentTurn: number
): boolean {
  const lastUsed =
    spellType === "jump"
      ? spellState.jumpLastUsedTurn
      : spellState.freezeLastUsedTurn;
  if (lastUsed === 0) return false;
  return currentTurn < lastUsed + SPELL_COOLDOWN_TURNS;
}

export function canCastSpell(
  state: GameState,
  spellType: "jump" | "freeze"
): boolean {
  const ps = state.spells[state.currentPlayer];
  const count = spellType === "jump" ? ps.jump : ps.freeze;
  if (count <= 0) return false;
  return !isSpellOnCooldown(ps, spellType, state.gameTurnNumber);
}

export function isSquareUnderActiveFreeze(
  sqR: number,
  sqC: number,
  activeSpells: ActiveSpell[],
  currentPly: number
): boolean {
  for (const spell of activeSpells) {
    if (spell.type === "freeze" && currentPly < spell.expiresAtPly) {
      const cr = spell.targetSquare!.r;
      const cc = spell.targetSquare!.c;
      if (
        sqR >= Math.max(0, cr - 1) &&
        sqR <= Math.min(7, cr + 1) &&
        sqC >= Math.max(0, cc - 1) &&
        sqC <= Math.min(7, cc + 1)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function findPieceById(
  board: (Piece | null)[][],
  id: string
): Piece | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.id === id) return board[r][c];
    }
  }
  return null;
}

export function updateActiveSpells(state: GameState): GameState {
  const ns = deepCopyState(state);
  const still: ActiveSpell[] = [];
  for (const spell of ns.activeSpells) {
    if (ns.plyCount >= spell.expiresAtPly) {
      if (spell.type === "jump" && spell.targetId) {
        const p = findPieceById(ns.board, spell.targetId);
        if (p) p.isJumpable = false;
      }
    } else {
      still.push(spell);
    }
  }
  ns.activeSpells = still;
  return ns;
}

// ============================================================
// Move validation
// ============================================================

export function isPathClear(
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  board: (Piece | null)[][]
): boolean {
  const dr = Math.sign(toR - fromR);
  const dc = Math.sign(toC - fromC);
  let r = fromR + dr;
  let c = fromC + dc;
  while (r !== toR || c !== toC) {
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return false;
    const p = board[r][c];
    if (p && !p.isJumpable) return false;
    r += dr;
    c += dc;
  }
  return true;
}

export function isSquareAttacked(
  targetR: number,
  targetC: number,
  attackerColor: "white" | "black",
  board: (Piece | null)[][],
  enPassantTarget: { r: number; c: number } | null,
  activeSpells: ActiveSpell[],
  currentPly: number
): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor) continue;

      const frozen =
        piece.isFrozen ||
        isSquareUnderActiveFreeze(r, c, activeSpells, currentPly);
      // Frozen pieces can't attack (except the king which can't be frozen)
      if (frozen && piece.type.toLowerCase() !== "k") continue;

      const t = piece.type.toLowerCase();
      if (t === "p") {
        const dir = attackerColor === "white" ? -1 : 1;
        if (r + dir === targetR && Math.abs(c - targetC) === 1) return true;
      } else if (t === "n") {
        const dr = Math.abs(targetR - r);
        const dc = Math.abs(targetC - c);
        if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) return true;
      } else if (t === "k") {
        if (Math.abs(targetR - r) <= 1 && Math.abs(targetC - c) <= 1)
          return true;
      } else {
        if (
          (t === "r" || t === "q") &&
          (r === targetR || c === targetC) &&
          isPathClear(r, c, targetR, targetC, board)
        )
          return true;
        if (
          (t === "b" || t === "q") &&
          Math.abs(targetR - r) === Math.abs(targetC - c) &&
          isPathClear(r, c, targetR, targetC, board)
        )
          return true;
      }
    }
  }
  return false;
}

export function isKingInCheck(
  kingColor: "white" | "black",
  board: (Piece | null)[][],
  enPassantTarget: { r: number; c: number } | null,
  activeSpells: ActiveSpell[],
  currentPly: number
): boolean {
  const kingType = kingColor === "white" ? "K" : "k";
  const attackerColor = kingColor === "white" ? "black" : "white";
  let kingPos: { r: number; c: number } | null = null;
  for (let r = 0; r < 8 && !kingPos; r++) {
    for (let c = 0; c < 8 && !kingPos; c++) {
      if (board[r][c]?.type === kingType) kingPos = { r, c };
    }
  }
  if (!kingPos) return false;
  return isSquareAttacked(
    kingPos.r,
    kingPos.c,
    attackerColor,
    board,
    enPassantTarget,
    activeSpells,
    currentPly
  );
}

function getAttackers(
  targetR: number,
  targetC: number,
  attackerColor: "white" | "black",
  board: (Piece | null)[][],
  enPassantTarget: { r: number; c: number } | null,
  activeSpells: ActiveSpell[],
  currentPly: number
): { piece: Piece; r: number; c: number }[] {
  const attackers: { piece: Piece; r: number; c: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor) continue;
      const frozen =
        piece.isFrozen ||
        isSquareUnderActiveFreeze(r, c, activeSpells, currentPly);
      if (frozen && piece.type.toLowerCase() !== "k") continue;

      const t = piece.type.toLowerCase();
      let attacking = false;
      if (t === "p") {
        const dir = attackerColor === "white" ? -1 : 1;
        if (r + dir === targetR && Math.abs(c - targetC) === 1)
          attacking = true;
      } else if (t === "n") {
        const dr = Math.abs(targetR - r);
        const dc = Math.abs(targetC - c);
        if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) attacking = true;
      } else if (t === "k") {
        if (Math.abs(targetR - r) <= 1 && Math.abs(targetC - c) <= 1)
          attacking = true;
      } else {
        if (
          (t === "r" || t === "q") &&
          (r === targetR || c === targetC) &&
          isPathClear(r, c, targetR, targetC, board)
        )
          attacking = true;
        if (
          !attacking &&
          (t === "b" || t === "q") &&
          Math.abs(targetR - r) === Math.abs(targetC - c) &&
          isPathClear(r, c, targetR, targetC, board)
        )
          attacking = true;
      }
      if (attacking) attackers.push({ piece, r, c });
    }
  }
  return attackers;
}

export function checkCastleConditions(
  kingFromR: number,
  kingFromC: number,
  kingToR: number,
  kingToC: number,
  board: (Piece | null)[][],
  player: "white" | "black",
  castlingRights: CastlingRights,
  activeSpells: ActiveSpell[],
  currentPly: number,
  enPassantTarget: { r: number; c: number } | null
): boolean {
  const king = board[kingFromR][kingFromC];
  if (!king || king.hasMoved) return false;
  if (isKingInCheck(player, board, enPassantTarget, activeSpells, currentPly))
    return false;

  const opp = player === "white" ? "black" : "white";
  const kingside = kingToC > kingFromC;

  if (kingside) {
    if (player === "white" && !castlingRights.white.K) return false;
    if (player === "black" && !castlingRights.black.k) return false;
    const rook = board[kingFromR][7];
    if (!rook || rook.type.toLowerCase() !== "r" || rook.hasMoved) return false;
    if (board[kingFromR][kingFromC + 1] || board[kingFromR][kingFromC + 2])
      return false;
    if (
      isSquareAttacked(
        kingFromR, kingFromC + 1, opp, board, enPassantTarget, activeSpells, currentPly
      ) ||
      isSquareAttacked(
        kingFromR, kingFromC + 2, opp, board, enPassantTarget, activeSpells, currentPly
      )
    )
      return false;
  } else {
    if (player === "white" && !castlingRights.white.Q) return false;
    if (player === "black" && !castlingRights.black.q) return false;
    const rook = board[kingFromR][0];
    if (!rook || rook.type.toLowerCase() !== "r" || rook.hasMoved) return false;
    if (
      board[kingFromR][kingFromC - 1] ||
      board[kingFromR][kingFromC - 2] ||
      board[kingFromR][kingFromC - 3]
    )
      return false;
    if (
      isSquareAttacked(
        kingFromR, kingFromC - 1, opp, board, enPassantTarget, activeSpells, currentPly
      ) ||
      isSquareAttacked(
        kingFromR, kingFromC - 2, opp, board, enPassantTarget, activeSpells, currentPly
      )
    )
      return false;
  }
  return true;
}

export function isValidMove(
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  board: (Piece | null)[][],
  currentPlayer: "white" | "black",
  enPassantTarget: { r: number; c: number } | null,
  castlingRights: CastlingRights,
  activeSpells: ActiveSpell[],
  currentPly: number
): boolean {
  const moving = board[fromR][fromC];
  if (!moving || moving.color !== currentPlayer) return false;

  const frozen =
    moving.isFrozen ||
    isSquareUnderActiveFreeze(fromR, fromC, activeSpells, currentPly);
  if (frozen) return false;

  if (fromR === toR && fromC === toC) return false;

  const target = board[toR][toC];
  if (target && target.color === moving.color) return false;

  const t = moving.type.toLowerCase();

  // Castling
  if (t === "k" && Math.abs(toC - fromC) === 2 && fromR === toR) {
    return checkCastleConditions(
      fromR, fromC, toR, toC, board, currentPlayer,
      castlingRights, activeSpells, currentPly, enPassantTarget
    );
  }

  let valid = false;
  switch (t) {
    case "p": {
      const dir = moving.color === "white" ? -1 : 1;
      if (toR === fromR + dir && toC === fromC && !target) {
        valid = true;
      } else if (
        toR === fromR + 2 * dir &&
        toC === fromC &&
        !moving.hasMoved &&
        !target
      ) {
        const mid = board[fromR + dir][fromC];
        if (!mid || mid.isJumpable) valid = true;
      } else if (
        toR === fromR + dir &&
        Math.abs(toC - fromC) === 1 &&
        target &&
        target.color !== moving.color
      ) {
        valid = true;
      } else if (
        toR === fromR + dir &&
        Math.abs(toC - fromC) === 1 &&
        !target &&
        enPassantTarget &&
        toR === enPassantTarget.r &&
        toC === enPassantTarget.c
      ) {
        const epPawn = board[fromR]?.[toC];
        if (
          epPawn &&
          epPawn.type.toLowerCase() === "p" &&
          epPawn.color !== moving.color
        )
          valid = true;
      }
      break;
    }
    case "n": {
      const dr = Math.abs(toR - fromR);
      const dc = Math.abs(toC - fromC);
      if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) valid = true;
      break;
    }
    case "b":
      if (
        Math.abs(toR - fromR) === Math.abs(toC - fromC) &&
        isPathClear(fromR, fromC, toR, toC, board)
      )
        valid = true;
      break;
    case "r":
      if (
        (fromR === toR || fromC === toC) &&
        isPathClear(fromR, fromC, toR, toC, board)
      )
        valid = true;
      break;
    case "q":
      if (
        ((fromR === toR || fromC === toC) ||
          Math.abs(toR - fromR) === Math.abs(toC - fromC)) &&
        isPathClear(fromR, fromC, toR, toC, board)
      )
        valid = true;
      break;
    case "k": {
      const dr = Math.abs(toR - fromR);
      const dc = Math.abs(toC - fromC);
      if (dr <= 1 && dc <= 1) valid = true;
      break;
    }
  }

  if (!valid) return false;

  // Allow capturing the opponent's king (used during attack-square detection)
  if (target?.type.toLowerCase() === "k") return true;

  // Simulate move and verify king is not in check
  const tmp = board.map((row) => row.map((p) => (p ? { ...p } : null)));
  tmp[toR][toC] = tmp[fromR][fromC];
  tmp[fromR][fromC] = null;
  if (
    t === "p" &&
    enPassantTarget &&
    toR === enPassantTarget.r &&
    toC === enPassantTarget.c &&
    !target
  ) {
    tmp[fromR][toC] = null; // Remove en-passant captured pawn
  }

  const kingType = currentPlayer === "white" ? "K" : "k";
  let kingPos: { r: number; c: number } | null = null;
  outer: for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (tmp[r][c]?.type === kingType) {
        kingPos = { r, c };
        break outer;
      }
    }
  }
  if (!kingPos) return true;

  const opp = currentPlayer === "white" ? "black" : "white";
  return !isSquareAttacked(
    kingPos.r, kingPos.c, opp, tmp, null, activeSpells, currentPly
  );
}

export function getValidMovesForPiece(
  r: number,
  c: number,
  state: GameState
): { fromR: number; fromC: number; toR: number; toC: number }[] {
  const moves: { fromR: number; fromC: number; toR: number; toC: number }[] =
    [];
  for (let toR = 0; toR < 8; toR++) {
    for (let toC = 0; toC < 8; toC++) {
      if (
        isValidMove(
          r, c, toR, toC,
          state.board, state.currentPlayer,
          state.enPassantTarget, state.castlingRights,
          state.activeSpells, state.plyCount
        )
      ) {
        moves.push({ fromR: r, fromC: c, toR, toC });
      }
    }
  }
  return moves;
}

/**
 * Returns true if the player has any legal move (or a spell escape) available.
 * Matches the original hasLegalMoves logic including spell-based checkmate escapes.
 */
export function hasLegalMoves(
  playerColor: "white" | "black",
  state: GameState
): boolean {
  const { board, enPassantTarget, castlingRights, activeSpells, plyCount, spells, gameTurnNumber } = state;
  const ps = spells[playerColor];

  // 1. Standard legal moves
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== playerColor) continue;
      if (piece.isFrozen || isSquareUnderActiveFreeze(r, c, activeSpells, plyCount))
        continue;
      for (let toR = 0; toR < 8; toR++) {
        for (let toC = 0; toC < 8; toC++) {
          if (
            isValidMove(r, c, toR, toC, board, playerColor, enPassantTarget, castlingRights, activeSpells, plyCount)
          )
            return true;
        }
      }
    }
  }

  // Not in check → stalemate (spells don't create moves from nothing)
  if (!isKingInCheck(playerColor, board, enPassantTarget, activeSpells, plyCount))
    return false;

  // --- Spell escape logic ---
  const canFreeze =
    ps.freeze > 0 &&
    (ps.freezeLastUsedTurn === 0 ||
      gameTurnNumber >= ps.freezeLastUsedTurn + SPELL_COOLDOWN_TURNS);
  const canJump =
    ps.jump > 0 &&
    (ps.jumpLastUsedTurn === 0 ||
      gameTurnNumber >= ps.jumpLastUsedTurn + SPELL_COOLDOWN_TURNS);

  if (!canFreeze && !canJump) return false;

  // Freeze is assumed to always offer an escape (blanket rule from original game)
  if (canFreeze) return true;

  // Jump: check if making any piece jumpable allows capturing the single attacker
  if (canJump) {
    const opp = playerColor === "white" ? "black" : "white";
    const kingType = playerColor === "white" ? "K" : "k";
    let kingPos: { r: number; c: number } | null = null;
    outer: for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c]?.type === kingType) {
          kingPos = { r, c };
          break outer;
        }
      }
    }
    if (!kingPos) return true;

    const attackers = getAttackers(
      kingPos.r, kingPos.c, opp, board, enPassantTarget, activeSpells, plyCount
    );
    if (attackers.length > 1) return false; // Double check, jump can't help
    if (attackers.length === 1) {
      const attacker = attackers[0];
      for (let jr = 0; jr < 8; jr++) {
        for (let jc = 0; jc < 8; jc++) {
          if (!board[jr][jc]) continue;
          const tmp = board.map((row) => row.map((p) => (p ? { ...p } : null)));
          tmp[jr][jc]!.isJumpable = true;
          for (let mr = 0; mr < 8; mr++) {
            for (let mc = 0; mc < 8; mc++) {
              const mp = tmp[mr][mc];
              if (mp && mp.color === playerColor) {
                if (
                  isValidMove(
                    mr, mc, attacker.r, attacker.c,
                    tmp, playerColor, enPassantTarget, castlingRights, activeSpells, plyCount
                  )
                )
                  return true;
              }
            }
          }
        }
      }
    }
  }

  return false;
}

// ============================================================
// Threefold-repetition state signature
// ============================================================

export function generateStateSignature(
  s: Omit<GameState, "history" | "repetitionCounter">
): string {
  const boardStr = s.board
    .map((row) =>
      row
        .map((p) => {
          if (!p) return " ";
          return p.type + (p.isJumpable ? "*" : "");
        })
        .join("")
    )
    .join("/");

  const { white: ws, black: bs } = s.spells;
  const cooldowns = `${ws.jumpLastUsedTurn},${ws.freezeLastUsedTurn},${bs.jumpLastUsedTurn},${bs.freezeLastUsedTurn}`;

  return `${boardStr}|${s.currentPlayer}|${JSON.stringify(s.castlingRights)}|${JSON.stringify(s.enPassantTarget)}|${cooldowns}`;
}

// ============================================================
// Move notation
// ============================================================

export function generateMoveNotation(
  state: GameState,
  piece: Piece,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  capturedPiece: Piece | null,
  isEnPassant = false
): string {
  const pieceTypeUpper = piece.type.toUpperCase();
  const toAlg = algebraicFromCoords(toR, toC);

  if (pieceTypeUpper === "P") {
    if (capturedPiece || isEnPassant) {
      return `${String.fromCharCode(97 + fromC)}x${toAlg}`;
    }
    return toAlg;
  }

  let notation = pieceTypeUpper;

  // Find competing pieces of the same type that can reach the same square
  const competitors: { r: number; c: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === fromR && c === fromC) continue;
      const p = state.board[r][c];
      if (p && p.color === piece.color && p.type === piece.type) {
        if (
          isValidMove(
            r, c, toR, toC,
            state.board, state.currentPlayer,
            state.enPassantTarget, state.castlingRights,
            state.activeSpells, state.plyCount
          )
        ) {
          competitors.push({ r, c });
        }
      }
    }
  }

  if (competitors.length > 0) {
    const fromFile = String.fromCharCode(97 + fromC);
    const fromRank = (8 - fromR).toString();
    const sameFile = competitors.some((p) => p.c === fromC);
    const sameRank = competitors.some((p) => p.r === fromR);
    if (sameFile && sameRank) {
      notation += fromFile + fromRank;
    } else if (sameFile) {
      notation += fromRank;
    } else {
      notation += fromFile;
    }
  }

  if (capturedPiece) notation += "x";
  notation += toAlg;
  return notation;
}

// ============================================================
// Apply spell (returns new state but does NOT advance turn)
// ============================================================

export type SpellResult =
  | { success: true; state: GameState; notation: string }
  | { success: false; error: string };

export function applySpell(
  state: GameState,
  spellType: "jump" | "freeze",
  targetR: number,
  targetC: number
): SpellResult {
  if (!canCastSpell(state, spellType)) {
    return { success: false, error: `Cannot cast ${spellType} spell right now.` };
  }

  const ns = deepCopyState(state);
  const ps = ns.spells[ns.currentPlayer];
  const targetPiece = ns.board[targetR][targetC];

  if (spellType === "jump") {
    if (!targetPiece) {
      return { success: false, error: "Jump must target a piece." };
    }
    ps.jump--;
    ps.jumpLastUsedTurn = ns.gameTurnNumber;
    ns.activeSpells.push({
      type: "jump",
      targetId: targetPiece.id,
      expiresAtPly: ns.plyCount + 2,
    });
    targetPiece.isJumpable = true;
    const notation = `jump@${algebraicFromCoords(targetR, targetC)}`;
    return { success: true, state: ns, notation };
  } else {
    ps.freeze--;
    ps.freezeLastUsedTurn = ns.gameTurnNumber;
    const affectedPieceIds: string[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = targetR + dr;
        const nc = targetC + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && ns.board[nr][nc]) {
          affectedPieceIds.push(ns.board[nr][nc]!.id);
        }
      }
    }
    ns.activeSpells.push({
      type: "freeze",
      targetSquare: { r: targetR, c: targetC },
      affectedPieceIds,
      expiresAtPly: ns.plyCount + 2,
    });
    const notation = `freeze@${algebraicFromCoords(targetR, targetC)}`;
    return { success: true, state: ns, notation };
  }
}

// ============================================================
// Apply move (returns new state and advances turn)
// ============================================================

export type MoveResult =
  | { success: true; state: GameState; awaitingPromotion: false }
  | {
      success: true;
      state: GameState;
      awaitingPromotion: true;
      promotionContext: AwaitingPromotion;
    }
  | { success: false; error: string };

export function applyMove(
  state: GameState,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  /** Notation of the spell cast this turn (e.g. "jump@e4"), or null */
  spellNotation: string | null,
  /** Promotion piece type (e.g. "Q"), required when pawn reaches last rank */
  promotionPiece?: string
): MoveResult {
  if (
    !isValidMove(
      fromR, fromC, toR, toC,
      state.board, state.currentPlayer,
      state.enPassantTarget, state.castlingRights,
      state.activeSpells, state.plyCount
    )
  ) {
    return { success: false, error: "Invalid move." };
  }

  // Generate notation from pre-move state
  const movingPiece = state.board[fromR][fromC]!;
  const capturedPiece = state.board[toR][toC];
  let moveNotation = generateMoveNotation(
    state, movingPiece, fromR, fromC, toR, toC, capturedPiece
  );

  const ns = deepCopyState(state);
  const moved = ns.board[fromR][fromC]!;
  let isCastle = false;

  // Castling: also move the rook
  if (moved.type.toLowerCase() === "k" && Math.abs(fromC - toC) === 2) {
    isCastle = true;
    moveNotation = toC > fromC ? "O-O" : "O-O-O";
    const rookFromC = toC > fromC ? 7 : 0;
    const rookToC = toC > fromC ? toC - 1 : toC + 1;
    const rook = ns.board[fromR][rookFromC];
    if (rook) {
      ns.board[fromR][rookToC] = rook;
      ns.board[fromR][rookFromC] = null;
      rook.hasMoved = true;
    }
  }

  // En passant: remove the captured pawn
  let isEnPassant = false;
  if (
    moved.type.toLowerCase() === "p" &&
    Math.abs(fromC - toC) === 1 &&
    !ns.board[toR][toC] &&
    ns.enPassantTarget &&
    toR === ns.enPassantTarget.r &&
    toC === ns.enPassantTarget.c
  ) {
    isEnPassant = true;
    ns.board[fromR][toC] = null;
    moveNotation = generateMoveNotation(
      state, movingPiece, fromR, fromC, toR, toC,
      state.board[fromR][toC], true
    );
  }

  // Apply the move
  ns.board[toR][toC] = moved;
  ns.board[fromR][fromC] = null;
  moved.hasMoved = true;

  // Update castling rights
  if (moved.type.toLowerCase() === "k") {
    if (moved.color === "white") {
      ns.castlingRights.white.K = false;
      ns.castlingRights.white.Q = false;
    } else {
      ns.castlingRights.black.k = false;
      ns.castlingRights.black.q = false;
    }
  } else if (moved.type.toLowerCase() === "r") {
    if (moved.color === "white") {
      if (fromR === 7 && fromC === 0) ns.castlingRights.white.Q = false;
      if (fromR === 7 && fromC === 7) ns.castlingRights.white.K = false;
    } else {
      if (fromR === 0 && fromC === 0) ns.castlingRights.black.q = false;
      if (fromR === 0 && fromC === 7) ns.castlingRights.black.k = false;
    }
  }

  // Pawn promotion
  if (
    !isCastle &&
    moved.type.toLowerCase() === "p" &&
    (toR === 0 || toR === 7)
  ) {
    if (promotionPiece) {
      ns.board[toR][toC]!.type =
        moved.color === "white"
          ? promotionPiece.toUpperCase()
          : promotionPiece.toLowerCase();
      moveNotation += `=${promotionPiece.toUpperCase()}`;
    } else {
      // Client needs to show promotion UI before finalizing
      ns.awaitingPromotion = {
        r: toR,
        c: toC,
        color: moved.color,
        originalMoveNotation: moveNotation,
        movingPiece: moved,
        fromR,
        fromC,
      };
      return {
        success: true,
        state: ns,
        awaitingPromotion: true,
        promotionContext: ns.awaitingPromotion,
      };
    }
  }

  return _finalizeMove(ns, moveNotation, moved, fromR, toR, fromC, toC, spellNotation);
}

/** Complete a previously pending promotion and finalize the turn. */
export function applyPromotion(
  state: GameState,
  promotionPiece: string,
  spellNotation: string | null
): MoveResult {
  if (!state.awaitingPromotion) {
    return { success: false, error: "No promotion pending." };
  }
  const ns = deepCopyState(state);
  const promo = ns.awaitingPromotion!;
  const pieceType =
    promo.color === "white"
      ? promotionPiece.toUpperCase()
      : promotionPiece.toLowerCase();
  ns.board[promo.r][promo.c]!.type = pieceType;
  const moveNotation = promo.originalMoveNotation + `=${promotionPiece.toUpperCase()}`;
  ns.awaitingPromotion = null;
  return _finalizeMove(
    ns, moveNotation, ns.board[promo.r][promo.c]!,
    promo.fromR, promo.r, promo.fromC, promo.c, spellNotation
  );
}

function _finalizeMove(
  ns: GameState,
  moveNotation: string,
  movedPiece: Piece,
  fromR: number,
  toR: number,
  fromC: number,
  toC: number,
  spellNotation: string | null
): { success: true; state: GameState; awaitingPromotion: false } {
  const playerWhoMoved = ns.currentPlayer;

  // Build compact action list for this ply
  const compactActions: string[] = [];
  if (spellNotation) {
    const [spellType, target] = spellNotation.split("@");
    compactActions.push(`${spellType.charAt(0)}@${target}`);
  }
  let compactMove = `${algebraicFromCoords(fromR, fromC)}-${algebraicFromCoords(toR, toC)}`;
  if (moveNotation.includes("=")) {
    compactMove += `=${moveNotation.split("=")[1][0]}`;
  }
  compactActions.push(compactMove);

  ns.plyCount++;
  const afterSpellUpdate = updateActiveSpells(ns);
  Object.assign(ns, afterSpellUpdate);

  // Game-end detection
  const opp = playerWhoMoved === "white" ? "black" : "white";
  const oppKingType = opp === "white" ? "K" : "k";
  const oppKingOnBoard = ns.board.some((row) => row.some((p) => p?.type === oppKingType));
  const oppInCheck = oppKingOnBoard && isKingInCheck(opp, ns.board, ns.enPassantTarget, ns.activeSpells, ns.plyCount);
  const oppHasMoves = oppKingOnBoard && hasLegalMoves(opp, ns);
  let gameEndMessage = "";
  let checkSymbol = "";

  if (!oppKingOnBoard) {
    ns.isGameOver = true;
    gameEndMessage = `${playerWhoMoved.charAt(0).toUpperCase() + playerWhoMoved.slice(1)} wins by king capture!`;
    checkSymbol = "#";
  } else if (oppInCheck && !oppHasMoves) {
    ns.isGameOver = true;
    gameEndMessage = `${playerWhoMoved.charAt(0).toUpperCase() + playerWhoMoved.slice(1)} wins by checkmate!`;
    checkSymbol = "#";
  } else if (!oppInCheck && !oppHasMoves) {
    ns.isGameOver = true;
    gameEndMessage = "Draw by stalemate.";
  } else if (oppInCheck) {
    checkSymbol = "+";
  }

  ns.gameEndMessage = gameEndMessage;

  // Update en passant square
  ns.enPassantTarget = null;
  if (
    movedPiece.type.toLowerCase() === "p" &&
    Math.abs(fromR - toR) === 2
  ) {
    ns.enPassantTarget = { r: (fromR + toR) / 2, c: fromC };
  }

  // Log the move
  ns.moveLog.push({
    turn: ns.gameTurnNumber,
    player: playerWhoMoved,
    notation: (spellNotation ? spellNotation + " " : "") + moveNotation + checkSymbol,
    actions: compactActions,
    plySnapshotIndex: ns.history.length,
  });

  // Advance turn counters
  if (!ns.isGameOver) {
    if (playerWhoMoved === "black") ns.gameTurnNumber++;
    ns.currentPlayer = opp;
  }

  // Push snapshot
  const snap = createSnapshot(ns);
  snap.gameEndMessage = gameEndMessage;
  ns.history.push(snap);

  // Threefold repetition
  if (!ns.isGameOver) {
    const sig = generateStateSignature(snap);
    ns.repetitionCounter[sig] = (ns.repetitionCounter[sig] || 0) + 1;
    if (ns.repetitionCounter[sig] >= 3) {
      ns.isGameOver = true;
      ns.gameEndMessage = "Draw by threefold repetition.";
    }
  }

  return { success: true, state: ns, awaitingPromotion: false };
}

// ============================================================
// Resign
// ============================================================

export function applyResign(state: GameState): GameState {
  const ns = deepCopyState(state);
  ns.isGameOver = true;
  const player = ns.currentPlayer;
  const winner = player === "white" ? "Black" : "White";
  const resigner = player.charAt(0).toUpperCase() + player.slice(1);
  ns.gameEndMessage = `${resigner} resigned. ${winner} wins.`;
  ns.moveLog.push({
    turn: ns.gameTurnNumber,
    player,
    notation: "R",
    actions: ["R"],
    plySnapshotIndex: ns.history.length,
  });
  const snap = createSnapshot(ns);
  snap.gameEndMessage = ns.gameEndMessage;
  ns.history.push(snap);
  return ns;
}

// ============================================================
// Replay compact action log (used to hydrate state from DB)
// ============================================================

/**
 * Replays a flat array of compact actions from the initial position.
 * This is how the server rebuilds game state from the stored action log.
 */
export function replayCompactActions(actions: string[]): GameState {
  let state = createInitialGameState();
  let pendingSpellNotation: string | null = null;

  for (const action of actions) {
    if (state.isGameOver) break;

    if (action.toUpperCase() === "R") {
      state = applyResign(state);
    } else if (action.includes("@")) {
      const [prefix, targetAlg] = action.split("@");
      const spellType: "jump" | "freeze" =
        prefix === "j" || prefix === "jump" ? "jump" : "freeze";
      const coords = parseAlgebraicToCoords(targetAlg);
      if (!coords) throw new Error(`Invalid spell action: ${action}`);
      const result = applySpell(state, spellType, coords.r, coords.c);
      if (!result.success) throw new Error(`Spell failed: ${result.error}`);
      state = result.state;
      pendingSpellNotation = result.notation;
    } else {
      // Move: "e2-e4" or "e7-e8=Q"
      const [fromAlg, toAndPromo] = action.split("-");
      const toAlg = toAndPromo.substring(0, 2);
      const from = parseAlgebraicToCoords(fromAlg);
      const to = parseAlgebraicToCoords(toAlg);
      if (!from || !to) throw new Error(`Invalid move action: ${action}`);
      const promotionPiece = toAndPromo.includes("=")
        ? toAndPromo.split("=")[1]
        : undefined;
      const result = applyMove(
        state, from.r, from.c, to.r, to.c,
        pendingSpellNotation, promotionPiece
      );
      if (!result.success) throw new Error(`Move failed: ${result.error}`);
      if (result.awaitingPromotion)
        throw new Error(`Promotion piece missing in action: ${action}`);
      state = result.state;
      pendingSpellNotation = null;
    }
  }

  return state;
}

/**
 * Extracts the flat compact action log from a GameState's moveLog.
 * This is the string stored in the `compact_action_log` DB column.
 */
export function buildCompactActionLog(moveLog: MoveLogEntry[]): string {
  return moveLog.flatMap((entry) => entry.actions).join(",");
}
