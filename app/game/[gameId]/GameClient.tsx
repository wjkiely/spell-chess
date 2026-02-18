"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSpellChess } from "@/hooks/useSpellChess";
import ChessBoard from "@/components/ChessBoard";
import SpellControls from "@/components/SpellControls";
import MoveLog from "@/components/MoveLog";
import ArrowCanvas from "@/components/ArrowCanvas";
import StatusArea from "@/components/StatusArea";
import SettingsPanel from "@/components/SettingsPanel";
import ChatBox from "@/components/ChatBox";
import type { GameRow } from "@/lib/types";

interface Props {
  gameId: string;
  initialRow: GameRow;
  playerColor: "white" | "black" | "moderator";
}

export default function GameClient({ gameId, initialRow, playerColor }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("showGameBanner") === "false") setShowBanner(false);
  }, []);

  function hideBanner() {
    setShowBanner(false);
    localStorage.setItem("showGameBanner", "false");
  }

  function toggleBanner() {
    setShowBanner((prev) => {
      const next = !prev;
      localStorage.setItem("showGameBanner", String(next));
      return next;
    });
  }

  const {
    gameState,
    uiState,
    status,
    validMoves,
    onSquareClick,
    onDragMove,
    onCastSpell,
    onCancelSpell,
    onResign,
    onFlipBoard,
    onHistoryBack,
    onHistoryForward,
    onHistoryJump,
    onPromote,
    shareLink,
    copyShareLink,
    statusMessage,
    onToggleTheme,
    onSetBoardScheme,
    onTogglePieceStyle,
    onToggleLastMoveHighlight,
    onToggleCoordinates,
    onToggleValidMoves,
    onToggleChat,
    onToggleRules,
  } = useSpellChess(gameId, initialRow, playerColor);

  return (
    <main className="flex min-h-screen flex-col items-center py-6 px-4">
      {/* Banner — only rendered when visible; no placeholder when hidden */}
      {showBanner && (
        <div className="share-banner mb-4 w-full max-w-4xl rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 flex items-center gap-2">
          <div className="flex-1 text-center text-sm">
            {playerColor === "moderator" ? (
              <>
                <strong>Moderator view</strong>
                {" — "}
                Player links:{" "}
                <a href={`/game/${gameId}/white`}
                   target="_blank" rel="noopener noreferrer"
                   className="share-link font-mono text-blue-700 underline hover:text-blue-500"
                >White</a>
                {" · "}
                <a href={`/game/${gameId}/black`}
                   target="_blank" rel="noopener noreferrer"
                   className="share-link font-mono text-blue-700 underline hover:text-blue-500"
                >Black</a>
              </>
            ) : (
              <>
                You are playing as <strong>{playerColor === "white" ? "White" : "Black"}</strong>.{" "}
                Play as{" "}
                <a
                  href={`/game/${gameId}/${playerColor === "white" ? "black" : "white"}`}
                  className="share-link font-mono text-blue-700 underline hover:text-blue-500"
                >
                  {playerColor === "white" ? "Black" : "White"}
                </a>{" "}
                instead, or{" "}
                <a href={`/game/${gameId}`} className="share-link font-mono text-blue-700 underline hover:text-blue-500">
                  moderate
                </a>{" "}
                the game.
              </>
            )}
          </div>
          <button
            onClick={hideBanner}
            className="text-gray-400 hover:text-gray-700 text-base leading-none flex-shrink-0"
            aria-label="Dismiss banner"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-5 w-full max-w-4xl items-start">
        {/* Board area */}
        <div className="relative flex flex-col gap-2" style={{ width: 480 }}>
          <div className="relative" ref={boardRef}>
            {(() => {
              const isViewingHistory =
                uiState.currentHistoryViewIndex < gameState.history.length - 1;
              const snap = gameState.history[uiState.currentHistoryViewIndex];
              const displayBoard = isViewingHistory ? (snap?.board ?? gameState.board) : gameState.board;
              const displayActiveSpells = isViewingHistory ? (snap?.activeSpells ?? gameState.activeSpells) : gameState.activeSpells;
              const displayPlyCount = isViewingHistory ? (snap?.plyCount ?? gameState.plyCount) : gameState.plyCount;
              return (
                <ChessBoard
                  board={displayBoard}
                  currentPlayer={gameState.currentPlayer}
                  activeSpells={displayActiveSpells}
                  plyCount={displayPlyCount}
                  selectedPiece={uiState.selectedPiece}
                  validMoves={validMoves}
                  historySnapshot={snap}
                  showLastMoveHighlight={uiState.showLastMoveHighlight}
                  awaitingPromotion={gameState.awaitingPromotion}
                  isFlipped={uiState.isBoardFlipped}
                  useStandardPieces={uiState.useStandardPieces}
                  showCoordinates={uiState.showCoordinates}
                  showValidMoves={uiState.showValidMoves}
                  draggingEnabled={!uiState.spellMode && !gameState.awaitingPromotion}
                  onSquareClick={onSquareClick}
                  onDragMove={onDragMove}
                  onPromote={onPromote}
                />
              );
            })()}
            <ArrowCanvas boardRef={boardRef} isFlipped={uiState.isBoardFlipped} />
          </div>

          <StatusArea message={statusMessage} />

          {/* History navigation */}
          <div className="flex justify-center gap-2">
            <button
              onClick={onHistoryBack}
              className="nav-btn w-10 h-10 rounded-full bg-gray-100 border border-gray-300 text-lg
                         hover:bg-gray-200 transition-colors"
              title="Previous move"
            >
              ‹
            </button>
            <button
              onClick={onHistoryForward}
              className="nav-btn w-10 h-10 rounded-full bg-gray-100 border border-gray-300 text-lg
                         hover:bg-gray-200 transition-colors"
              title="Next move"
            >
              ›
            </button>
            <button
              onClick={onFlipBoard}
              className="nav-btn w-10 h-10 rounded-full bg-gray-100 border border-gray-300 text-lg
                         hover:bg-gray-200 transition-colors"
              title="Flip board"
            >
              ⇅
            </button>
          </div>
        </div>

        {/* Sidebar: spell controls + move log */}
        <div
          className={`flex flex-col gap-3 w-60 ${uiState.isBoardFlipped ? "flex-col-reverse" : ""}`}
        >
          <SpellControls
            player="black"
            spells={gameState.spells.black}
            currentPlayer={gameState.currentPlayer}
            gameTurnNumber={gameState.gameTurnNumber}
            spellMode={uiState.spellMode}
            spellCaster={uiState.spellCaster}
            pendingSpellNotation={uiState.pendingSpellNotation}
            isGameOver={gameState.isGameOver}
            awaitingPromotion={!!gameState.awaitingPromotion}
            onCastSpell={onCastSpell}
            onCancelSpell={onCancelSpell}
            onResign={onResign}
          />

          <MoveLog
            moveLog={gameState.moveLog}
            currentHistoryViewIndex={uiState.currentHistoryViewIndex}
            onClickEntry={onHistoryJump}
          />

          <SpellControls
            player="white"
            spells={gameState.spells.white}
            currentPlayer={gameState.currentPlayer}
            gameTurnNumber={gameState.gameTurnNumber}
            spellMode={uiState.spellMode}
            spellCaster={uiState.spellCaster}
            pendingSpellNotation={uiState.pendingSpellNotation}
            isGameOver={gameState.isGameOver}
            awaitingPromotion={!!gameState.awaitingPromotion}
            onCastSpell={onCastSpell}
            onCancelSpell={onCancelSpell}
            onResign={onResign}
          />
        </div>

        {/* Home + Settings column — aligned with top of board */}
        <div className="flex flex-col items-center gap-1">
          <Link
            href="/"
            title="Home"
            className={`text-xl px-2 py-1 rounded transition-colors
              ${uiState.theme === "dark"
                ? "text-gray-300 hover:text-white"
                : "text-gray-500 hover:text-gray-900"}`}
          >
            ⌂
          </Link>
          <SettingsPanel
          theme={uiState.theme}
          boardScheme={uiState.boardScheme}
          useStandardPieces={uiState.useStandardPieces}
          showLastMoveHighlight={uiState.showLastMoveHighlight}
          showBanner={showBanner}
          showCoordinates={uiState.showCoordinates}
          showValidMoves={uiState.showValidMoves}
          showChat={uiState.showChat}
          showRules={uiState.showRules}
          createdAt={initialRow.created_at}
          onToggleTheme={onToggleTheme}
          onSetBoardScheme={onSetBoardScheme}
          onTogglePieceStyle={onTogglePieceStyle}
          onToggleLastMoveHighlight={onToggleLastMoveHighlight}
          onToggleCoordinates={onToggleCoordinates}
          onToggleValidMoves={onToggleValidMoves}
          onToggleChat={onToggleChat}
          onToggleRules={onToggleRules}
          onToggleBanner={toggleBanner}
        />
        </div>
      </div>

      {/* Chat + Rules row */}
      {(uiState.showChat || uiState.showRules) && (
        <div className="mt-5 w-full max-w-4xl flex gap-5 items-start">
          {uiState.showChat && (
            <div className="flex-1 min-w-0">
              <ChatBox
                gameId={gameId}
                playerColor={playerColor}
                theme={uiState.theme}
              />
            </div>
          )}
          {uiState.showRules && (
            <div className="flex-1 min-w-0">
              <div className="spell-panel rounded-lg border border-gray-200 p-6 text-left relative">
                <button
                  onClick={onToggleRules}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-base leading-none"
                  aria-label="Hide rules"
                  title="Hide rules"
                >
                  ✕
                </button>
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
            </div>
          )}
        </div>
      )}
    </main>
  );
}
