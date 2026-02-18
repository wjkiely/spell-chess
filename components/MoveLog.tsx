"use client";

import { useEffect, useRef } from "react";
import type { MoveLogEntry } from "@/lib/types";

interface Props {
  moveLog: MoveLogEntry[];
  currentHistoryViewIndex: number;
  onClickEntry: (plySnapshotIndex: number) => void;
}

export default function MoveLog({
  moveLog,
  currentHistoryViewIndex,
  onClickEntry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves arrive
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moveLog.length]);

  if (moveLog.length === 0) {
    return (
      <div className="move-log rounded-lg border border-gray-200 p-3 text-center text-xs text-gray-400 flex-1">
        No moves yet
      </div>
    );
  }

  // Group into pairs (white + black)
  const pairs: { turn: number; white?: MoveLogEntry; black?: MoveLogEntry }[] = [];
  for (const entry of moveLog) {
    const existing = pairs.find((p) => p.turn === entry.turn);
    if (existing) {
      existing[entry.player] = entry;
    } else {
      pairs.push({ turn: entry.turn, [entry.player]: entry });
    }
  }

  return (
    <div
      ref={containerRef}
      className="move-log rounded-lg border border-gray-200 p-2 overflow-y-auto flex-1 text-xs"
      style={{ maxHeight: 280 }}
    >
      <table className="w-full border-collapse">
        <tbody>
          {pairs.map((pair) => (
            <tr key={pair.turn} className="move-log-row hover:bg-gray-50">
              <td className="move-log-turn-num pr-1 text-gray-400 w-6 text-right">{pair.turn}.</td>
              <MoveCell
                entry={pair.white}
                currentHistoryViewIndex={currentHistoryViewIndex}
                onClickEntry={onClickEntry}
              />
              <MoveCell
                entry={pair.black}
                currentHistoryViewIndex={currentHistoryViewIndex}
                onClickEntry={onClickEntry}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveCell({
  entry,
  currentHistoryViewIndex,
  onClickEntry,
}: {
  entry?: MoveLogEntry;
  currentHistoryViewIndex: number;
  onClickEntry: (idx: number) => void;
}) {
  if (!entry) return <td className="px-1 w-1/2" />;

  const isActive = currentHistoryViewIndex === entry.plySnapshotIndex;
  return (
    <td className="px-1 w-1/2">
      <button
        onClick={() => onClickEntry(entry.plySnapshotIndex)}
        className={`move-log-btn w-full text-left rounded px-1 py-0.5 font-mono transition-colors
          ${isActive ? "move-log-active bg-amber-200 font-semibold" : "hover:bg-gray-100"}`}
      >
        {entry.notation}
      </button>
    </td>
  );
}
