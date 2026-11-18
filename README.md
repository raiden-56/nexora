# NEXORA

**One Platform. Every Space. Complete Control.**

Nexora is a vendor-neutral, multi-tenant smart automation and device-management platform for homes, hotels and offices. This repository contains the **web application and its backend API** (Next.js App Router, TypeScript), a provider-based device integration layer, a server-side automation scheduler, and a fully interactive demo dataset built on clearly labelled simulated hardware.

**Live demo (browser-only build):** https://raiden-56.github.io/nexora/

---

## Quick start

Requirements: **Node.js 20+** (tested on Node 24) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and choose **Open the demo workspace**, or sign in with:

| Email | Password |
| --- | --- |
| `demo@nexora.app` | `NexoraDemo#2026` |

The demo user owns three organizations — switch between them from the organization menu at the top of the sidebar:

| Organization | Type | What to try |
| --- | --- | --- |
| Mehta Family | Residential | Overview, floor plan, scenes, the *Evening Comfort* routine, property modes |
| Aurelia Hotels | Hospitality | Hotel Operations: check-in → welcome mode, check-out → housekeeping |
| Helix Technologies | Commercial | Office Operations: meeting rooms, working-hour schedules, after-hours shutdown |

Demo data is created on first start in `.data/nexora.json`. Reset it with `npm run reset-demo` (server stopped) or from **Settings → Organization → Reset demo data**.

### Other commands

```bash
npm run typecheck   # TypeScript, no emit
npm test            # Vitest: scheduler/DST, conditions, permissions, command validation
npm run build       # production build
npm start           # serve the production build on :3000
```

### GitHub Pages demo build

GitHub Pages only serves static files, so the Pages site is a separate **browser-only** build of the same code:

```bash
npm run build:pages          # static export into ./out, served under /nexora
```

- The real route handlers and services from `src/app/api` and `src/server` are bundled into the page (`src/demo/backend.ts`) and `/api/*` calls are dispatched to them in the browser.
- Node-only modules are reached through small wrappers (`src/server/guard.ts`, `next-headers.ts`, `next-server.ts`, `node-fs.ts`, `node-path.ts`, `node-crypto.ts`) that `next.config.ts` swaps for the browser shims in `src/demo/shims` when `NEXORA_STATIC=1`.
- Data lives in the visitor's `localStorage`; each visitor has a private copy.
- **Automations only run while a Nexora tab is open**, and passwords use a demo-only hash. This is a preview, not a deployment.
- Detail pages use `/devices/_/?id=…` because a static export can only pre-render known paths.
- `.github/workflows/pages.yml` rebuilds the site on every push to `main` and publishes it to the `gh-pages` branch.

For the real app — server-side scheduler, shared data, real sessions — run it on a Node host or with Docker.

### Docker

```bash
docker compose up --build
```

`docker-compose.yml` also defines PostgreSQL and Redis under the `production` profile for the migration path described below; the current build does not need them.

---

## What works end to end

