"use client";

import { useEffect, useRef } from "react";

// Zero-dependency class merging utility
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export interface FaceEmbeddingBackgroundProps {
  className?: string;
  children?: React.ReactNode;
  gridSize?: number;
  speed?: number;
}

const FACE_FEATURES = [
  { nx: 0.5,  ny: 0.08, type: "neutral" },
  { nx: 0.35, ny: 0.10, type: "neutral" },
  { nx: 0.65, ny: 0.10, type: "neutral" },
  { nx: 0.33, ny: 0.32, type: "eye" },
  { nx: 0.67, ny: 0.32, type: "eye" },
  { nx: 0.30, ny: 0.25, type: "brow" },
  { nx: 0.70, ny: 0.25, type: "brow" },
  { nx: 0.5,  ny: 0.38, type: "nose" },
  { nx: 0.5,  ny: 0.48, type: "nose" },
  { nx: 0.43, ny: 0.52, type: "nose" },
  { nx: 0.57, ny: 0.52, type: "nose" },
  { nx: 0.22, ny: 0.48, type: "cheek" },
  { nx: 0.78, ny: 0.48, type: "cheek" },
  { nx: 0.38, ny: 0.64, type: "mouth" },
  { nx: 0.5,  ny: 0.63, type: "mouth" },
  { nx: 0.62, ny: 0.64, type: "mouth" },
  { nx: 0.5,  ny: 0.70, type: "mouth" },
  { nx: 0.5,  ny: 0.82, type: "jaw" },
  { nx: 0.38, ny: 0.78, type: "jaw" },
  { nx: 0.62, ny: 0.78, type: "jaw" },
  { nx: 0.18, ny: 0.60, type: "jaw" },
  { nx: 0.82, ny: 0.60, type: "jaw" },
  { nx: 0.22, ny: 0.70, type: "jaw" },
  { nx: 0.78, ny: 0.70, type: "jaw" },
  { nx: 0.12, ny: 0.35, type: "jaw" },
  { nx: 0.88, ny: 0.35, type: "jaw" },
] as const;

type FeatureType = "eye" | "brow" | "nose" | "mouth" | "cheek" | "jaw" | "neutral";

const TYPE_COLOR: Record<FeatureType, { r: number; g: number; b: number }> = {
  eye:     { r: 120, g: 220, b: 255 },
  brow:    { r: 180, g: 160, b: 255 },
  nose:    { r: 100, g: 200, b: 180 },
  mouth:   { r: 255, g: 140, b: 160 },
  cheek:   { r: 100, g: 200, b: 255 },
  jaw:     { r:  80, g: 160, b: 200 },
  neutral: { r: 100, g: 180, b: 220 },
};

interface Feature {
  x: number;
  y: number;
  type: FeatureType;
  phase: number;
  freq: number;
}

