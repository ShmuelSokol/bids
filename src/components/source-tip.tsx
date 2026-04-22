"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Universal data source tooltip — works on hover (desktop) AND click (mobile).
 * Wrap any data value to show where it comes from.
 *
 * Uses a portal + fixed positioning so the tooltip escapes any ancestor
 * overflow-hidden clipping (the PO card wraps its contents in overflow-hidden
 * for rounded-corner styling, which was cropping tooltips on the top row of
 * every table cell before this rewrite).
 *
 * Placement: prefers above the trigger; flips below if near the viewport top.
 * Horizontally clamps to keep the tooltip on-screen.
 *
 * Usage:
 *   <SourceTip source="LamLinks k10_tab.sol_no_k10 — synced daily at 5:30 AM">
 *     SPE2DH-26-T-1744
 *   </SourceTip>
 */
export function SourceTip({
  source,
  children,
  className = "",
}: {
  source: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { setMounted(true); }, []);

  function computePosition() {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const estH = 60;  // approx tooltip height
    const estW = 280; // max-w from styles
    const placement: "above" | "below" = r.top < estH + 12 || r.top > vh - 40 ? "below" : "above";
    const top = placement === "above" ? r.top - estH - 4 : r.bottom + 4;
    let left = r.left;
    if (left + estW > vw - 8) left = vw - estW - 8;
    if (left < 8) left = 8;
    setCoords({ top, left, placement });
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={`cursor-help ${className}`}
        onMouseEnter={() => { computePosition(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); if (!open) computePosition(); setOpen(!open); }}
      >
        {children}
        <span className="text-[7px] text-blue-400 align-super ml-0.5">ⓘ</span>
      </span>
      {open && mounted && coords && createPortal(
        <span
          className="fixed z-[9999] px-2 py-1.5 rounded-md bg-gray-900 text-white text-[10px] leading-tight whitespace-normal max-w-[280px] shadow-lg pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {source}
        </span>,
        document.body
      )}
    </>
  );
}
