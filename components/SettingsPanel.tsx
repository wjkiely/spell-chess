"use client";

import { useState, useRef, useEffect } from "react";

type Scheme = "wood" | "green" | "blue" | "purple";

interface Props {
  theme: "light" | "dark";
  boardScheme: Scheme;
  useStandardPieces: boolean;
  showLastMoveHighlight: boolean;
  showBanner: boolean;
  showCoordinates: boolean;
  showValidMoves: boolean;
  showChat: boolean;
  showRules: boolean;
  createdAt?: string;
  onToggleTheme: () => void;
  onSetBoardScheme: (s: Scheme) => void;
  onTogglePieceStyle: () => void;
  onToggleLastMoveHighlight: () => void;
  onToggleCoordinates: () => void;
  onToggleValidMoves: () => void;
  onToggleChat: () => void;
  onToggleRules: () => void;
  onToggleBanner: () => void;
}

const SCHEMES: { id: Scheme; label: string; light: string; dark: string }[] = [
  { id: "wood",   label: "Wood",   light: "#e8d0aa", dark: "#a67d5d" },
  { id: "green",  label: "Green",  light: "#779556", dark: "#597343" },
  { id: "blue",   label: "Blue",   light: "#dee3e6", dark: "#8ca2ad" },
  { id: "purple", label: "Purple", light: "#e6e0f0", dark: "#9583b8" },
];

export default function SettingsPanel({
  theme,
  boardScheme,
  useStandardPieces,
  showLastMoveHighlight,
  showBanner,
  showCoordinates,
  showValidMoves,
  showChat,
  showRules,
  createdAt,
  onToggleTheme,
  onSetBoardScheme,
  onTogglePieceStyle,
  onToggleLastMoveHighlight,
  onToggleCoordinates,
  onToggleValidMoves,
  onToggleChat,
  onToggleRules,
  onToggleBanner,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const isDark = theme === "dark";

  const menuBg = isDark
    ? "bg-[#3c3c3c] border-[#555] text-[#e0e0e0]"
    : "bg-white border-gray-300 text-gray-800";

  const itemCls = isDark
    ? "bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#e0e0e0] border-[#555]"
    : "bg-white hover:bg-gray-100 text-gray-800 border-gray-200";

  const labelCls = isDark ? "text-[#aaa]" : "text-gray-500";
  const sepCls   = isDark ? "bg-[#555]" : "bg-gray-200";
  const btnCls   = isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-900";

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`text-xl px-2 py-1 rounded transition-colors ${btnCls}`}
        aria-label="Settings"
        title="Settings"
      >
        ⚙️
      </button>

      {open && (
        <div
          className={`absolute right-0 top-10 z-50 w-64 rounded border shadow-lg overflow-hidden ${menuBg}`}
        >
          {/* Theme toggle */}
          <button
            onClick={() => { onToggleTheme(); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <span className="w-5 flex-shrink-0 flex items-center justify-center text-base">{isDark ? "☀️" : "🌙"}</span>
            <span>{isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}</span>
          </button>

          {/* Piece style toggle */}
          <button
            onClick={() => { onTogglePieceStyle(); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <span
              className="w-5 flex-shrink-0 flex items-center justify-center text-base"
              style={useStandardPieces
                ? { color: "#1a1a1a" }
                : { color: "white", textShadow: "-0.5px -0.5px 0 #555,-0.5px 0.5px 0 #555,0.5px -0.5px 0 #555,0.5px 0.5px 0 #555" }
              }
            >
              {useStandardPieces ? "♙" : "♟"}
            </span>
            <span>{useStandardPieces ? "Use Solid Pieces" : "Use Standard Pieces"}</span>
          </button>

          {/* Last move highlight toggle */}
          <button
            onClick={() => { onToggleLastMoveHighlight(); }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ boxShadow: "inset 0 0 6px 3px rgba(0, 180, 0, 0.6)" }}
                />
              </div>
              <span>Highlight Last Move</span>
            </div>
            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0
              ${showLastMoveHighlight ? "bg-green-500" : isDark ? "bg-[#666]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showLastMoveHighlight ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </button>

          {/* Board coordinates toggle */}
          <button
            onClick={() => { onToggleCoordinates(); }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 flex-shrink-0 flex items-center justify-center text-sm font-mono font-bold">a1</span>
              <span>Board Coordinates</span>
            </div>
            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0
              ${showCoordinates ? "bg-green-500" : isDark ? "bg-[#666]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showCoordinates ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </button>

          {/* Valid moves highlight toggle */}
          <button
            onClick={() => { onToggleValidMoves(); }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-sm bg-[rgba(201,169,89,0.7)] border border-[#a68a3a]" />
              </div>
              <span>Highlight Valid Moves</span>
            </div>
            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0
              ${showValidMoves ? "bg-green-500" : isDark ? "bg-[#666]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showValidMoves ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => { onToggleChat(); }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 flex-shrink-0 flex items-center justify-center text-base">💬</span>
              <span>Chat</span>
            </div>
            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0
              ${showChat ? "bg-green-500" : isDark ? "bg-[#666]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showChat ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </button>

          {/* Rules toggle */}
          <button
            onClick={() => { onToggleRules(); }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 flex-shrink-0 flex items-center justify-center text-base">📖</span>
              <span>Rules</span>
            </div>
            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0
              ${showRules ? "bg-green-500" : isDark ? "bg-[#666]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showRules ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </button>

          {/* Info banner toggle */}
          <button
            onClick={() => { onToggleBanner(); }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b transition-colors ${itemCls}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 flex-shrink-0 flex items-center justify-center text-base">ℹ️</span>
              <span>Player Info Banner</span>
            </div>
            <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0
              ${showBanner ? "bg-green-500" : isDark ? "bg-[#666]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showBanner ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </button>

          {/* Separator */}
          <div className={`h-px ${sepCls}`} />

          {/* Board color scheme */}
          <div className="px-3 py-2.5">
            <p className={`text-xs mb-2 px-1 ${labelCls}`}>Board Colors</p>
            <div className="flex gap-2 justify-center">
              {SCHEMES.map((s) => (
                <button
                  key={s.id}
                  title={s.label}
                  onClick={() => onSetBoardScheme(s.id)}
                  className={`w-8 h-8 rounded overflow-hidden flex border-2 transition-transform hover:scale-110
                               ${boardScheme === s.id
                                 ? isDark ? "border-[#81c784]" : "border-green-500"
                                 : "border-transparent"}`}
                >
                  <div className="w-1/2 h-full" style={{ backgroundColor: s.light }} />
                  <div className="w-1/2 h-full" style={{ backgroundColor: s.dark }} />
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          {createdAt && <div className={`h-px ${sepCls}`} />}

          {/* Game creation date */}
          {createdAt && (
            <div className={`px-4 py-2.5 text-xs ${labelCls}`}>
              <p className="font-medium mb-0.5">Game Creation Date</p>
              <p>
                {new Date(createdAt).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
