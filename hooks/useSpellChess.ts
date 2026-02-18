"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  replayCompactActions,
  getValidMovesForPiece,
  applySpell,
  applyMove,
  applyPromotion,
  applyResign,
  canCastSpell,
  isSpellOnCooldown,
  SPELL_COOLDOWN_TURNS,
} from "@/lib/gameEngine";
import type {
  GameState,
  UIState,
  GameRow,
  Piece,
  MakeMovePayload,
} from "@/lib/types";

function rowToGameState(row: GameRow): GameState {
  // Rebuild full GameState from the DB row by replaying the action log.
  // This guarantees the history[] and repetitionCounter are always consistent.
  const actions = row.compact_action_log
    ? row.compact_action_log.split(",").filter(Boolean)
    : [];
  if (actions.length === 0) {
    // Fresh game – return initial state (already in row but let engine build it)
    return replayCompactActions([]);
  }
  return replayCompactActions(actions);
}

const DEFAULT_UI: UIState = {
  selectedPiece: null,
  spellMode: null,
  spellCaster: null,
  spellActivationState: null,
  pendingSpellNotation: null,
  currentHistoryViewIndex: 0,
  isBoardFlipped: false,
  useStandardPieces: false,
  theme: "dark",
  boardScheme: "green",
  showLastMoveHighlight: true,
  showCoordinates: true,
  showValidMoves: true,
  showChat: true,
  showRules: true,
};

