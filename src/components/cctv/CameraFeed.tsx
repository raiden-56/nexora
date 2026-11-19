"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Device, Room } from "@/lib/types";

/**
 * Renders a camera's picture into a canvas.
 *
 * Only simulated cameras have a picture: a procedurally drawn scene of the room they're in, with the
 * room's real light state (lights off at night → infrared), a person walking through while the camera
 * reports motion, and the camera name + time burnt in like a real DVR. It is always marked SIMULATED.
 * Real integrations don't stream video yet, so their cameras say so instead of showing a fake image.
 */

const LW = 480; // logical drawing size (16:9); the canvas is scaled to its resolution
const LH = 270;

export interface CameraFeedHandle {
  /** PNG data URL of the current frame, or null when there is no picture. */
  snapshot(): string | null;
}

export interface FeedProps {
  device: Device;
  room: Room | undefined;
  /** any light in the room is on */
  lightsOn: boolean;
  timezone: string;
  hd?: boolean;
  className?: string;
}

// ─── shared frame clock: one rAF loop for every feed on the page ───────────────
type Sub = (t: number) => void;
const subs = new Set<Sub>();
let raf = 0;
let last = 0;
let fps = 10;
function loop(t: number) {
  raf = requestAnimationFrame(loop);
  if (t - last < 1000 / fps) return;
  last = t;
  subs.forEach((f) => f(t));
}
function subscribe(f: Sub) {
  subs.add(f);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    subs.delete(f);
    if (!subs.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────────
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseTiles: HTMLCanvasElement[] | null = null;
function noise() {
  if (noiseTiles) return noiseTiles;
  noiseTiles = [0, 1, 2, 3].map(() => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    const x = c.getContext("2d")!;
    const img = x.createImageData(160, 90);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  });
  return noiseTiles;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function stamp(tz: string, d = new Date()) {
  let f = fmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch {
      f = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { text: `${p.year}-${p.month}-${p.day}  ${p.hour}:${p.minute}:${p.second}`, hour: Number(p.hour) % 24 };
}

type Paint = (r: number, g: number, b: number, a?: number) => string;

function painter(ir: boolean, exposure: number): Paint {
  return (r, g, b, a = 1) => {
    if (ir) {
      const y = Math.min(255, (0.3 * r + 0.59 * g + 0.11 * b) * exposure);
      return `rgba(${y * 0.92},${y},${y * 0.95},${a})`;
    }
    return `rgba(${Math.min(255, r * exposure)},${Math.min(255, g * exposure)},${Math.min(255, b * exposure)},${a})`;
  };
}

function poly(x: CanvasRenderingContext2D, pts: number[], fill: string) {
  x.beginPath();
  x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.closePath();
  x.fillStyle = fill;
  x.fill();
}

/** A 2.5D box standing on the floor: front face plus a lighter top. */
function block(x: CanvasRenderingContext2D, P: Paint, cx: number, base: number, w: number, h: number, depth: number, rgb: [number, number, number]) {
  const [r, g, b] = rgb;
  poly(x, [cx - w / 2, base - h, cx + w / 2, base - h, cx + w / 2 - depth * 0.4, base - h - depth, cx - w / 2 + depth * 0.4, base - h - depth], P(r * 1.25, g * 1.25, b * 1.25));
  x.fillStyle = P(r, g, b);
  x.fillRect(cx - w / 2, base - h, w, h);
  x.fillStyle = P(0, 0, 0, 0.25);
  x.fillRect(cx - w / 2, base - 2, w, 2);
}

interface Scene {
  kind: string;
  outdoor: boolean;
  pool: boolean;
  seed: number;
}

function drawScene(x: CanvasRenderingContext2D, s: Scene, t: number, ir: boolean, lit: boolean, motion: boolean) {
  const R = rng(s.seed);
  const P = painter(ir, ir ? 1.15 : lit ? 1 : 0.55);
  const vx = LW * (0.42 + R() * 0.16);
  const corridor = s.kind === "corridor";
  const bw = corridor ? 70 : 190 + R() * 40;
  const bh = corridor ? 70 : 120;
  const bx1 = vx - bw / 2;
  const bx2 = vx + bw / 2;
  const by1 = LH * 0.14;
  const by2 = by1 + bh;

  if (s.outdoor) {
    const sky = x.createLinearGradient(0, 0, 0, LH * 0.55);
    sky.addColorStop(0, P(120, 150, 175));
    sky.addColorStop(1, P(185, 195, 200));
    x.fillStyle = sky;
    x.fillRect(0, 0, LW, LH);
    poly(x, [0, LH * 0.52, LW, LH * 0.47, LW, LH, 0, LH], P(95, 98, 92));
    // trees / distant buildings
    for (let i = 0; i < 7; i++) {
      const tx = R() * LW;
      const th = 25 + R() * 35;
      x.fillStyle = P(60, 85, 62);
      x.beginPath();
      x.ellipse(tx, LH * 0.5 - th / 2, 18 + R() * 14, th / 2, 0, 0, Math.PI * 2);
      x.fill();
    }
    if (s.pool) {
      poly(x, [LW * 0.18, LH * 0.68, LW * 0.8, LH * 0.66, LW * 0.92, LH * 0.92, LW * 0.08, LH * 0.95], P(70, 150, 170));
      x.strokeStyle = P(220, 240, 245, 0.35);
      for (let i = 0; i < 5; i++) {
        const yy = LH * 0.72 + i * 9 + Math.sin(t / 700 + i) * 2;
        x.beginPath();
        x.moveTo(LW * 0.2 + i * 6, yy);
        x.quadraticCurveTo(LW * 0.5, yy + Math.sin(t / 500 + i) * 4, LW * 0.82 - i * 4, yy);
        x.stroke();
      }
    }
    // railing
    x.fillStyle = P(70, 72, 76);
    x.fillRect(0, LH * 0.58, LW, 4);
    for (let i = 0; i < LW; i += 26) x.fillRect(i, LH * 0.58, 3, LH * 0.15);
  } else {
    poly(x, [0, 0, LW, 0, bx2, by1, bx1, by1], P(118, 124, 130)); // ceiling
    poly(x, [0, 0, bx1, by1, bx1, by2, 0, LH], P(96, 104, 112)); // left wall
    poly(x, [LW, 0, bx2, by1, bx2, by2, LW, LH], P(88, 96, 104)); // right wall
    x.fillStyle = P(132, 136, 140);
    x.fillRect(bx1, by1, bw, bh); // back wall
    poly(x, [0, LH, LW, LH, bx2, by2, bx1, by2], P(74, 72, 70)); // floor
    // floor lines in perspective
    x.strokeStyle = P(40, 40, 40, 0.35);
    x.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      x.beginPath();
      x.moveTo((i * LW) / 8, LH);
      x.lineTo(bx1 + (i * bw) / 8, by2);
      x.stroke();
    }
    for (let k = 1; k < 6; k++) {
      const f = (k / 6) ** 2;
      const y = by2 + (LH - by2) * f;
      x.beginPath();
      x.moveTo(bx1 - bx1 * f, y);
      x.lineTo(bx2 + (LW - bx2) * f, y);
      x.stroke();
    }
    // ceiling lights
    for (let i = 0; i < 3; i++) {
      const f = 0.25 + i * 0.25;
      const cx = vx + (R() - 0.5) * 30;
      const cy = by1 * (1 - f) + 2;
      x.fillStyle = lit && !ir ? "rgba(255,248,225,0.95)" : P(150, 150, 150);
      x.fillRect(cx - 22 * (1 - f * 0.6), cy, 44 * (1 - f * 0.6), 3);
    }
    furnish(x, P, s, R, t, { bx1, bx2, by1, by2, bw, bh, vx });
  }

  if (motion) person(x, P, s, t);

  // infrared illuminator falloff / general vignette
  const v = x.createRadialGradient(LW / 2, LH / 2, LH * 0.25, LW / 2, LH / 2, LW * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, ir ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)");
  x.fillStyle = v;
  x.fillRect(0, 0, LW, LH);
}

function furnish(x: CanvasRenderingContext2D, P: Paint, s: Scene, R: () => number, t: number, g: { bx1: number; bx2: number; by1: number; by2: number; bw: number; bh: number; vx: number }) {
  const { bx1, bx2, by1, by2, bw, vx } = g;
  const windowRect = () => {
    const wx = bx1 + bw * (0.15 + R() * 0.3);
    x.fillStyle = P(200, 212, 220);
    x.fillRect(wx, by1 + 18, bw * 0.38, 52);
    x.fillStyle = P(90, 96, 104);
    x.fillRect(wx + bw * 0.19 - 1, by1 + 18, 2, 52);
  };
  switch (s.kind) {
    case "corridor": {
      for (let i = 0; i < 4; i++) {
        const f1 = 0.15 + i * 0.2;
        const f2 = f1 + 0.09;
        const lx = (p: number) => bx1 * p;
        const yt = (p: number) => by1 * p + 30 * (1 - p);
        const yb = (p: number) => LH - (LH - by2) * p;
        poly(x, [lx(f1), yt(f1), lx(f2), yt(f2), lx(f2), yb(f2), lx(f1), yb(f1)], P(70, 58, 48));
        const rx = (p: number) => LW - (LW - bx2) * p;
        poly(x, [rx(f1), yt(f1), rx(f2), yt(f2), rx(f2), yb(f2), rx(f1), yb(f1)], P(66, 55, 46));
      }
      x.fillStyle = P(60, 150, 90);
      x.fillRect(vx - 10, by1 + 6, 20, 7); // exit sign
      break;
    }
    case "lobby": {
      x.fillStyle = P(185, 195, 200);
      x.fillRect(vx - 40, by1 + 22, 80, g.bh - 22); // glass entrance
      x.fillStyle = P(80, 86, 92);
      x.fillRect(vx - 1, by1 + 22, 2, g.bh - 22);
      block(x, P, LW * 0.3, LH * 0.82, 150, 34, 14, [92, 70, 52]); // reception desk
      for (const px of [bx1 - 20, bx2 + 30]) {
        x.fillStyle = P(56, 92, 60);
        x.beginPath();
        x.arc(px, by2 + 20, 16, 0, Math.PI * 2);
        x.fill();
        block(x, P, px, by2 + 44, 18, 16, 4, [80, 76, 72]);
      }
      break;
    }
    case "dining":
      for (let row = 0; row < 2; row++)
        for (let c = 0; c < 3; c++) {
          const base = by2 + 28 + row * 52;
          const cx = vx + (c - 1) * (90 + row * 60);
          block(x, P, cx, base, 44 + row * 18, 14 + row * 4, 10 + row * 4, [110, 84, 62]);
        }
      windowRect();
      break;
    case "kitchen":
      block(x, P, vx, by2 + 4, bw * 0.9, 36, 10, [150, 150, 146]);
      x.fillStyle = P(110, 112, 114);
      x.fillRect(bx1 + 10, by1 + 12, bw - 20, 30); // cabinets
      block(x, P, LW * 0.68, LH * 0.88, 120, 40, 16, [130, 128, 124]); // island
      break;
    case "office":
    case "meeting": {
      const n = s.kind === "meeting" ? 1 : 3;
      for (let i = 0; i < n; i++) {
        const base = by2 + 30 + i * 40;
        const w = s.kind === "meeting" ? 220 : 80 + i * 30;
        for (const off of s.kind === "meeting" ? [0] : [-1, 1]) {
          const cx = vx + off * (70 + i * 45);
          block(x, P, cx, base, w, 12, 12, [140, 130, 118]);
          x.fillStyle = P(30, 34, 40);
          x.fillRect(cx - 14, base - 34, 28, 18); // monitor
        }
      }
      windowRect();
      break;
    }
    case "server":
      for (let i = 0; i < 5; i++) {
        const cx = bx1 + 20 + i * ((bw - 40) / 4);
        x.fillStyle = P(36, 40, 46);
        x.fillRect(cx - 16, by1 + 14, 32, g.bh - 14);
        for (let k = 0; k < 9; k++) {
          const on = (Math.floor(t / 300) + i * 3 + k * 7) % 5 !== 0;
          x.fillStyle = on ? P(90, 230, 150) : P(40, 60, 50);
          x.fillRect(cx - 12, by1 + 22 + k * 11, 3, 2);
        }
      }
      break;
    default: {
      // living rooms and anything else
      // Positions vary per camera so two cameras in one room don't look identical.
      windowRect();
      const sofaX = LW * (0.22 + R() * 0.3);
      const sofaY = LH * (0.74 + R() * 0.1);
      block(x, P, sofaX, sofaY, 170, 30, 22, [92, 90, 104]); // sofa
      block(x, P, sofaX, sofaY - 30, 170, 18, 6, [80, 78, 92]);
      block(x, P, sofaX > LW * 0.4 ? LW * 0.18 : LW * 0.74, LH * 0.9, 70, 16, 18, [110, 84, 62]); // table
      x.fillStyle = P(20, 22, 26);
      x.fillRect(R() > 0.5 ? bx2 - 70 : bx1 + 14, by1 + 40, 56, 32); // tv
    }
  }
}

/** Someone walking across the frame — only drawn while the camera reports motion. */
function person(x: CanvasRenderingContext2D, P: Paint, s: Scene, t: number) {
  const period = 9000;
  const p = ((t + (s.seed % period)) % period) / period;
  const px = -30 + p * (LW + 60);
  const depth = 0.55 + ((s.seed >> 3) % 30) / 100; // 0.55–0.85
  const base = LH * (0.62 + depth * 0.3);
  const sc = 0.6 + depth * 0.7;
  const step = Math.sin(t / 140) * 6 * sc;
  const c = P(38, 40, 46);
  x.fillStyle = c;
  x.strokeStyle = c;
  x.lineCap = "round";
  x.lineWidth = 6 * sc;
  x.beginPath();
  x.moveTo(px, base - 30 * sc);
  x.lineTo(px - step, base);
  x.moveTo(px, base - 30 * sc);
  x.lineTo(px + step, base);
  x.stroke();
  x.beginPath();
  x.roundRect(px - 9 * sc, base - 62 * sc, 18 * sc, 36 * sc, 6 * sc);
  x.fill();
  x.beginPath();
  x.arc(px, base - 70 * sc, 7 * sc, 0, Math.PI * 2);
  x.fill();
  // motion analytics box
  x.strokeStyle = "rgba(255,210,80,0.95)";
  x.lineWidth = 1.5;
  x.strokeRect(px - 18 * sc, base - 82 * sc, 36 * sc, 86 * sc);
  x.fillStyle = "rgba(255,210,80,0.95)";
  x.font = "bold 9px ui-monospace, monospace";
  x.fillText("PERSON", px - 18 * sc, base - 85 * sc);
}

function burnIn(x: CanvasRenderingContext2D, name: string, time: string, t: number, rec: boolean, ir: boolean) {
  x.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  x.textBaseline = "top";
  const text = (s: string, tx: number, ty: number) => {
    x.fillStyle = "rgba(0,0,0,0.55)";
    x.fillText(s, tx + 1, ty + 1);
    x.fillStyle = "rgba(255,255,255,0.92)";
    x.fillText(s, tx, ty);
  };
  text(time, 12, 10);
  text(name.toUpperCase(), 12, LH - 24);
  const right = (s: string, ty: number) => text(s, LW - 12 - x.measureText(s).width, ty);
  if (rec) {
    if (Math.floor(t / 600) % 2 === 0) {
      x.fillStyle = "#ff4d4d";
      x.beginPath();
      x.arc(LW - 50, 16, 4.5, 0, Math.PI * 2);
      x.fill();
    }
    right("REC", 10);
  }
  if (ir) right("IR", 28);
  right("SIMULATED", LH - 24);
  x.textBaseline = "alphabetic";
}

function drawStatic(x: CanvasRenderingContext2D, title: string, sub: string) {
  const tiles = noise();
  x.globalAlpha = 1;
  x.drawImage(tiles[Math.floor(Math.random() * tiles.length)], 0, 0, LW, LH);
  x.fillStyle = "rgba(6,10,14,0.72)";
  x.fillRect(0, 0, LW, LH);
  x.textAlign = "center";
  x.fillStyle = "rgba(255,255,255,0.9)";
  x.font = "700 18px ui-monospace, monospace";
  x.fillText(title, LW / 2, LH / 2 - 2);
  x.font = "12px ui-monospace, monospace";
  x.fillStyle = "rgba(255,255,255,0.6)";
  x.fillText(sub, LW / 2, LH / 2 + 20);
  x.textAlign = "start";
}

export function sceneFor(device: Device, room: Room | undefined): Scene {
  const kind = room?.kind ?? "living";
  const name = `${room?.name ?? ""} ${device.name}`.toLowerCase();
  return {
    kind,
    outdoor: kind === "balcony" || /pool|deck|garden|gate|driveway/.test(name),
    pool: /pool/.test(name),
    seed: hash(device.id),
  };
}

export const CameraFeed = forwardRef<CameraFeedHandle, FeedProps>(function CameraFeed({ device, room, lightsOn, timezone, hd, className }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const live = useRef({ device, room, lightsOn, timezone });
  live.current = { device, room, lightsOn, timezone };
  const simulated = device.provider === "simulated";
  const hasPicture = simulated && device.online && !device.state.privacy;

  useImperativeHandle(ref, () => ({ snapshot: () => (hasPicture && canvas.current ? canvas.current.toDataURL("image/png") : null) }), [hasPicture]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;
    fps = reduce ? 2 : 10;
    const scale = c.width / LW;
    let frame = 0;
    const draw = (t: number) => {
      const { device: d, room: r, lightsOn: lights, timezone: tz } = live.current;
      x.setTransform(scale, 0, 0, scale, 0, 0);
      if (d.provider !== "simulated") {
        x.fillStyle = "#0b1118";
        x.fillRect(0, 0, LW, LH);
        return;
      }
      if (!d.online) return drawStatic(x, "NO SIGNAL", "Camera is offline");
      if (d.state.privacy) {
        x.fillStyle = "#06090c";
        x.fillRect(0, 0, LW, LH);
        x.textAlign = "center";
        x.fillStyle = "rgba(255,255,255,0.85)";
        x.font = "700 16px ui-monospace, monospace";
        x.fillText("PRIVACY MODE", LW / 2, LH / 2);
        x.font = "12px ui-monospace, monospace";
        x.fillStyle = "rgba(255,255,255,0.55)";
        x.fillText("Video is paused on this camera", LW / 2, LH / 2 + 20);
        x.textAlign = "start";
        return;
      }
      const { text, hour } = stamp(tz);
      const s = sceneFor(d, r);
      const daylight = hour >= 7 && hour < 18;
      const lit = lights || daylight;
      const ir = !lit;
      drawScene(x, s, t, ir, lit, !!d.state.motion);
      // sensor noise + scanlines
      const tiles = noise();
      x.globalAlpha = ir ? 0.14 : 0.07;
      x.drawImage(tiles[frame++ % tiles.length], 0, 0, LW, LH);
      x.globalAlpha = 1;
      x.fillStyle = "rgba(0,0,0,0.08)";
      for (let y = 0; y < LH; y += 3) x.fillRect(0, y, LW, 1);
      burnIn(x, d.name, text, t, !!d.state.recording, ir);
    };
    draw(performance.now());
    return subscribe(draw);
  }, [reduce]);

  return <canvas ref={canvas} width={hd ? 1280 : 480} height={hd ? 720 : 270} className={className} aria-label={`${device.name} camera feed${simulated ? " (simulated)" : ""}`} role="img" />;
});
