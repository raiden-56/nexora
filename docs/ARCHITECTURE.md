# Nexora architecture

## Layers

```
Browser (Next.js client components)
   │  JSON over HTTPS, session cookie
   ▼
Route handlers  src/app/api/**/route.ts       parse + validate (Zod) → requireCtx(permission) → service
   │
Services        src/server/services/*.ts      business rules, tenant checks, audit logging
   │
Automation      src/server/automation/*       scheduler (tick), executor, pure time + condition logic
   │
Providers       src/server/providers/*        DeviceProvider: discover / sendCommand / testConnection
   │
Persistence     src/server/db.ts              JSON file today → Prisma/PostgreSQL (prisma/schema.prisma)
```

No business logic lives in React components: the client renders data and sends intents.
`src/lib/` holds only shared, side-effect-free code (types, the RBAC table, the device catalog).

## Tenant isolation

`requireCtx()` (src/server/auth.ts) resolves the session → active organization membership →
role permissions → property grants. Every service receives that `Ctx` and:

- filters by `orgId` on every read,
- calls `ctx.assertProperty()` before touching property-scoped data,
- verifies that every referenced device, room and scene in an automation/scene belongs to the same organization **and** property.

Owners can't be demoted below the last owner; nobody can assign a role above their own; property-scoped admins can only grant their own properties.

## Device abstraction

All control flows through `executeDeviceCommand()` (src/server/services/devices.ts):

1. Validate the command against the device's declared capabilities and value ranges.
2. Dispatch through the device's provider adapter, with retries for transient failures.
3. Persist state **only** from the provider's confirmed result; mark devices offline when the provider says so.
4. Write state history and the audit log; emit `device.changed` for event-driven automations.

Adding a manufacturer = implementing `DeviceProvider` and registering it in `providers/registry.ts`.

## Scheduling

- Triggers are stored in local wall-clock time; each property has an IANA timezone.
- `dueOccurrences(from, to]` walks real minutes and converts them to local time, so a time skipped by a DST spring-forward fires right after the gap and a time repeated by a fall-back overlap shares one dedupe key.
- Each occurrence has a `dedupeKey` (`automationId:phase:YYYY-MM-DDTHH:MM`); the executor refuses keys it has already recorded and holds an in-flight set to stop concurrent duplicates.
- Missed runs are caught up for at most 5 minutes after downtime — an 18:30 routine never fires at 23:00.
- End times switch off what the routine switched on, skipping essential loads.

**Production path:** replace the interval with BullMQ repeatable jobs on Redis (jobId = dedupeKey for exactly-once enqueueing), keep `runAutomation()` unchanged inside workers, and persist executions with a unique index on `dedupeKey` (already in the Prisma schema).

## Local gateway (planned)

The gateway runs the same provider adapters and executor against a local SQLite replica, executes safety-critical and offline-capable automations without internet, and syncs executions/state back to the cloud when connectivity returns. Matter commissioning, MQTT and Zigbee2MQTT transports live there.

## Security checklist

| Control | Status |
| --- | --- |
| Password hashing (scrypt), timing-safe compare | ✅ |
| httpOnly / SameSite=Lax / Secure-in-prod session cookies, hashed session ids | ✅ |
| Login, registration, command and scene rate limits | ✅ (in-memory; Redis in production) |
| Tenant + property scoping on every endpoint | ✅ |
| Zod validation of every request body; device command capability checks | ✅ |
| Integration secrets never serialised to the browser | ✅ (`toPublic()`); encryption at rest planned with KMS |
| Audit log for device, automation, membership and integration changes | ✅ |
| Essential/safety loads protected from bulk, checkout, after-hours and end-of-schedule actions | ✅ |
| Unlock confirmations for physical locks | ✅ |
| Security headers (nosniff, frame DENY, referrer policy) | ✅ |
| MFA (TOTP), CSRF tokens for non-browser clients, WebSocket/MQTT auth | ⏳ |

## Roadmap (from the product brief)

| Phase | Done here | Next |
| --- | --- | --- |
| 1 Foundation | Design tokens, auth, multi-tenancy, navigation | Prisma migration, NestJS extraction |
| 2 Core dashboard | Properties, floors, rooms, devices, control panels | WebSocket push |
| 3 Automation | Builder, scheduler, scenes, history | BullMQ workers |
| 4 Business modules | Hotel, office, staff permissions | Custom roles UI, holiday calendars |
| 5 Analytics & integrations | Energy (demo profile), HA adapter | Live HA validation, Matter via gateway, Tuya signing, MQTT |
| 6 Polish | Responsive layouts, reduced motion, dark/light | Accessibility audit, perf budget, Expo app |
