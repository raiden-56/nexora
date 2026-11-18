"use client";
import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/format";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

/** Area / line chart with crosshair tooltip. */
export function AreaChart<T extends { label: string }>({ data, series, height = 220, format = (v) => v.toFixed(1), className }: { data: T[]; series: Series[]; height?: number; format?: (v: number) => string; className?: string }) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const pad = { l: 40, r: 8, t: 12, b: 26 };
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.flatMap((d) => series.map((s) => Number((d as Record<string, unknown>)[s.key]) || 0)), 0));
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = (k: string) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number((d as Record<string, unknown>)[k]) || 0).toFixed(1)}`).join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 64))));

  return (
    <div ref={ref} className={cx("relative w-full select-none", className)} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} className="overflow-visible" onMouseLeave={() => setHover(null)}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-[var(--faint)] text-[10.5px]">
                {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="num fill-[var(--faint)] text-[10.5px]">
                {d.label}
              </text>
            ) : null,
          )}
          {series.map((s, si) => (
            <g key={s.key}>
              {!s.dashed && <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }} d={`${path(s.key)}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${gid}-${s.key})`} />}
              <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: si * 0.1, ease: [0.16, 1, 0.3, 1] }} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2.2} strokeDasharray={s.dashed ? "4 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {data.map((_, i) => (
            <rect key={i} x={x(i) - iw / data.length / 2} y={pad.t} width={Math.max(4, iw / data.length)} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--line-strong)" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number((data[hover] as Record<string, unknown>)[s.key]) || 0)} r={4} fill="var(--surface)" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl border border-line-strong bg-surface px-3 py-2 shadow-xl" style={{ left: Math.min(Math.max(x(hover) - 72, 0), w - 150) }}>
          <div className="text-[11px] font-medium text-faint">{data[hover].label}</div>
          {series.map((s) => (
            <div key={s.key} className="mt-1 flex items-center justify-between gap-3 text-[12px]">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="num font-semibold">{format(Number((data[hover] as Record<string, unknown>)[s.key]) || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Vertical bar chart with optional comparison bar. */
export function BarChart<T extends { label: string }>({ data, valueKey, compareKey, color = "var(--mint)", height = 220, format = (v) => v.toFixed(1), valueLabel = "Current", compareLabel = "Previous" }: { data: T[]; valueKey: keyof T; compareKey?: keyof T; color?: string; height?: number; format?: (v: number) => string; valueLabel?: string; compareLabel?: string }) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 4, t: 12, b: 26 };
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => Math.max(Number(d[valueKey]) || 0, compareKey ? Number(d[compareKey]) || 0 : 0)), 0));
  const band = iw / Math.max(1, data.length);
  const bw = Math.min(28, band * (compareKey ? 0.34 : 0.56));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 48))));
  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t * max)} y2={y(t * max)} stroke="var(--line)" strokeDasharray={t ? "2 4" : undefined} />
              <text x={pad.l - 8} y={y(t * max)} dy="0.32em" textAnchor="end" className="num fill-[var(--faint)] text-[10.5px]">
                {t * max >= 1000 ? `${((t * max) / 1000).toFixed(1)}k` : Math.round(t * max)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx0 = pad.l + band * i + band / 2;
            const v = Number(d[valueKey]) || 0;
            const c = compareKey ? Number(d[compareKey]) || 0 : 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill={hover === i ? "var(--surface-2)" : "transparent"} rx={6} />
                {compareKey && <motion.rect initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ transformOrigin: "bottom", transformBox: "fill-box" }} transition={{ duration: 0.7, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }} y={y(c)} height={Math.max(0, y(0) - y(c))} x={cx0 - bw - 1} width={bw} rx={Math.min(4, bw / 2)} fill="var(--surface-3)" />}
                <motion.rect initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ transformOrigin: "bottom", transformBox: "fill-box" }} transition={{ duration: 0.7, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }} y={y(v)} height={Math.max(0, y(0) - y(v))} x={compareKey ? cx0 + 1 : cx0 - bw / 2} width={bw} rx={Math.min(4, bw / 2)} fill={color} />
                {i % every === 0 && (
                  <text x={cx0} y={height - 6} textAnchor="middle" className="num fill-[var(--faint)] text-[10.5px]">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl border border-line-strong bg-surface px-3 py-2 shadow-xl" style={{ left: Math.min(Math.max(pad.l + band * hover + band / 2 - 72, 0), w - 150) }}>
          <div className="text-[11px] font-medium text-faint">{data[hover].label}</div>
          <div className="mt-1 flex justify-between gap-3 text-[12px]">
            <span className="text-muted">{valueLabel}</span>
            <span className="num font-semibold">{format(Number(data[hover][valueKey]) || 0)}</span>
          </div>
          {compareKey && (
            <div className="flex justify-between gap-3 text-[12px]">
              <span className="text-muted">{compareLabel}</span>
              <span className="num font-semibold text-text-2">{format(Number(data[hover][compareKey]) || 0)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HBarList({ items, format, color = "var(--mint)" }: { items: { label: string; sub?: string; value: number; tag?: React.ReactNode }[]; format: (v: number) => string; color?: string }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={it.label + i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">
              <span className="font-medium text-text">{it.label}</span>
              {it.sub && <span className="ml-1.5 text-[12px] text-faint">{it.sub}</span>}
              {it.tag && <span className="ml-1.5">{it.tag}</span>}
            </span>
            <span className="num shrink-0 font-semibold text-text-2">{format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Ring({ value, max, size = 120, stroke = 10, color = "var(--mint)", children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
