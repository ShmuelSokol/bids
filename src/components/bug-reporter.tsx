"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function BugReporter() {
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [markupMode, setMarkupMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    number: number;
    url: string;
  } | null>(null);
  const [capturing, setCapturing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const undoStackRef = useRef<ImageData[]>([]);

  const startCapture = useCallback(async () => {
    setSuccess(null);
    setMarkupMode(false);
    setScreenshot(null);
    setCapturing(true);
    setOpen(false);

    // Wait for modal to close so it's not in the screenshot
    await new Promise((r) => setTimeout(r, 400));

    let captured = false;

    // Method 1: html2canvas — captures the visible page content
    try {
      const html2canvas = (await import("html2canvas")).default;
      // Target the main content area, fall back to body
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
        ignoreElements: (el: Element) => {
          // Skip the bug reporter button itself
          return el.closest("[data-bug-reporter]") !== null;
        },
      });
      if (canvas.width > 10 && canvas.height > 10) {
        setScreenshot(canvas.toDataURL("image/jpeg", 0.85));
        captured = true;
      }
    } catch {}

    // Method 2: DOM snapshot — render a styled summary of visible page state
    if (!captured) {
      try {
        const c = document.createElement("canvas");
        const w = Math.min(window.innerWidth, 1400);
        const h = Math.min(window.innerHeight, 900);
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) {
          // Grab computed background
          const bg = getComputedStyle(document.body).backgroundColor || "#fff";
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Walk visible text nodes and render them
          ctx.fillStyle = "#1a1a2e";
          ctx.font = "13px system-ui, sans-serif";
          let y = 20;
          const textEls = document.querySelectorAll("h1,h2,h3,h4,p,td,th,span,a,button,label,div");
          for (const el of textEls) {
            if (y > h - 20) break;
            const rect = el.getBoundingClientRect();
            if (rect.top < 0 || rect.top > window.innerHeight || rect.width === 0) continue;
            const text = (el as HTMLElement).innerText?.trim();
            if (!text || text.length > 200 || text.includes("\n")) continue;
            // Approximate position
            const fontSize = parseFloat(getComputedStyle(el).fontSize) || 13;
            ctx.font = `${Math.min(fontSize, 18)}px system-ui`;
            ctx.fillStyle = getComputedStyle(el).color || "#333";
            ctx.fillText(text.slice(0, 120), Math.max(rect.left, 4), rect.top - window.scrollY + fontSize);
            y = rect.top - window.scrollY + fontSize + 4;
          }

          // Watermark
          ctx.fillStyle = "#94a3b8";
          ctx.font = "11px system-ui";
          ctx.fillText(`${window.location.pathname} — ${new Date().toLocaleString()} — ${w}×${h}`, 8, h - 8);

          setScreenshot(c.toDataURL("image/jpeg", 0.85));
          captured = true;
        }
      } catch {}
    }

    // Method 3: minimal info card
    if (!captured) {
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 200;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, 600, 200);
        ctx.fillStyle = "#334155";
        ctx.font = "bold 14px system-ui";
        ctx.fillText("Screenshot unavailable — please describe below", 20, 30);
        ctx.font = "12px system-ui";
        ctx.fillStyle = "#64748b";
        ctx.fillText("Page: " + window.location.pathname, 20, 60);
        ctx.fillText("Time: " + new Date().toLocaleString(), 20, 80);
        ctx.fillText("Screen: " + window.innerWidth + "x" + window.innerHeight, 20, 100);
        setScreenshot(c.toDataURL("image/png"));
      }
    }

    setCapturing(false);
    setOpen(true);
  }, []);

  const toggleMarkup = useCallback(() => {
    if (!canvasRef.current || !screenshot) return;

    if (!markupMode) {
      // Enter markup mode — draw screenshot onto canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        undoStackRef.current = [
          ctx.getImageData(0, 0, canvas.width, canvas.height),
        ];
      };
      img.src = screenshot;
      setMarkupMode(true);
    } else {
      // Exit markup mode — save canvas back to screenshot
      const canvas = canvasRef.current;
      setScreenshot(canvas.toDataURL("image/jpeg", 0.85));
      setMarkupMode(false);
      undoStackRef.current = [];
    }
  }, [markupMode, screenshot]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    undoStackRef.current.pop();
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    ctx.putImageData(prev, 0, 0);
  }, []);

  // Canvas drawing handlers
  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!markupMode) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      drawingRef.current = true;
      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      const p = getPos(e);
      ctx.moveTo(p.x, p.y);
      e.preventDefault();
    },
    [markupMode, getPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawingRef.current || !markupMode) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    },
    [markupMode, getPos]
  );

  const stopDraw = useCallback(() => {
    if (drawingRef.current && markupMode && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        undoStackRef.current.push(
          ctx.getImageData(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          )
        );
      }
    }
    drawingRef.current = false;
  }, [markupMode]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

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
          screenshot,
          screen_size: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess({ number: data.issue_number, url: data.issue_url });
        // Auto-close after 3s
        setTimeout(() => {
          setOpen(false);
          setSuccess(null);
          setScreenshot(null);
        }, 3000);
      }
    } catch (err) {
      alert("Bug report failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
        <svg
          viewBox="0 0 100 100"
          className="w-9 h-9"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="50" cy="68" rx="14" ry="18" fill="#1a1a1a" />
          <ellipse cx="50" cy="42" rx="11" ry="12" fill="#2d2d2d" />
          <circle cx="50" cy="26" r="9" fill="#1a1a1a" />
          <circle cx="46" cy="24" r="2.5" fill="#ef4444" />
          <circle cx="54" cy="24" r="2.5" fill="#ef4444" />
          <path
            d="M46 18 Q40 6 32 4"
            stroke="#1a1a1a"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M54 18 Q60 6 68 4"
            stroke="#1a1a1a"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="32" cy="4" r="2" fill="#1a1a1a" />
          <circle cx="68" cy="4" r="2" fill="#1a1a1a" />
          <path
            d="M39 36 Q28 30 22 24"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M61 36 Q72 30 78 24"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M37 50 Q24 50 18 44"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M63 50 Q76 50 82 44"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M38 66 Q26 72 20 68"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M62 66 Q74 72 80 68"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
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
          <div className="bg-white rounded-2xl shadow-2xl overflow-y-auto w-[900px] max-w-[95vw] max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                Report a Bug
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl p-2"
              >
                &times;
              </button>
            </div>

            {success ? (
              <div className="p-6 text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-lg font-semibold">Report Submitted!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Bug #{success.number} —{" "}
                  <a
                    href={success.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    View on GitHub
                  </a>
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Screenshot */}
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Screenshot
                      </span>
                      <div className="flex gap-2">
                        {markupMode && (
                          <button
                            onClick={undo}
                            className="text-xs px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium"
                          >
                            Undo
                          </button>
                        )}
                        {screenshot && (
                          <button
                            onClick={toggleMarkup}
                            className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium"
                          >
                            {markupMode ? "Done Editing" : "Edit Markup"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      {markupMode ? (
                        <canvas
                          ref={canvasRef}
                          className="w-full cursor-crosshair"
                          onMouseDown={startDraw}
                          onMouseMove={draw}
                          onMouseUp={stopDraw}
                          onMouseLeave={stopDraw}
                          onTouchStart={startDraw}
                          onTouchMove={draw}
                          onTouchEnd={stopDraw}
                        />
                      ) : screenshot ? (
                        <img
                          src={screenshot}
                          alt="Screenshot"
                          className="w-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center py-20 text-gray-400">
                          <span className="text-sm">
                            Screenshot capture failed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Type
                        </label>
                        <select
                          name="type"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="bug">Bug</option>
                          <option value="feature">Feature Request</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Priority
                        </label>
                        <select
                          name="priority"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        name="description"
                        rows={3}
                        required
                        placeholder="What happened? What did you click?"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Behavior
                      </label>
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