export function useSpellChess(gameId: string, initialRow: GameRow, playerColor: "white" | "black" | "moderator") {
  const [gameState, setGameState] = useState<GameState>(() =>
    rowToGameState(initialRow)
  );
  const [ui, setUi] = useState<UIState>(() => ({
    ...DEFAULT_UI,
    currentHistoryViewIndex: rowToGameState(initialRow).history.length - 1,
    isBoardFlipped: playerColor === "black",
  }));

  useEffect(() => {
    const savedTheme = localStorage.getItem("spellChessTheme");
    const savedScheme = localStorage.getItem("spellChessBoardScheme");
    const theme: "light" | "dark" = savedTheme === "light" ? "light" : "dark";
    const defaultScheme = theme === "light" ? "wood" : "green";
    const boardScheme = (["wood", "green", "blue", "purple"].includes(savedScheme ?? "")
      ? savedScheme
      : defaultScheme) as "wood" | "green" | "blue" | "purple";
    setUi((prev) => ({
      ...prev,
      isBoardFlipped: localStorage.getItem(`boardFlipped_${gameId}`) !== null
        ? localStorage.getItem(`boardFlipped_${gameId}`) === "true"
        : playerColor === "black",
      useStandardPieces: localStorage.getItem("useStandardPieces") === "true",
      showLastMoveHighlight: localStorage.getItem("showLastMoveHighlight") !== "false",
      showCoordinates: localStorage.getItem("showCoordinates") !== "false",
      showValidMoves: localStorage.getItem("showValidMoves") !== "false",
      showChat: localStorage.getItem("showChat") !== "false",
      showRules: localStorage.getItem("showRules") !== "false",
      theme,
      boardScheme,
    }));
  }, []);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [compactLog, setCompactLog] = useState(initialRow.compact_action_log);

  // ── Derived ──────────────────────────────────────────────────────────────

  /** Valid moves for the currently selected piece */
  const validMoves = useMemo(() => {
    if (!ui.selectedPiece) return [];
    const isLatest = ui.currentHistoryViewIndex === gameState.history.length - 1;
    if (!isLatest) return [];
    return getValidMovesForPiece(
      ui.selectedPiece.r,
      ui.selectedPiece.c,
      gameState
    );
  }, [ui.selectedPiece, ui.currentHistoryViewIndex, gameState]);

  const opponentColor = playerColor === "white" ? "black" : playerColor === "black" ? "white" : null;
  const [shareLink, setShareLink] = useState(
    opponentColor ? `/game/${gameId}/${opponentColor}` : ""
  );
  useEffect(() => {
    if (opponentColor) {
      setShareLink(`${window.location.origin}/game/${gameId}/${opponentColor}`);
    }
  }, [gameId, opponentColor]);

  // ── Supabase Realtime subscription ──────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedRow = payload.new as GameRow;
          // Only update if the log actually changed (avoid echo from own move)
          if (updatedRow.compact_action_log === compactLog) return;
          setCompactLog(updatedRow.compact_action_log);
          const newState = rowToGameState(updatedRow);
          setGameState(newState);
          setUi((prev) => ({
            ...prev,
            selectedPiece: null,
            spellMode: null,
            spellCaster: null,
            spellActivationState: null,
            pendingSpellNotation: null,
            currentHistoryViewIndex: newState.history.length - 1,
          }));
          if (newState.isGameOver) {
            showStatus(newState.gameEndMessage);
          } else {
            showStatus(
              `${newState.currentPlayer === "white" ? "White" : "Black"}'s turn`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, compactLog]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function showStatus(msg: string, tempMs?: number) {
    setStatusMessage(msg);
    if (tempMs) {
      setTimeout(() => setStatusMessage(""), tempMs);
    }
  }

  async function sendActions(actions: string[]) {
    const body: MakeMovePayload = { actions };
    const res = await fetch(`/api/game/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      showStatus(`Error: ${error}`, 3000);
      return null;
    }
    const data = await res.json();
    setCompactLog(data.compactActionLog);
    return data.state as GameState;
  }

  // ── Board interaction ────────────────────────────────────────────────────

  const onSquareClick = useCallback(
    async (r: number, c: number) => {
      const isLatest =
        ui.currentHistoryViewIndex === gameState.history.length - 1;

      if (!isLatest && !gameState.isGameOver) {
        showStatus("Viewing history. Navigate to the latest move to play.", 2500);
        return;
      }
      if (gameState.isGameOver) {
        showStatus("Game is over.", 2000);
        return;
      }
      if (playerColor !== "moderator" && gameState.currentPlayer !== playerColor) {
        showStatus("It's not your turn.", 2000);
        return;
      }
      if (gameState.awaitingPromotion) {
        showStatus("Choose a promotion piece first.", 2000);
        return;
      }

      // Spell targeting mode
      if (ui.spellMode) {
        const result = applySpell(
          gameState,
          ui.spellMode,
          r,
          c
        );
        if (!result.success) {
          showStatus(result.error, 2500);
          return;
        }
        setGameState(result.state);
        setUi((prev) => ({
          ...prev,
          spellMode: null,
          pendingSpellNotation: result.notation,
          spellActivationState: {
            type: prev.spellMode!,
            originalLastUsedTurn:
              prev.spellMode === "jump"
                ? gameState.spells[gameState.currentPlayer].jumpLastUsedTurn
                : gameState.spells[gameState.currentPlayer].freezeLastUsedTurn,
          },
        }));
        showStatus(
          `${ui.spellMode === "jump" ? "Jump" : "Freeze"} spell cast. Now make your move.`
        );
        return;
      }

      const clickedPiece = gameState.board[r][c];

      if (ui.selectedPiece) {
        const { r: fromR, c: fromC } = ui.selectedPiece;

        // Deselect if same square
        if (fromR === r && fromC === c) {
          setUi((prev) => ({ ...prev, selectedPiece: null }));
          return;
        }

        // Try to move
        const isValid = validMoves.some((m) => m.toR === r && m.toC === c);
        if (isValid) {
          const result = applyMove(
            gameState,
            fromR, fromC, r, c,
            ui.pendingSpellNotation
          );

          if (!result.success) {
            showStatus(result.error, 2500);
            setUi((prev) => ({ ...prev, selectedPiece: null }));
            return;
          }

          if (result.awaitingPromotion) {
            // Update local state; GameClient will show the promotion UI
            setGameState(result.state);
            setUi((prev) => ({ ...prev, selectedPiece: null }));
            return;
          }

          // Optimistic update
          setGameState(result.state);
          setUi((prev) => ({
            ...prev,
            selectedPiece: null,
            pendingSpellNotation: null,
            spellActivationState: null,
            currentHistoryViewIndex: result.state.history.length - 1,
          }));

          // Persist to server
          const actions = result.state.moveLog[result.state.moveLog.length - 1].actions;
          await sendActions(actions);

          if (result.state.isGameOver) {
            showStatus(result.state.gameEndMessage);
          } else {
            showStatus(
              `${result.state.currentPlayer === "white" ? "White" : "Black"}'s turn`
            );
          }
          return;
        }

        // Re-select own piece
        if (clickedPiece && clickedPiece.color === gameState.currentPlayer) {
          setUi((prev) => ({
            ...prev,
            selectedPiece: { r, c, piece: clickedPiece },
          }));
          return;
        }

        showStatus("Invalid move. Try again.", 2000);
        setUi((prev) => ({ ...prev, selectedPiece: null }));
        return;
      }

      // No piece selected yet – select if own piece
      if (clickedPiece && clickedPiece.color === gameState.currentPlayer) {
        setUi((prev) => ({
          ...prev,
          selectedPiece: { r, c, piece: clickedPiece },
        }));
      }
    },
    [gameState, ui, validMoves]
  );

  // ── Drag-and-drop move ───────────────────────────────────────────────────

  const onDragMove = useCallback(
    async (fromR: number, fromC: number, toR: number, toC: number) => {
      if (fromR === toR && fromC === toC) return;
      const isLatest = ui.currentHistoryViewIndex === gameState.history.length - 1;
      if (!isLatest && !gameState.isGameOver) return;
      if (gameState.isGameOver) return;
      if (playerColor !== "moderator" && gameState.currentPlayer !== playerColor) return;
      if (gameState.awaitingPromotion) return;

      const movingPiece = gameState.board[fromR]?.[fromC];
      if (!movingPiece || movingPiece.color !== gameState.currentPlayer) return;

      const moves = getValidMovesForPiece(fromR, fromC, gameState);
      if (!moves.some((m) => m.toR === toR && m.toC === toC)) return;

      const result = applyMove(gameState, fromR, fromC, toR, toC, ui.pendingSpellNotation);
      if (!result.success) {
        showStatus(result.error, 2500);
        return;
      }

      if (result.awaitingPromotion) {
        setGameState(result.state);
        setUi((prev) => ({ ...prev, selectedPiece: null }));
        return;
      }

      setGameState(result.state);
      setUi((prev) => ({
        ...prev,
        selectedPiece: null,
        pendingSpellNotation: null,
        spellActivationState: null,
        currentHistoryViewIndex: result.state.history.length - 1,
      }));

      const actions = result.state.moveLog[result.state.moveLog.length - 1].actions;
      await sendActions(actions);

      showStatus(
        result.state.isGameOver
          ? result.state.gameEndMessage
          : `${result.state.currentPlayer === "white" ? "White" : "Black"}'s turn`
      );
    },
    [gameState, ui, playerColor]
  );

  // ── Spell casting ────────────────────────────────────────────────────────

  const onCastSpell = useCallback(
    (spellType: "jump" | "freeze") => {
      if (playerColor !== "moderator" && gameState.currentPlayer !== playerColor) return;
      if (gameState.isGameOver || gameState.awaitingPromotion) return;
      if (ui.pendingSpellNotation) {
        showStatus("You already cast a spell this turn. Make your move or cancel.", 2500);
        return;
      }
      if (!canCastSpell(gameState, spellType)) {
        const ps = gameState.spells[gameState.currentPlayer];
        const lastUsed =
          spellType === "jump" ? ps.jumpLastUsedTurn : ps.freezeLastUsedTurn;
        const remaining = lastUsed + SPELL_COOLDOWN_TURNS - gameState.gameTurnNumber;
        showStatus(
          remaining > 0
            ? `${spellType} is on cooldown for ${remaining} more turn(s).`
            : `No ${spellType} spells remaining.`,
          2500
        );
        return;
      }
      if (ui.spellMode === spellType && ui.spellCaster === gameState.currentPlayer) {
        // Toggle off
        setUi((prev) => ({ ...prev, spellMode: null, spellCaster: null }));
        return;
      }
      setUi((prev) => ({
        ...prev,
        selectedPiece: null,
        spellMode: spellType,
        spellCaster: gameState.currentPlayer,
      }));
      showStatus(
        `${spellType === "jump" ? "Jump" : "Freeze"} spell active. Click a ${
          spellType === "jump" ? "piece to make it jumpable." : "square to freeze the area."
        }`
      );
    },
    [gameState, ui]
  );

  const onCancelSpell = useCallback(() => {
    if (!ui.pendingSpellNotation && !ui.spellMode) return;

    if (ui.pendingSpellNotation && ui.spellActivationState) {
      // Undo the spell application
      const newState = replayCompactActions(
        compactLog ? compactLog.split(",").filter(Boolean) : []
      );
      setGameState(newState);
    }

    setUi((prev) => ({
      ...prev,
      spellMode: null,
      spellCaster: null,
      spellActivationState: null,
      pendingSpellNotation: null,
    }));
    showStatus("Spell cancelled.");
  }, [ui, compactLog]);

  // ── Promotion ────────────────────────────────────────────────────────────

  const onPromote = useCallback(
    async (piece: string) => {
      const result = applyPromotion(gameState, piece, ui.pendingSpellNotation);
      if (!result.success) {
        showStatus(result.error, 2500);
        return;
      }
      if (result.awaitingPromotion) return; // shouldn't happen

      setGameState(result.state);
      setUi((prev) => ({
        ...prev,
        pendingSpellNotation: null,
        spellActivationState: null,
        currentHistoryViewIndex: result.state.history.length - 1,
      }));

      const actions = result.state.moveLog[result.state.moveLog.length - 1].actions;
      await sendActions(actions);

      showStatus(
        result.state.isGameOver
          ? result.state.gameEndMessage
          : `${result.state.currentPlayer === "white" ? "White" : "Black"}'s turn`
      );
    },
    [gameState, ui]
  );

  // ── Resign ────────────────────────────────────────────────────────────────

  const onResign = useCallback(async () => {
    if (gameState.isGameOver) return;
    if (playerColor !== "moderator" && gameState.currentPlayer !== playerColor) return;
    const confirmed = window.confirm(
      `Are you sure you want to resign? ${
        gameState.currentPlayer.charAt(0).toUpperCase() +
        gameState.currentPlayer.slice(1)
      } will lose.`
    );
    if (!confirmed) return;
    const newState = applyResign(gameState);
    setGameState(newState);
    setUi((prev) => ({
      ...prev,
      currentHistoryViewIndex: newState.history.length - 1,
    }));
    await sendActions(["R"]);
    showStatus(newState.gameEndMessage);
  }, [gameState]);

  // ── History navigation ───────────────────────────────────────────────────

  const onHistoryBack = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      currentHistoryViewIndex: Math.max(0, prev.currentHistoryViewIndex - 1),
      selectedPiece: null,
    }));
  }, []);

  const onHistoryForward = useCallback(() => {
    setUi((prev) => ({
      ...prev,
      currentHistoryViewIndex: Math.min(
        gameState.history.length - 1,
        prev.currentHistoryViewIndex + 1
      ),
      selectedPiece: null,
    }));
  }, [gameState.history.length]);

  const onHistoryJump = useCallback((index: number) => {
    setUi((prev) => ({
      ...prev,
      currentHistoryViewIndex: Math.max(
        0,
        Math.min(gameState.history.length - 1, index)
      ),
      selectedPiece: null,
    }));
  }, [gameState.history.length]);

  // ── Board flip ───────────────────────────────────────────────────────────

  const onFlipBoard = useCallback(() => {
    setUi((prev) => {
      const next = !prev.isBoardFlipped;
      localStorage.setItem(`boardFlipped_${gameId}`, String(next));
      return { ...prev, isBoardFlipped: next };
    });
  }, []);

  // ── Settings ─────────────────────────────────────────────────────────────

  // Apply theme + board scheme to <body> whenever they change
  useEffect(() => {
    document.body.dataset.theme = ui.theme;
    document.body.dataset.scheme = ui.boardScheme;
  }, [ui.theme, ui.boardScheme]);

  const onToggleTheme = useCallback(() => {
    setUi((prev) => {
      const newTheme = prev.theme === "dark" ? "light" : "dark";
      // Swap paired defaults: dark↔green, light↔wood
      let newScheme = prev.boardScheme;
      if (prev.theme === "dark" && prev.boardScheme === "green") newScheme = "wood";
      else if (prev.theme === "light" && prev.boardScheme === "wood") newScheme = "green";
      localStorage.setItem("spellChessTheme", newTheme);
      localStorage.setItem("spellChessBoardScheme", newScheme);
      return { ...prev, theme: newTheme, boardScheme: newScheme };
    });
  }, []);

  const onSetBoardScheme = useCallback((scheme: "wood" | "green" | "blue" | "purple") => {
    setUi((prev) => ({ ...prev, boardScheme: scheme }));
    localStorage.setItem("spellChessBoardScheme", scheme);
  }, []);

  const onTogglePieceStyle = useCallback(() => {
    setUi((prev) => {
      const next = !prev.useStandardPieces;
      localStorage.setItem("useStandardPieces", String(next));
      return { ...prev, useStandardPieces: next };
    });
  }, []);

  const onToggleLastMoveHighlight = useCallback(() => {
    setUi((prev) => {
      const next = !prev.showLastMoveHighlight;
      localStorage.setItem("showLastMoveHighlight", String(next));
      return { ...prev, showLastMoveHighlight: next };
    });
  }, []);

  const onToggleCoordinates = useCallback(() => {
    setUi((prev) => {
      const next = !prev.showCoordinates;
      localStorage.setItem("showCoordinates", String(next));
      return { ...prev, showCoordinates: next };
    });
  }, []);

  const onToggleValidMoves = useCallback(() => {
    setUi((prev) => {
      const next = !prev.showValidMoves;
      localStorage.setItem("showValidMoves", String(next));
      return { ...prev, showValidMoves: next };
    });
  }, []);

  const onToggleChat = useCallback(() => {
    setUi((prev) => {
      const next = !prev.showChat;
      localStorage.setItem("showChat", String(next));
      return { ...prev, showChat: next };
    });
  }, []);

  const onToggleRules = useCallback(() => {
    setUi((prev) => {
      const next = !prev.showRules;
      localStorage.setItem("showRules", String(next));
      return { ...prev, showRules: next };
    });
  }, []);

  // ── Share link ───────────────────────────────────────────────────────────

  const copyShareLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink).then(() => {
      showStatus("Link copied to clipboard!", 2000);
    });
  }, [shareLink]);

  return {
    gameState,
    uiState: ui,
    status: initialRow.status,
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
  };
}
