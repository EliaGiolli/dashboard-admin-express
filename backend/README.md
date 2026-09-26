# Backend

REST API + Socket.IO channel that collects PC metrics, stores them and runs fix scripts.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,powershell" alt="backend stack" />
</p>

## Stack

Node.js, Express 5, TypeScript (ESM), Prisma 7 + SQLite, zod (via `@pc-monitor/shared`), `systeminformation`, Socket.IO, Swagger UI (`@asteasolutions/zod-to-openapi` + `swagger-ui-express`), Vitest + Supertest, `tsx`.

## Structure

Feature-based (`app -> features -> core -> shared`):

```
src/
├── core/        env, Prisma client, errors, security + validation middleware, Socket.IO hub (ws/)
└── features/    health, metrics, processes, actions, logs, config
                 each: *.routes.ts, *.controller.ts, *.service.ts, index.ts, tests
prisma/          schema + migrations
```

`src/app.ts` builds the Express app (everything under `/api`), `src/server.ts` starts it. `src/routeMounts.ts` is the single list of `{prefix, router}` pairs: `app.ts` mounts the API from it, and `openapi-coverage.test.ts` walks the same list to fail the build if a mounted route isn't documented in the OpenAPI spec. `architecture.test.ts` fails if a feature imports another feature's internals. Request validation uses zod schemas from `@pc-monitor/shared` through the `validate()` middleware (`core/validation`); tests run against a throwaway SQLite database created with `prisma migrate deploy`.

Each feature that exposes routes also has a `*.docs.ts` registering its paths on the shared OpenAPI registry (`core/openapi`), built from the same `@pc-monitor/shared` zod schemas used for validation — so the Swagger docs can't drift from the code.

## Why feature-based instead of MVC

The original project was layered MVC: top-level `controllers/`, `services/`, `routes/`, `types/`. We reorganized it by feature (`features/logs`, `features/metrics`, ...) for these reasons:

- **Cohesion:** everything about one capability (route, controller, service, types, tests) lives in one folder. Adding or changing "logs" touches one place instead of four folders.
- **Maintainability:** a feature can be understood, tested, changed or deleted on its own. Removing crypto was a matter of deleting files, not hunting through every layer.
- **Scalability:** in MVC every layer folder keeps growing with the whole app. Here each feature grows independently, and new features are added without touching existing ones.
- **Explicit boundaries:** a feature exposes only its `index.ts`, and `architecture.test.ts` fails the build if another feature reaches into its internals. MVC folders don't enforce any boundary between unrelated code.
- **Familiar shape:** it mirrors how modern frameworks structure apps: NestJS groups code into per-feature modules, and package-by-feature is a common convention in Spring Boot projects.
- **Shared types end to end:** feature folders map cleanly onto the `shared/` schemas and the frontend `features/`, so backend and frontend stay aligned.