export function FaceEmbeddingBackground({
  className,
  children,
  gridSize = 32,
  speed = 1,
}: FaceEmbeddingBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;
    let animationId: number;
    let tick = 0;
    let features: Feature[] = [];

    const buildFeatures = (w: number, h: number): Feature[] => {
      const PAD_X = w * 0.12;
      const PAD_Y = h * 0.08;
      const FW = w - PAD_X * 2;
      const FH = h - PAD_Y * 2;
      return FACE_FEATURES.map((f) => ({
        x: PAD_X + f.nx * FW,
        y: PAD_Y + f.ny * FH,
        type: f.type as FeatureType,
        phase: Math.random() * Math.PI * 2,
        freq: 0.6 + Math.random() * 0.8,
      }));
    };



    const influence = (gx: number, gy: number, feat: Feature, t: number) => {
      const dx = gx - feat.x;
      const dy = gy - feat.y;
      const dist2 = dx * dx + dy * dy;
      const sigma = Math.min(width, height) * 0.14;
      const weight = Math.exp(-dist2 / (2 * sigma * sigma));
      return weight * Math.sin(t * feat.freq + feat.phase);
    };

    const getDisplacement = (gx: number, gy: number, t: number) => {
      let dx = 0, dy = 0;
      for (const f of features) {
        const inf = influence(gx, gy, f, t);
        const ddx = gx - f.x;
        const ddy = gy - f.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) + 1;
        dy += inf * 12 * (ddy / dist);
        dx += inf * 6 * (ddx / dist);
      }
      return { dx, dy };
    };

    const getNodeAlpha = (gx: number, gy: number) => {
      const sigma = Math.min(width, height) * 0.20;
      let total = 0;
      for (const f of features) {
        const d2 = (gx - f.x) ** 2 + (gy - f.y) ** 2;
        total += Math.exp(-d2 / (2 * sigma * sigma));
      }
      return Math.min(1, 0.08 + total * 0.7);
    };

    const blendedColor = (gx: number, gy: number) => {
      const sigma = Math.min(width, height) * 0.17;
      let tr = 0, tg = 0, tb = 0, tw = 0;
      for (const f of features) {
        const d2 = (gx - f.x) ** 2 + (gy - f.y) ** 2;
        const w = Math.exp(-d2 / (2 * sigma * sigma));
        const c = TYPE_COLOR[f.type];
        tr += w * c.r; tg += w * c.g; tb += w * c.b; tw += w;
      }
      if (tw < 0.0001) return { r: 20, g: 40, b: 80 };
      return { r: tr / tw, g: tg / tw, b: tb / tw };
    };

    const animate = () => {
      tick += 0.012 * speed;
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, width, height);

      const COLS = Math.ceil(width / gridSize) + 2;
      const ROWS = Math.ceil(height / gridSize) + 2;

      const nodes: { x: number; y: number; bx: number; by: number }[] = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const bx = (col - 0.5) * gridSize;
          const by = (row - 0.5) * gridSize;
          const { dx, dy } = getDisplacement(bx, by, tick);
          nodes.push({ x: bx + dx, y: by + dy, bx, by });
        }
      }

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const n = nodes[row * COLS + col];
          const alpha = getNodeAlpha(n.bx, n.by);
          const color = blendedColor(n.bx, n.by);

          if (col < COLS - 1) {
            const n2 = nodes[row * COLS + col + 1];
            const edgeAlpha = (alpha + getNodeAlpha(n2.bx, n2.by)) / 2;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${edgeAlpha * 0.55})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }

          if (row < ROWS - 1) {
            const n2 = nodes[(row + 1) * COLS + col];
            const edgeAlpha = (alpha + getNodeAlpha(n2.bx, n2.by)) / 2;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${edgeAlpha * 0.55})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const n = nodes[row * COLS + col];
          const alpha = getNodeAlpha(n.bx, n.by);
          if (alpha < 0.2) continue;
          const color = blendedColor(n.bx, n.by);
          ctx.beginPath();
          ctx.arc(n.x, n.y, 1.5 + alpha * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha * 0.85})`;
          ctx.fill();
        }
      }

      for (let i = 0; i < features.length; i++) {
        for (let j = i + 1; j < features.length; j++) {
          const a = features[i], b = features[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.min(width, height) * 0.26;
          if (dist > maxDist) continue;
          const strength = 1 - dist / maxDist;
          const ca = TYPE_COLOR[a.type], cb = TYPE_COLOR[b.type];
          const mr = (ca.r + cb.r) / 2;
          const mg = (ca.g + cb.g) / 2;
          const mb = (ca.b + cb.b) / 2;
          const pa = (Math.sin(tick * a.freq + a.phase) + 1) / 2;
          const pb = (Math.sin(tick * b.freq + b.phase) + 1) / 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},${strength * (pa * 0.4 + pb * 0.4) * 0.6})`;
          ctx.lineWidth = strength * 1.5;
          ctx.stroke();
        }
      }

      for (const f of features) {
        const c = TYPE_COLOR[f.type];
        const pulse = (Math.sin(tick * f.freq + f.phase) + 1) / 2;
        const { dx, dy } = getDisplacement(f.x, f.y, tick);
        const fx = f.x + dx * 0.3;
        const fy = f.y + dy * 0.3;

        ctx.beginPath();
        ctx.arc(fx, fy, 4 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.4 * (1 - pulse)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.15)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.95)`;
        ctx.fill();
      }

      const vg = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.25,
        width / 2, height / 2, Math.min(width, height) * 0.75,
      );
      vg.addColorStop(0, "rgba(3,7,18,0)");
      vg.addColorStop(1, "rgba(3,7,18,0.75)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);

      animationId = requestAnimationFrame(animate);
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      features = buildFeatures(width, height);

      // Start animation once we have dimensions
      if (!animationId) {
        animationId = requestAnimationFrame(animate);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    return () => {
      cancelAnimationFrame(animationId);
      ro.disconnect();
    };
  }, [gridSize, speed]);

  return (
    <div ref={containerRef} className={cn("fixed inset-0 overflow-hidden bg-[#030712]", className)}>
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 h-full w-full pointer-events-none" 
        style={{ zIndex: 0 }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
        style={{ background: "linear-gradient(to bottom, #030712 0%, transparent 100%)", zIndex: 1 }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 0%, transparent 40%, #030712 100%)",
          zIndex: 1
        }}
      />
      <div className="relative z-10 w-full h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
