"use client";

import { useState } from "react";

/**
 * Universal data source tooltip — works on hover (desktop) AND click (mobile).
 * Wrap any data value to show where it comes from.
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

  return (
    <span
      className={`relative cursor-help ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
    >
      {children}
      <span className="text-[7px] text-blue-400 align-super ml-0.5">ⓘ</span>
      {open && (
        <span className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1.5 rounded-md bg-gray-900 text-white text-[10px] leading-tight whitespace-normal max-w-[280px] shadow-lg pointer-events-none">
          {source}
        </span>
      )}
    </span>
  );
}