Trade-off: a very small app doesn't need this much structure, and MVC is simpler to start with. Here the app has several distinct capabilities (metrics, actions, logs, config) and a frontend that mirrors them, so the extra structure pays off.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | start with `tsx watch` |
| `npm test` | Vitest + Supertest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm start` | compile to `dist/` and run it |
| `npx prisma generate` | generate the Prisma client |
| `npx prisma migrate deploy` | create/update the database from the migrations |
| `npx prisma migrate dev` | create a new migration after a schema change |
| `npx prisma db seed` | insert the default thresholds (also done at startup) |

Swagger UI is served at `/api/docs` (raw spec at `/api/openapi.json`); the app listens on `127.0.0.1` only (`PORT` env, default 4317).

## Metrics

`features/metrics/snapshot.ts` reads CPU (total, per core, temperature), RAM, disk usage per drive plus read/write throughput, and network rx/tx of the default interface, all in parallel through `systeminformation`. Windows quirks handled there:

- **CPU temperature** is usually not readable: the first empty reading turns the sensor off for the rest of the run and the value stays `null` (never an error).
- **Disk throughput** isn't available from `systeminformation` on Windows, and perf counter names are localized, so `diskIo.ts` keeps one PowerShell process reading the raw WMI counters (`Win32_PerfRawData_PerfDisk_PhysicalDisk`) every 2s and computes the rate from the deltas. It exits on its own when the server stops.
- Rates are `null` until there is a previous reading to compare against.

## Live channel

`server.ts` attaches a Socket.IO server on `/ws` (`core/ws/hub.ts`) and starts `features/metrics/ticker.ts`:

- **Ticker:** every 2s it collects a snapshot, emits `snapshot`, runs the alert check, then stores a `Sample`. Cycles never overlap: the next one is scheduled 2s after the previous *started*, or immediately if it took longer. A failing stage is logged and the loop continues; shutdown (Ctrl+C) waits for the in-flight cycle.
- **Alerts** (`alerts.ts`): thresholds are re-read from `AppConfig` every cycle. A metric (CPU %, RAM %, fullest drive %) must be above its threshold 3 cycles in a row; it then writes a `monitor` warning log and emits `alert` with the log id. One alert per breach, 5 min cooldown per metric.
- **Security:** WebSocket transport only, handshake refused for a foreign `Origin` (same rule as HTTP, `core/security/origin.ts`), clients can't send events.

```js
const socket = io('http://127.0.0.1:4317', { path: '/ws', transports: ['websocket'] });
socket.on('snapshot', (s) => {}); // typed via ServerToClientEvents from @pc-monitor/shared
```

REST: `GET /api/metrics/history?minutes=1..360` (chart prefill, oldest first), `POST /api/metrics/record` (one sample now), `GET /api/config`, `PATCH /api/config/:key` (thresholds are 0-100).

`features/processes` serves `GET /api/processes?sortBy=cpu|mem&limit=` (top N, System Idle Process excluded).

## Fix actions

`features/actions/registry.ts` is the only list of things the server can execute: id -> script file in `scripts/`, label, risk, `requiresConfirm`, and how the (validated) request becomes argv. `actions.service.ts` runs one end to end: registry lookup (404), argument checks (400, or 403 for a protected PID), confirmation (409 without `{"confirm": true}` for `empty-recyclebin` and `kill-process`), one run at a time per action, then `runner.ts`, then an audit `Log` (`source: "action"`, `actionId`, `success`, `durationMs`).

`runner.ts` spawns `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <script> ...args` with an argv array (no shell), a 60s timeout that kills the process tree, capped output, and never throws. Scripts print a one-line summary and exit non-zero on failure.

| Action | Script behavior | Confirm |
| --- | --- | --- |
| `flush-dns` | `Clear-DnsClientCache` | no |
| `clear-temp` | deletes items older than 24h in `%TEMP%`; skips locked files, never follows junctions/symlinks; reports MB freed | no |
| `empty-recyclebin` | `Clear-RecycleBin` on all drives | yes |
| `kill-process` | `Stop-Process -Force` on `-ProcessId`; refuses critical Windows processes | yes |

Routes: `GET /api/actions` (metadata only), `POST /api/actions/:id/run`, `POST /api/processes/:pid/kill`. Past runs: `GET /api/logs?source=action`. `npm run build` copies `scripts/` into `dist/`.

Tests run the real scripts only where it is harmless: flush-dns for real, clear-temp on sandbox folders, kill-process on a throwaway process the test starts, empty-recyclebin only with a test-only `-DryRun`.

## Logs

`GET /api/logs` filters by `level`, `source` (`manual`/`monitor`/`action`), `actionId`, `archived`, `from`/`to`, and pages with `limit` (1-100, default 50) and an opaque keyset `cursor` (`nextCursor` of the previous page), so pages don't shift when new logs arrive. Response: `{ items, nextCursor }`.

## Database

Three tables (`prisma/schema.prisma`): `Sample` (one metrics sample: CPU %, nullable CPU temperature, RAM used/total, disk read/write and network rx/tx in bytes per second), `Log` (manual entries, threshold alerts and fix-action runs, told apart by `source`; action runs also store `actionId`, `success`, `durationMs` as the audit trail) and `AppConfig` (key/value settings).

On startup the server seeds the `CPU_THRESHOLD`, `RAM_THRESHOLD` and `DISK_THRESHOLD` rows (90% by default; existing values are never overwritten) and deletes samples and logs older than `RETENTION_DAYS` (env, default 7).

## Security

`app.ts` applies, in order: `helmet()`, a CORS allow-list, `originGuard`, `requireJsonContentType`, then `express.json()`.

- **CORS + Origin check** (`core/security/cors.ts`, `originGuard.ts`): both consult `ALLOWED_ORIGINS` (`core/config/env.ts`) — the frontend's origin (`FRONTEND_ORIGIN` env, default `http://localhost:5173`) plus the server's own origin, so Swagger UI's "Try it out" (same-origin) still works. CORS controls whether a browser can *read* a cross-origin response; `originGuard` is an independent server-side check that rejects a mismatched `Origin` on `POST`/`PUT`/`PATCH`/`DELETE` with 403, regardless of what the browser would have allowed.
- **`requireJsonContentType`**: any request carrying a body must be `application/json` (415 otherwise). Together with the Origin check this closes the CORS "simple request" gap — a plain HTML form can only submit `application/x-www-form-urlencoded`/`multipart/form-data`/`text/plain` and skip preflight, so requiring JSON forces even same-site form-based attempts through a real preflight.
- **`adminGuard`** (`core/security/authGuard.ts`): compares the `x-api-key` header against `API_SEGRETO` with `crypto.timingSafeEqual`. Guards `PATCH` and `DELETE /api/logs/:id` (403 otherwise; use **Authorize** in Swagger UI). A key shipped to a browser isn't a real secret, so this is defense in depth only; the binding to `127.0.0.1` plus the two checks above are the actual protection.
