"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { STATIC_DEMO } from "@/lib/routes";
import { Logo } from "../brand";

/** Isometric property illustration with live-looking device nodes. Purely decorative. */
function PropertyVisual() {
  const reduce = useReducedMotion();
  const nodes = [
    { x: 118, y: 132, c: "var(--mint)", d: 0 },
    { x: 210, y: 96, c: "var(--cyan)", d: 0.6 },
    { x: 288, y: 150, c: "#F2C46D", d: 1.2 },
    { x: 166, y: 214, c: "var(--mint)", d: 1.8 },
    { x: 262, y: 236, c: "var(--violet)", d: 0.9 },
    { x: 340, y: 204, c: "var(--cyan)", d: 2.1 },
  ];
  return (
    <svg viewBox="0 0 440 340" className="w-full max-w-[520px]" aria-hidden>
      <defs>
        <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface-3)" />
          <stop offset="1" stopColor="var(--surface)" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="var(--mint)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--mint)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="220" cy="270" rx="200" ry="50" fill="url(#glow)" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${-i * 62})`}>
          <path d="M60 250 L220 170 L380 250 L220 330 Z" fill="url(#fl)" stroke="var(--line-strong)" opacity={1 - i * 0.18} />
          <path d="M220 170 L220 330" stroke="var(--line)" />
          <path d="M140 210 L300 290" stroke="var(--line)" />
        </g>
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <line x1={n.x} y1={n.y} x2="220" y2="40" stroke={n.c} strokeOpacity="0.22" strokeDasharray="3 5">
            {!reduce && <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="2.4s" repeatCount="indefinite" />}
          </line>
          <circle cx={n.x} cy={n.y} r="10" fill={n.c} opacity="0.16">
            {!reduce && <animate attributeName="r" values="8;16;8" dur="3s" begin={`${n.d}s`} repeatCount="indefinite" />}
          </circle>
          <circle cx={n.x} cy={n.y} r="4.5" fill={n.c} />
        </g>
      ))}
      <g transform="translate(196 18)">
        <rect width="48" height="44" rx="12" fill="var(--surface-2)" stroke="var(--line-strong)" />
        <path d="M14 31V13l20 18V13" fill="none" stroke="var(--mint)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function AuthFrame({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: ReactNode }) {
  return (
    <div className="ambient relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <Logo className="relative" />
        <div className="relative flex flex-1 items-center justify-center py-8">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="w-full">
            <PropertyVisual />
          </motion.div>
        </div>
        <div className="relative max-w-md">
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }} className="text-display text-[34px]">
            One Platform.
            <br />
            Every Space. <span className="bg-[linear-gradient(90deg,var(--mint),var(--cyan))] bg-clip-text text-transparent">Complete Control.</span>
          </motion.h2>
          <p className="mt-4 text-[14px] text-muted">Homes, hotels and offices — every compatible switch, light, fan and climate system across every property, automated from one place.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11.5px] text-faint">
            {["Matter", "Home Assistant", "Tuya", "MQTT", "Zigbee"].map((p) => (
              <span key={p} className="rounded-full border border-line px-2.5 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[400px]">
            <h1 className="text-display text-[28px]">{title}</h1>
            <p className="mt-2 text-[14px] text-muted">{subtitle}</p>
            {STATIC_DEMO && (
              <p className="mt-5 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
                <span className="font-semibold text-text">Browser-only preview.</span> This GitHub Pages build runs the Nexora backend inside your browser: data is saved on this device only, and automations run only while a Nexora tab is open. All devices are simulated.
              </p>
            )}
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
        <p className="text-center text-[11.5px] text-faint">© {new Date().getFullYear()} Nexora · {STATIC_DEMO ? "Static demo · data stays in this browser" : "Secure sessions · Tenant-isolated data"}</p>
      </div>
    </div>
  );
}
