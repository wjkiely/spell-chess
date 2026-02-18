"use client";

import { SPELL_COOLDOWN_TURNS, isSpellOnCooldown } from "@/lib/gameEngine";
import type { SpellState } from "@/lib/types";

interface Props {
  player: "white" | "black";
  spells: SpellState;
  currentPlayer: "white" | "black";
  gameTurnNumber: number;
  spellMode: "jump" | "freeze" | null;
  spellCaster: "white" | "black" | null;
  pendingSpellNotation: string | null;
  isGameOver: boolean;
  awaitingPromotion: boolean;
  onCastSpell: (type: "jump" | "freeze") => void;
  onCancelSpell: () => void;
  onResign: () => void;
}

export default function SpellControls({
  player,
  spells,
  currentPlayer,
  gameTurnNumber,
  spellMode,
  spellCaster,
  pendingSpellNotation,
  isGameOver,
  awaitingPromotion,
  onCastSpell,
  onCancelSpell,
  onResign,
}: Props) {
  const isMyTurn = currentPlayer === player;
  const isActiveSpellCaster = spellCaster === player;

  function spellButtonLabel(type: "jump" | "freeze") {
    const count = type === "jump" ? spells.jump : spells.freeze;
    const onCooldown = isSpellOnCooldown(spells, type, gameTurnNumber);
    const active = isActiveSpellCaster && spellMode === type;
    const pending = pendingSpellNotation?.startsWith(type === "jump" ? "jump@" : "freeze@");

    let label = type === "jump" ? "⚡ Jump" : "❄️ Freeze";
    label += ` (${count})`;
    if (pending) label += " ✓";
    else if (active) label += " – cancel";
    else if (onCooldown) {
      const lastUsed = type === "jump" ? spells.jumpLastUsedTurn : spells.freezeLastUsedTurn;
      const remaining = lastUsed + SPELL_COOLDOWN_TURNS - gameTurnNumber;
      if (remaining > 0) label += ` 🕒${remaining}`;
    }
    return label;
  }

  function isDisabled(type: "jump" | "freeze") {
    if (!isMyTurn || isGameOver || awaitingPromotion) return true;
    const count = type === "jump" ? spells.jump : spells.freeze;
    if (count <= 0) return true;
    if (pendingSpellNotation && !pendingSpellNotation.startsWith(type === "jump" ? "jump@" : "freeze@"))
      return true;
    return false;
  }

  return (
    <div className="spell-panel rounded-lg border border-gray-300 p-3 flex flex-col gap-2">
      <h3 className="text-center font-semibold text-base">
        {player === "white" ? "White" : "Black"}
      </h3>

      <button
        onClick={() => onCastSpell("jump")}
        disabled={isDisabled("jump")}
        className={`dark-btn rounded px-2 py-1 text-sm font-medium transition-colors
          ${isActiveSpellCaster && spellMode === "jump"
            ? "spell-jump-active bg-yellow-300 border-yellow-500 border"
            : "bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-40"
          }`}
      >
        {spellButtonLabel("jump")}
      </button>

      <button
        onClick={() => onCastSpell("freeze")}
        disabled={isDisabled("freeze")}
        className={`dark-btn rounded px-2 py-1 text-sm font-medium transition-colors
          ${isActiveSpellCaster && spellMode === "freeze"
            ? "spell-freeze-active bg-blue-200 border-blue-400 border"
            : "bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-40"
          }`}
      >
        {spellButtonLabel("freeze")}
      </button>

      {isMyTurn && (spellMode || pendingSpellNotation) && (
        <button
          onClick={onCancelSpell}
          className="cancel-btn rounded px-2 py-1 text-sm bg-red-50 border border-red-300
                     text-red-700 hover:bg-red-100 transition-colors"
        >
          Cancel spell
        </button>
      )}

      {isMyTurn && !isGameOver && (
        <button
          onClick={onResign}
          className="resign-btn rounded px-2 py-1 text-xs bg-gray-50 border border-gray-300
                     text-gray-500 hover:bg-red-50 hover:text-red-700 hover:border-red-300
                     transition-colors mt-1"
        >
          Resign
        </button>
      )}
    </div>
  );
}
