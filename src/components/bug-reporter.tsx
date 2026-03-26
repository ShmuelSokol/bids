"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Tool = "draw" | "circle" | "rect" | "arrow";

export function BugReporter() {
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ number: number; url: string } | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Markup state — starts OFF, user clicks "Edit Markup" to activate (Bug #4)
  const [markupActive, setMarkupActive] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ef4444");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const undoStackRef = useRef<ImageData[]>([]);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  // Load screenshot into canvas when screenshot changes (NOT on open toggle)
  useEffect(() => {
    if (!screenshot || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxW = 800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      baseImageRef.current = img;
      undoStackRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    };
    img.src = screenshot;
  }, [screenshot]);

  const startCapture = useCallback(async () => {
    setSuccess(null);
    setMarkupActive(false);
    setScreenshot(null);
    setCapturing(true);
    setOpen(false);
    setTool("draw");
    undoStackRef.current = [];

    await new Promise((r) => setTimeout(r, 400));

    let captured = false;

    // Method 1: html2canvas
    try {
      const html2canvas = (await import("html2canvas")).default;
      const target = document.querySelector("main") || document.body;
      const canvas = await html2canvas(target as HTMLElement, {
        scale: Math.min(window.devicePixelRatio, 2),
        logging: false,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: window.innerHeight,
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
        y: window.scrollY,
        x: 0,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 3000,
        removeContainer: true,
        ignoreElements: (el: Element) => el.closest("[data-bug-reporter]") !== null,
      });
      if (canvas.width > 10 && canvas.height > 10) {
        setScreenshot(canvas.toDataURL("image/jpeg", 0.85));
        captured = true;
      }
    } catch {}

    // Method 2: DOM text snapshot
    if (!captured) {
      try {
        const c = document.createElement("canvas");
        const w = Math.min(window.innerWidth, 1400);
        const h = Math.min(window.innerHeight, 900);
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#1a1a2e";
          const textEls = document.querySelectorAll("h1,h2,h3,h4,p,td,th,span,a,button,label,div");
          for (const el of textEls) {
            const rect = el.getBoundingClientRect();
            if (rect.top < 0 || rect.top > window.innerHeight || rect.width === 0) continue;
            const text = (el as HTMLElement).innerText?.trim();
            if (!text || text.length > 200 || text.includes("\n")) continue;
            const fontSize = parseFloat(getComputedStyle(el).fontSize) || 13;
            ctx.font = `${Math.min(fontSize, 18)}px system-ui`;
            ctx.fillStyle = getComputedStyle(el).color || "#333";
            ctx.fillText(text.slice(0, 120), Math.max(rect.left, 4), rect.top - window.scrollY + fontSize);
          }
          ctx.fillStyle = "#94a3b8"; ctx.font = "11px system-ui";
          ctx.fillText(`${window.location.pathname} — ${new Date().toLocaleString()}`, 8, h - 8);
          setScreenshot(c.toDataURL("image/jpeg", 0.85));
          captured = true;
        }
      } catch {}
    }

    // Method 3: fallback info card
    if (!captured) {
      const c = document.createElement("canvas");
      c.width = 600; c.height = 200;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f1f5f9"; ctx.fillRect(0, 0, 600, 200);
        ctx.fillStyle = "#334155"; ctx.font = "bold 14px system-ui";
        ctx.fillText("Screenshot unavailable", 20, 30);
        ctx.font = "12px system-ui"; ctx.fillStyle = "#64748b";
        ctx.fillText("Page: " + window.location.pathname, 20, 60);
        ctx.fillText("Time: " + new Date().toLocaleString(), 20, 80);
        setScreenshot(c.toDataURL("image/png"));
      }
    }

    setCapturing(false);
    setOpen(true);
  }, []);

  // --- Canvas drawing logic ---

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      // touches is empty on touchEnd — use changedTouches
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch?.clientX ?? 0;
      clientY = touch?.clientY ?? 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    // Keep undo stack manageable
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
  }, []);

  const restoreLastSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || undoStackRef.current.length === 0) return;
    const last = undoStackRef.current[undoStackRef.current.length - 1];
    ctx.putImageData(last, 0, 0);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const p = getPos(e);
    startPosRef.current = p;
    drawingRef.current = true;

    if (tool === "draw") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(p.x, p.y);
    }
    // For shapes: the current top of undoStack is the anchor we restore during drag
  }, [tool, color, getPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPos(e);

    if (tool === "draw") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      // For shapes: restore last snapshot then draw preview
      restoreLastSnapshot();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      const s = startPosRef.current;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (tool === "circle") {
        const rx = Math.abs(p.x - s.x) / 2;
        const ry = Math.abs(p.y - s.y) / 2;
        const cx = (s.x + p.x) / 2;
        const cy = (s.y + p.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "rect") {
        ctx.beginPath();
        ctx.strokeRect(s.x, s.y, p.x - s.x, p.y - s.y);
      } else if (tool === "arrow") {
        // Line
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(p.y - s.y, p.x - s.x);
        const headLen = 16;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - headLen * Math.cos(angle - Math.PI / 6), p.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - headLen * Math.cos(angle + Math.PI / 6), p.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }, [tool, color, getPos, restoreLastSnapshot]);

  const handleMouseUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    saveSnapshot();
  }, [saveSnapshot]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length <= 1) return;
    undoStackRef.current.pop();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    ctx.putImageData(prev, 0, 0);
  }, []);

  const clearMarkup = useCallback(() => {
    if (undoStackRef.current.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    // Restore to the first snapshot (original screenshot)
    const first = undoStackRef.current[0];
    ctx.putImageData(first, 0, 0);
    undoStackRef.current = [first];
  }, []);

  // Get final screenshot from canvas (if markup was used) or original
  function getMarkupScreenshot(): string | null {
    if (canvasRef.current && canvasRef.current.width > 0 && undoStackRef.current.length > 1) {
      return canvasRef.current.toDataURL("image/jpeg", 0.85);
    }
    return screenshot;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const finalScreenshot = getMarkupScreenshot();

    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.get("type"),
          priority: formData.get("priority"),
          url: window.location.href,
          description: formData.get("description"),
          expected: formData.get("expected"),
          screenshot: finalScreenshot,
          screen_size: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess({ number: data.issue_number, url: data.issue_url });
        setTimeout(() => { setOpen(false); setSuccess(null); setScreenshot(null); }, 3000);
      }
    } catch (err) {
      alert("Bug report failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
      // Ctrl+Z for undo while modal is open
      if (open && (e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, undo]);

  const tools: { id: Tool; label: string; icon: string }[] = [
    { id: "draw", label: "Draw", icon: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" },
    { id: "circle", label: "Circle", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" },
    { id: "rect", label: "Rectangle", icon: "M3 5v14h18V5H3zm16 12H5V7h14v10z" },
    { id: "arrow", label: "Arrow", icon: "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" },
  ];

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ffffff", "#000000"];

  return (
    <>
      {/* Floating Bug Button */}
      <button
        onClick={startCapture}
        title="Report a Bug"
        data-bug-reporter="true"
        className="fixed bottom-5 right-5 z-[99998] w-12 h-12 hover:scale-125 transition-transform flex items-center justify-center cursor-pointer"
        style={{ background: "none", border: "none" }}
      >
        <svg viewBox="0 0 100 100" className="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="50" cy="68" rx="14" ry="18" fill="#1a1a1a" />
          <ellipse cx="50" cy="42" rx="11" ry="12" fill="#2d2d2d" />
          <circle cx="50" cy="26" r="9" fill="#1a1a1a" />
          <circle cx="46" cy="24" r="2.5" fill="#ef4444" />
          <circle cx="54" cy="24" r="2.5" fill="#ef4444" />
          <path d="M46 18 Q40 6 32 4" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <path d="M54 18 Q60 6 68 4" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="4" r="2" fill="#1a1a1a" />
          <circle cx="68" cy="4" r="2" fill="#1a1a1a" />
          <path d="M39 36 Q28 30 22 24" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M61 36 Q72 30 78 24" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M37 50 Q24 50 18 44" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M63 50 Q76 50 82 44" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 66 Q26 72 20 68" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M62 66 Q74 72 80 68" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Capture toast */}
      {capturing && (
        <div className="fixed bottom-20 right-5 z-[99998] bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          Capturing screenshot...
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[99999]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl overflow-y-auto w-[960px] max-w-[95vw] max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Report a Bug</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl p-2">&times;</button>
            </div>

            {success ? (
              <div className="p-6 text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold">Report Submitted!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Bug #{success.number} —{" "}
                  <a href={success.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View on GitHub</a>
                </p>
              </div>
            ) : (
              <div className="p-4">
                {/* Markup Toolbar — only shown when markup is active */}
                {screenshot && markupActive && (
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-500 mr-1">Markup:</span>

                    {/* Tool buttons */}
                    {tools.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTool(t.id)}
                        title={t.label}
                        className={`p-1.5 rounded-lg transition-all ${
                          tool === t.id
                            ? "bg-red-100 text-red-700 ring-2 ring-red-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d={t.icon} />
                        </svg>
                      </button>
                    ))}

                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    {/* Color swatches */}
                    {colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          color === c ? "border-gray-800 scale-125" : "border-gray-300"
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}

                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    {/* Undo / Clear / Done */}
                    <button onClick={undo} disabled={undoStackRef.current.length <= 1}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-30" title="Undo (Ctrl+Z)">
                      Undo
                    </button>
                    <button onClick={clearMarkup} disabled={undoStackRef.current.length <= 1}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-30">
                      Clear
                    </button>
                    <button onClick={() => setMarkupActive(false)}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium">
                      Done Editing
                    </button>
                    <button onClick={startCapture}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium ml-auto">
                      Retake
                    </button>
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-4">
                  {/* Screenshot — static image by default, canvas when markup active */}
                  <div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 relative">
                      {screenshot && markupActive ? (
                        <canvas
                          ref={canvasRef}
                          className={`w-full ${
                            tool === "draw" ? "cursor-crosshair" :
                            tool === "circle" || tool === "rect" ? "cursor-cell" :
                            "cursor-pointer"
                          }`}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onTouchStart={handleMouseDown}
                          onTouchMove={handleMouseMove}
                          onTouchEnd={handleMouseUp}
                        />
                      ) : screenshot ? (
                        <div className="relative group">
                          <img src={screenshot} alt="Screenshot" className="w-full" />
                          <button
                            onClick={() => setMarkupActive(true)}
                            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all"
                          >
                            <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 text-xs font-semibold px-4 py-2 rounded-lg shadow transition-opacity">
                              Click to Edit Markup
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-20 text-gray-400">
                          <span className="text-sm">Screenshot capture failed</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">
                      Draw on the screenshot to highlight the issue. Ctrl+Z to undo.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                        <select name="type" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          <option value="bug">Bug</option>
                          <option value="feature">Feature Request</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                        <select name="priority" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        name="description"
                        rows={3}
                        required
                        placeholder="What happened? What did you click?"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expected Behavior</label>
                      <textarea
                        name="expected"
                        rows={2}
                        placeholder="What should have happened instead?"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Report"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
