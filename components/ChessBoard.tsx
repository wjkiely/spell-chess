"use client";

import { PIECE_SYMBOLS, isSquareUnderActiveFreeze } from "@/lib/gameEngine";
import type { Piece, ActiveSpell, GameSnapshot, AwaitingPromotion } from "@/lib/types";

const PROMOTION_PIECES = ["Q", "R", "B", "N"];

interface Props {
  board: (Piece | null)[][];
  currentPlayer: "white" | "black";
  activeSpells: ActiveSpell[];
  plyCount: number;
  selectedPiece: { r: number; c: number; piece: Piece } | null;
  validMoves: { fromR: number; fromC: number; toR: number; toC: number }[];
  historySnapshot: GameSnapshot | undefined;
  showLastMoveHighlight: boolean;
  awaitingPromotion: AwaitingPromotion | null;
  isFlipped: boolean;
  useStandardPieces: boolean;
  showCoordinates: boolean;
  showValidMoves: boolean;
  draggingEnabled: boolean;
  onSquareClick: (r: number, c: number) => void;
  onDragMove: (fromR: number, fromC: number, toR: number, toC: number) => void;
  onPromote: (piece: string) => void;
}

export default function ChessBoard({
  board,
  currentPlayer,
  activeSpells,
  plyCount,
  selectedPiece,
  validMoves,
  historySnapshot,
  showLastMoveHighlight,
  awaitingPromotion,
  isFlipped,
  useStandardPieces,
  showCoordinates,
  showValidMoves,
  draggingEnabled,
  onSquareClick,
  onDragMove,
  onPromote,
}: Props) {
  // The last two squares from history highlight
  const historyHighlightSquares = (() => {
    if (!historySnapshot) return new Set<string>();
    const log = historySnapshot.moveLog;
    if (!log || log.length === 0) return new Set<string>();
    const last = log[log.length - 1];
    const squares = new Set<string>();
    for (const action of last.actions) {
      if (!action.includes("@") && action !== "R") {
        const [fromAlg, toAndPromo] = action.split("-");
        if (fromAlg && toAndPromo) {
          const toAlg = toAndPromo.substring(0, 2);
          squares.add(fromAlg);
          squares.add(toAlg);
        }
      }
    }
    return squares;
  })();

  function algebraicFromCoords(r: number, c: number) {
    return `${String.fromCharCode(97 + c)}${8 - r}`;
  }

  const rows = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  // Left-edge and bottom-edge column/row values in display order
  const leftEdgeCol = cols[0];
  const bottomEdgeRow = rows[7];

  return (
    <div className="relative" style={{ width: 480, height: 480 }}>
      {/* Chess grid */}
      <div
        className="grid border-2 border-gray-800"
        style={{
          width: 480,
          height: 480,
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
        }}
      >
        {rows.map((r) =>
          cols.map((c) => {
            const piece = board[r]?.[c] ?? null;
            const isLight = (r + c) % 2 === 0;
            const isSelected =
              selectedPiece?.r === r && selectedPiece?.c === c;
            const isValid = validMoves.some((m) => m.toR === r && m.toC === c);
            const alg = algebraicFromCoords(r, c);
            const isHistory = historyHighlightSquares.has(alg);
            const underFreeze = isSquareUnderActiveFreeze(
              r, c, activeSpells, plyCount
            );
            const isJumpable = piece?.isJumpable ?? false;

            // Build square class
            let squareBg = isSelected
              ? "sq-selected"
              : isLight
              ? "sq-light"
              : "sq-dark";

            let extraClasses = "";
            if (showLastMoveHighlight && isHistory && !isSelected) extraClasses += " sq-history-highlight";
            if (underFreeze) extraClasses += " sq-freeze-zone";
            if (isJumpable) extraClasses += " sq-jumpable";

            // Freeze border indicators
            const freezeBorders = getFreezeIndicatorClasses(r, c, activeSpells, plyCount);

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => onSquareClick(r, c)}
                draggable={!!piece && draggingEnabled}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", `${r},${c}`);
                  if (!piece) return;
                  const symbol = useStandardPieces
                    ? (PIECE_SYMBOLS[piece.type] ?? piece.type)
                    : (PIECE_SYMBOLS[piece.type.toLowerCase()] ?? piece.type);
                  const ghost = document.createElement("span");
                  ghost.textContent = symbol;
                  Object.assign(ghost.style, {
                    position: "fixed",
                    top: "-200px",
                    left: "-200px",
                    fontSize: "2.25rem",
                    lineHeight: "1",
                    pointerEvents: "none",
                    color: (!useStandardPieces && piece.color === "white") ? "white" : "#1a1a1a",
                    textShadow: (!useStandardPieces && piece.color === "white")
                      ? "-0.3px -0.3px 0 #555,-0.3px 0.3px 0 #555,0.3px -0.3px 0 #555,0.3px 0.3px 0 #555"
                      : "none",
                  });
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
                  setTimeout(() => document.body.removeChild(ghost), 0);
                }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const data = e.dataTransfer.getData("text/plain");
                  if (!data) return;
                  const [fromR, fromC] = data.split(",").map(Number);
                  onDragMove(fromR, fromC, r, c);
                }}
                className={`relative flex items-center justify-center cursor-pointer select-none
                            text-4xl ${squareBg}${extraClasses} ${freezeBorders}`}
                style={{ width: "100%", height: "100%" }}
              >
                {showValidMoves && isValid && (
                  <div className="absolute inset-0 bg-[rgba(201,169,89,0.5)] border-[2px] border-[#a68a3a] z-[1] pointer-events-none" />
                )}

                {piece && (
                  <span
                    className={`relative z-[2] leading-none chess-piece
                      ${!useStandardPieces && piece.color === "white"
                        ? "white-piece colored-pieces"
                        : ""
                      }`}
                  >
                    {useStandardPieces
                      ? (PIECE_SYMBOLS[piece.type] ?? piece.type)
                      : (PIECE_SYMBOLS[piece.type.toLowerCase()] ?? piece.type)
                    }
                  </span>
                )}

                {piece?.isJumpable && (
                  <span className="absolute top-[1px] right-[1px] text-[15px] opacity-90 z-[1] pointer-events-none">
                    ✨
                  </span>
                )}

                {showCoordinates && c === leftEdgeCol && (
                  <span className="absolute top-[2px] left-[3px] text-[13px] font-semibold leading-none z-[3] pointer-events-none coord-label">
                    {8 - r}
                  </span>
                )}
                {showCoordinates && r === bottomEdgeRow && (
                  <span className="absolute bottom-[4px] left-[3px] text-[13px] font-semibold leading-none z-[3] pointer-events-none coord-label">
                    {String.fromCharCode(97 + c)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Promotion UI */}
      {awaitingPromotion && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="bg-white rounded-xl p-4 shadow-2xl flex flex-col items-center gap-3">
            <p className="font-semibold text-gray-800">Choose promotion piece</p>
            <div className="flex gap-2">
              {PROMOTION_PIECES.map((p) => {
                const pieceType =
                  awaitingPromotion.color === "white" ? p : p.toLowerCase();
                return (
                  <button
                    key={p}
                    onClick={() => onPromote(p)}
                    className="w-14 h-14 text-4xl rounded-lg border-2 border-gray-300
                               hover:bg-amber-100 hover:border-amber-500 transition-colors"
                    title={p}
                  >
                    {PIECE_SYMBOLS[pieceType]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Returns Tailwind classes for freeze-zone border indicators on a square */
function getFreezeIndicatorClasses(
  sqR: number,
  sqC: number,
  activeSpells: ActiveSpell[],
  currentPly: number
): string {
  const classes: string[] = [];
  for (const spell of activeSpells) {
    if (spell.type !== "freeze" || currentPly >= spell.expiresAtPly) continue;
    const { r: cr, c: cc } = spell.targetSquare!;
    const inZone =
      sqR >= Math.max(0, cr - 1) &&
      sqR <= Math.min(7, cr + 1) &&
      sqC >= Math.max(0, cc - 1) &&
      sqC <= Math.min(7, cc + 1);
    if (!inZone) continue;
    if (sqR === Math.max(0, cr - 1)) classes.push("sq-freeze-top");
    if (sqR === Math.min(7, cr + 1)) classes.push("sq-freeze-bottom");
    if (sqC === Math.max(0, cc - 1)) classes.push("sq-freeze-left");
    if (sqC === Math.min(7, cc + 1)) classes.push("sq-freeze-right");
  }
  return classes.join(" ");
}
