"use client";

import { useEffect, useRef } from "react";

const COL_GAP = 15;
const ROW_GAP = 7;
const FRAME_MS = 1000 / 30;
/** Alpha buckets: dots are grouped by brightness so each frame needs only a few fills. */
const LEVELS = [0.4, 0.6, 0.8, 1];

/**
 * Animated field of dotted vertical lines that bend like a fabric wave. Static single frame
 * when the visitor prefers reduced motion. Decorative only.
 */
export function ParticleWave({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height);
      const paths = LEVELS.map(() => new Path2D());
      const cols = Math.ceil(width / COL_GAP) + 4;
      const rows = Math.ceil(height / ROW_GAP) + 2;

      for (let c = -2; c < cols; c++) {
        const baseX = c * COL_GAP;
        for (let r = 0; r < rows; r++) {
          const y = r * ROW_GAP;
          const nx = baseX / width;
          const ny = y / height;
          // Layered sines bend each column; their slope stands in for light catching a fold.
          const a = Math.sin(ny * 5.2 + nx * 3.1 + t * 0.35);
          const b = Math.sin(ny * 2.3 - nx * 4.7 - t * 0.22);
          const cc = Math.sin((nx + ny) * 7.5 + t * 0.5);
          const dx = a * 38 + b * 26 + cc * 8;
          const fold = Math.abs(Math.cos(ny * 5.2 + nx * 3.1 + t * 0.35) * 0.6 + Math.cos(ny * 2.3 - nx * 4.7 - t * 0.22) * 0.4);
          const level = Math.min(LEVELS.length - 1, Math.floor(fold * LEVELS.length));
          const size = 1.3 + fold * 0.9;
          paths[level].rect(baseX + dx, y, size, size);
        }
      }

      paths.forEach((path, i) => {
        ctx!.fillStyle = `rgba(232, 255, 242, ${LEVELS[i]})`;
        ctx!.fill(path);
      });
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now / 1000);
    }

    function start() {
      cancelAnimationFrame(frame);
      if (motion.matches) draw(12);
      else frame = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (motion.matches) draw(12);
    });
    observer.observe(canvas);
    resize();
    start();
    motion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}

/** Fixed full-viewport backdrop: the moving dot wave, softly blurred, with dark fades for legibility. */
export function ParticleBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050907]">
      <ParticleWave className="absolute inset-0 size-full blur-[0.4px]" />
      <div className="absolute inset-0 bg-linear-to-r from-[#050907]/65 via-[#050907]/25 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-[#050907]/60 via-transparent to-[#050907]/20" />
      <div className="absolute top-1/4 left-1/3 size-[500px] rounded-full bg-teal-600/10 blur-[140px]" />
      <div className="absolute top-1/3 right-1/4 size-[450px] rounded-full bg-emerald-500/10 blur-[160px]" />
    </div>
  );
}
