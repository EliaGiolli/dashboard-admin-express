# PC Monitor

Live PC performance charts and one-click fix scripts, all running locally on your Windows machine.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,react,vite,powershell,git,github" alt="tech stack" />
</p>

> **Status:** work in progress. The backend is being reworked first; the frontend starts once the backend is fully tested. Items marked *(planned)* don't exist yet.

## What it does

- **Monitor** *(planned)*: CPU (total, per core, temperature), RAM, disk usage and I/O, network throughput and a live process table, streamed over WebSocket every 2 seconds and stored in SQLite so history survives restarts.
- **Fix** *(planned)*: buttons that run PowerShell scripts: kill a process, clear temp files, flush the DNS cache, empty the Recycle Bin. Risky actions need confirmation, enforced by the server.
- **Log** *(planned)*: every action run and every threshold alert (for example CPU above its limit) is written to a searchable log.
- **Document**: every mounted endpoint is described in Swagger UI (`/api/docs`, spec at `/api/openapi.json`), generated from the same zod schemas used to validate requests; a test fails the build if a route is added without docs.

## Warning

This app runs local scripts that **modify your system**: it can terminate processes, delete the contents of your temp folders, flush the DNS cache and empty the Recycle Bin. Read the scripts under `backend/src/features/actions/scripts/` before running it. Some actions cannot be undone.

It is designed for your own machine only: the server binds to `127.0.0.1` and has no login. Do not expose it to a network.

## Architecture

npm workspaces monorepo, TypeScript strict everywhere, feature-based design in every package.

```
pc-monitor/
├── shared/     zod schemas + types shared by backend and frontend
├── backend/    Express 5 + Prisma/SQLite + WebSocket
└── frontend/   React + Vite dashboard (planned)
```

Dependency direction: `app -> features -> core -> shared`. A feature only talks to another feature through its `index.ts`.

**One source of truth for types.** Schemas are defined once in `shared/` with zod. The backend uses them to validate requests and to generate the OpenAPI document, so the Swagger docs cannot drift from the code. The frontend derives its types from the same schemas and validates incoming WebSocket messages with them.

**Data flow**

1. A ticker collects a snapshot every 2 seconds with `systeminformation`.
2. The snapshot is broadcast over WebSocket and saved to SQLite; exceeding a configured threshold also writes an alert to the logs.
3. The frontend loads recent history over REST, then appends live ticks.
4. A fix button calls `POST /api/actions/:id/run`. The server looks the id up in a fixed registry, runs the matching PowerShell script and records the result in the logs.

## Security model

There is no login, so the main threat is another website in your browser calling `localhost`. Defenses:

- server bound to `127.0.0.1` only, default port 4317
- strict CORS allow-list (only the frontend origin and the server's own origin, so Swagger UI's "Try it out" still works)
- requests that carry a body must be `Content-Type: application/json`, and a server-side `Origin` check independent of CORS rejects mismatched mutating requests with 403 — both close the "simple request" gap a plain HTML form could otherwise use
- `helmet` headers, Prisma-only database access, constant-time comparison for the (defense-in-depth) admin guard
- *(planned)* `Origin` check on the WebSocket upgrade too; scripts started with `spawn` and an argument array (never a shell string), action ids only ever used as registry keys, server-side `confirm: true` for risky actions, and refusal to kill system processes

Cloning this repo and running it only ever affects the machine it runs on.

## Getting started

Requirements: Node.js 22+, Windows with PowerShell.

```bash
git clone https://github.com/EliaGiolli/dashboard-admin-express.git
cd dashboard-admin-express
npm install
```

Copy `backend/.env.example` to `backend/.env` and set the values, then from `backend/` run `npx prisma generate` and `npx prisma migrate deploy` (creates the SQLite database).

```bash
npm run dev    # from the repo root: starts the backend
npm test       # builds shared, then runs the backend tests
``` See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for package details.