- **Accounts & tenancy** — registration, login (scrypt-hashed passwords, httpOnly session cookies, rate-limited), organization onboarding, organization switching. Every API call resolves a tenant context and filters by organization *and* property access.
- **Properties → buildings → floors → rooms → devices** — property creation wizard with layout templates and timezones; add/rename/delete/reorder floors and rooms; interactive floor plan with live device markers.
- **Device control** — capability-driven control panels (switch, plug, relay, bulb, RGB strip, fan, AC, thermostat, ventilation, curtain, blind, lock, sensors). Optimistic UI with rollback when the provider rejects a command. Server validates every command against the device's capabilities and value ranges.
- **Bulk control** — select devices, room "all on/off", floor shutdown, after-hours shutdown. Disruptive actions require confirmation; *essential* loads (locks, fridges, server room, emergency lighting) are never switched off in bulk.
- **Pairing wizard** — integration → discovery → location → name → connect & test. A device is saved only after the provider confirms two-way communication.
- **Automations** — visual WHEN → IF → THEN builder: time, sunrise/sunset (computed from property lat/long), device state, motion, door, temperature and manual triggers; day-of-week, occupancy, device, temperature and property-mode conditions; per-action conditions (e.g. *AC only if the room is occupied*); scenes, notifications and delays; optional end time; unreachable-device policy (retry-then-notify / skip / abort). Pause, resume, duplicate, run now, execution history with per-step results.
- **Scheduler that runs without a browser** — `src/server/automation/scheduler.ts` starts with the server process (`src/instrumentation.ts`), ticks every 15 s, evaluates triggers in each property's timezone, handles DST gaps/overlaps, and dedupes every occurrence by key so nothing runs twice.
- **Scenes** — 13 templates (Welcome Home … Energy Saving Mode) that pick matching devices, custom scene builder with ordered actions, one-tap activation with real per-device outcomes.
- **Hotel operations** — room status board, check-in (welcome lighting, curtains, AC set-point), check-out (non-essential loads off, housekeeping notified), housekeeping, maintenance, manual override.
- **Office operations** — meeting rooms, working-hour/weekend schedules, floor-wise control, after-hours shutdown preserving safety and security loads, department-level energy.
- **Energy analytics** — 24 h / 7 d / 30 d, comparison with the previous period, device/room/property breakdowns, cost and projection, saving opportunities, CSV export. Simulated devices have no meters, so all historical consumption is a **labelled demonstration profile** — the UI and CSV say so.
- **Users & permissions** — 7 roles, permission matrix, property-scoped access, invitations (auto-accepted on sign-up with the invited email), role changes and removal with privilege-escalation guards.
- **Notifications & activity logs** — notification centre (read/unread/dismiss), audit log with previous → new state, source and automation reference, search, filters and pagination.
- **Responsive UI** — desktop collapsible sidebar; tablet/phone bottom navigation + drawer; full-screen device panels and bottom-sheet dialogs on phones; dark and light themes; reduced-motion respected.

## Honest scope notes

This is the first, web-first release from a much larger specification. Not built yet:

| Area | Status |
| --- | --- |
| Mobile app (React Native / Expo) | **Not started.** The API is JSON over HTTP and ready to be consumed by it. |
| NestJS service, PostgreSQL, Redis/BullMQ | **Not wired.** Business logic lives in framework-agnostic services under `src/server/` (no React), persisted to a JSON file. `prisma/schema.prisma` is the target schema. |
| WebSockets / MQTT push | Live state uses 4-second polling of `/api/bootstrap`. |
| Real integrations | **Home Assistant** adapter is implemented against the official REST API (untested against a live instance here). Matter, Tuya, MQTT and Zigbee adapters implement the provider interface but always report "not available" — they never fake success. |
| Local gateway / offline execution | Designed for (provider interface + scheduler are runtime-agnostic) but no separate gateway process yet. |
| MFA | The per-user requirement flag is stored; TOTP enrollment/verification is not implemented. |
| Email/push delivery | Notifications are in-app only. |
| GSAP, shadcn/ui | Not used — Framer Motion and a small custom component kit cover the current UI. |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and the roadmap.

## Project layout

```
src/
  app/
    (app)/…            authenticated screens (overview, devices, rooms, automations, …)
    api/…              route handlers — thin: parse → requireCtx() → service
    login, register, onboarding
  components/          UI kit, shell, charts, device/automation/scene components
  hooks/useNexora.ts   live bootstrap snapshot + optimistic device commands
  lib/                 shared types, RBAC table, device catalog, formatting (client + server)
  server/
    auth.ts            sessions, tenant context, rate limiting
    db.ts, seed.ts     persistence layer and demo dataset
    providers/         DeviceProvider interface, simulator, Home Assistant, pending adapters
    automation/        time maths (pure), conditions (pure), executor, scheduler
    services/          devices, automations, scenes, structure, hotel, energy, members, integrations
prisma/schema.prisma   production PostgreSQL schema
tests/                 Vitest unit tests
```
