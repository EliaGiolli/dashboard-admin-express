# PC Monitor

Live PC performance charts and one-click fix scripts, all running locally on your Windows machine.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,react,vite,powershell,git,github" alt="tech stack" />
</p>

> **Status:** work in progress. The backend is being reworked first; the frontend starts once the backend is fully tested. Items marked *(planned)* don't exist yet.

## What it does

- **Monitor**: CPU (total, per core, temperature), RAM, disk usage and I/O, network throughput and a top-processes list (`GET /api/processes`); pushed live over Socket.IO (`/ws`) every 2 seconds and stored in SQLite, so the charts can be prefilled from `GET /api/metrics/history` and history survives restarts.
- **Fix**: PowerShell scripts run from the API: flush the DNS cache, clear temp files older than 24h, empty the Recycle Bin, kill a process. Emptying the Recycle Bin and killing a process need `{"confirm": true}`, enforced by the server (409 otherwise). *(planned)* dashboard buttons with a confirm dialog.
- **Log**: every action run (with success and duration) and every threshold alert is written to the log, which can be filtered (level, source, action, archived, date range) and paged; archiving and deleting entries needs the admin key.
- **Document**: every mounted endpoint is described in Swagger UI (`/api/docs`, spec at `/api/openapi.json`), generated from the same zod schemas used to validate requests; a test fails the build if a route is added without docs.

## Warning

This app runs local scripts that **modify your system**: it can terminate processes, delete the contents of your temp folders, flush the DNS cache and empty the Recycle Bin. Read the scripts under `backend/src/features/actions/scripts/` before running it. Some actions cannot be undone.

It is designed for your own machine only: the server binds to `127.0.0.1` and has no login. Do not expose it to a network.

## Architecture

npm workspaces monorepo, TypeScript strict everywhere, feature-based design in every package.

```
pc-monitor/
├── shared/     zod schemas + types shared by backend and frontend
├── backend/    Express 5 + Prisma/SQLite + Socket.IO
└── frontend/   React + Vite dashboard (planned)
```

Dependency direction: `app -> features -> core -> shared`. A feature only talks to another feature through its `index.ts`.

**One source of truth for types.** Schemas are defined once in `shared/` with zod. The backend uses them to validate requests and to generate the OpenAPI document, so the Swagger docs cannot drift from the code. The frontend derives its types from the same schemas and validates incoming Socket.IO events with them.

**Data flow**

1. A ticker collects a snapshot every 2 seconds with `systeminformation`.
2. The snapshot is broadcast over Socket.IO (`/ws`, event `snapshot`) and saved to SQLite. A threshold from `/api/config` exceeded for 3 cycles in a row writes a warning to the logs and sends an `alert` event (once per breach, at most every 5 minutes per metric).
3. The frontend loads recent history over REST, then appends live ticks.
4. A fix button calls `POST /api/actions/:id/run`. The server looks the id up in a fixed registry, runs the matching PowerShell script and records the result in the logs.

## Security model

There is no login, so the main threat is another website in your browser calling `localhost`. Defenses:

- server bound to `127.0.0.1` only, default port 4317
- strict CORS allow-list (only the frontend origin and the server's own origin, so Swagger UI's "Try it out" still works)
- requests that carry a body must be `Content-Type: application/json`, and a server-side `Origin` check independent of CORS rejects mismatched mutating requests with 403 — both close the "simple request" gap a plain HTML form could otherwise use
- `helmet` headers, Prisma-only database access, constant-time comparison for the (defense-in-depth) admin guard
- `Origin` check on the Socket.IO handshake too (CORS doesn't cover WebSockets), WebSocket transport only (no long-polling endpoints)
- Scripts started with `spawn` and an argument array in PowerShell `-File` mode (never a shell string), with a timeout that kills the whole process tree; action ids are only registry keys, never part of a path
- Server-side `confirm: true` for destructive actions; PIDs 0 and 4, the server itself and its parent are refused, and the kill script also refuses critical Windows processes (csrss, lsass, ...)
- `clear-temp` only deletes items older than 24h in your user temp folder and never follows junctions or symlinks

Cloning this repo and running it only ever affects the machine it runs on.

## Getting started

Requirements: Node.js 22+, Windows with PowerShell.

```bash
git clone https://github.com/EliaGiolli/dashboard-admin-express.git
cd dashboard-admin-express
npm install
```

Copy `backend/.env.example` to `backend/.env` and set the values, then from `backend/` run `npx prisma generate` and `npx prisma migrate deploy` (creates the SQLite database). Default alert thresholds are seeded when the server starts; samples and logs older than `RETENTION_DAYS` (default 7) are pruned at startup.

```bash
npm run dev    # from the repo root: starts the backend
npm test       # builds shared, then runs the backend tests
``` See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for package details.
