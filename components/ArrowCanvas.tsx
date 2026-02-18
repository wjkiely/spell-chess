"use client";

/**
 * ArrowCanvas
 *
 * Renders right-click drawn arrows and rings on top of the chessboard.
 * The canvas is absolutely positioned over the board div.
 *
 * Usage:
 *   <div className="relative" ref={boardRef}>
 *     <ChessBoard ... />
 *     <ArrowCanvas boardRef={boardRef} isFlipped={isFlipped} />
 *   </div>
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  RefObject,
} from "react";

interface Arrow {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
}

interface Ring {
  r: number;
  c: number;
}

interface Props {
  boardRef: RefObject<HTMLDivElement | null>;
  isFlipped: boolean;
}

const ARROW_COLOR = "rgba(255, 170, 0, 0.85)";
const RING_COLOR = "rgba(255, 170, 0, 0.85)";
const ARROW_WIDTH = 8;
const HEAD_SIZE = 18;

export default function ArrowCanvas({ boardRef, isFlipped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [rings, setRings] = useState<Ring[]>([]);
  const rightDragStart = useRef<{ r: number; c: number } | null>(null);

  // Re-draw whenever arrows/rings/flip changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const squareSize = canvas.width / 8;

    function sqCenter(r: number, c: number) {
      const displayR = isFlipped ? 7 - r : r;
      const displayC = isFlipped ? 7 - c : c;
      return {
        x: displayC * squareSize + squareSize / 2,
        y: displayR * squareSize + squareSize / 2,
      };
    }

    // Draw rings
    for (const ring of rings) {
      const { x, y } = sqCenter(ring.r, ring.c);
      ctx.beginPath();
      ctx.arc(x, y, squareSize * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = RING_COLOR;
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    // Draw arrows
    for (const arrow of arrows) {
      if (arrow.fromR === arrow.toR && arrow.fromC === arrow.toC) continue;
      const from = sqCenter(arrow.fromR, arrow.fromC);
      const to = sqCenter(arrow.toR, arrow.toC);
      drawArrow(ctx, from.x, from.y, to.x, to.y, squareSize);
    }
  }, [arrows, rings, isFlipped]);

  function drawArrow(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    squareSize: number
  ) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const tipX = x2 - (squareSize * 0.1) * Math.cos(angle);
    const tipY = y2 - (squareSize * 0.1) * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = ARROW_COLOR;
    ctx.lineWidth = ARROW_WIDTH;
    ctx.lineCap = "round";
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - HEAD_SIZE * Math.cos(angle - Math.PI / 6),
      y2 - HEAD_SIZE * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - HEAD_SIZE * Math.cos(angle + Math.PI / 6),
      y2 - HEAD_SIZE * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = ARROW_COLOR;
    ctx.fill();
  }

  function coordsFromEvent(
    e: React.MouseEvent
  ): { r: number; c: number } | null {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const squareSize = rect.width / 8;
    let c = Math.floor(x / squareSize);
    let r = Math.floor(y / squareSize);
    if (isFlipped) {
      r = 7 - r;
      c = 7 - c;
    }
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return { r, c };
  }

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 2) return;
      const coords = coordsFromEvent(e);
      if (coords) rightDragStart.current = coords;
    },
    [isFlipped]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 2) return;
      const start = rightDragStart.current;
      rightDragStart.current = null;
      if (!start) return;
      const end = coordsFromEvent(e);
      if (!end) return;

      if (start.r === end.r && start.c === end.c) {
        // Toggle ring
        setRings((prev) => {
          const exists = prev.some((rg) => rg.r === start.r && rg.c === start.c);
          return exists
            ? prev.filter((rg) => !(rg.r === start.r && rg.c === start.c))
            : [...prev, { r: start.r, c: start.c }];
        });
      } else {
        // Toggle arrow
        setArrows((prev) => {
          const exists = prev.some(
            (a) =>
              a.fromR === start.r &&
              a.fromC === start.c &&
              a.toR === end.r &&
              a.toC === end.c
          );
          return exists
            ? prev.filter(
                (a) =>
                  !(
                    a.fromR === start.r &&
                    a.fromC === start.c &&
                    a.toR === end.r &&
                    a.toC === end.c
                  )
              )
            : [
                ...prev,
                { fromR: start.r, fromC: start.c, toR: end.r, toC: end.c },
              ];
        });
      }
    },
    [isFlipped]
  );

  // Clear on left-click
  const onLeftClick = useCallback(() => {
    setArrows([]);
    setRings([]);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={480}
      className="absolute top-0 left-0 w-full pointer-events-none"
      style={{ aspectRatio: "1/1", zIndex: 5 }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onLeftClick}
      onContextMenu={(e) => e.preventDefault()}
      // Re-enable pointer events so right-click registers
      // We use pointer-events-none on the canvas by default;
      // the actual events are caught on the parent board wrapper.
    />
  );
}
