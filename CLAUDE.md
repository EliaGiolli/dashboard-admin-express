# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status
The project extends the user's existing repo `EliaGiolli/dashboard-admin-express` (Express 5, TypeScript ESM, Prisma 7 + SQLite) into a monorepo: `shared/`, `backend/`, `frontend/`. `PLAN.md` holds the approved architecture and `TASKS.md` the atomic task list; both are gitignored local files. Read both at the start of a session, work on the first unchecked task, tick it when done. Update this file once the structure (Commands especially) is real.

## Workflow (one task at a time, one PR per phase)
A "phase" is a section of `TASKS.md` (S, B1..B10, F1..F5). Commits are per task; branches and PRs are per phase, so the repo isn't flooded with PRs.
1. Pick the first unchecked task. Backend tasks (`B-*`) come first; do not start any `F-*` task until `B-58` is done and the user has given the go-ahead.
2. At the start of a phase, create a branch off up-to-date `main`: `git switch -c <phase>-<short-slug>` (e.g. `b4-database`). Stay on it for every task in that phase.
3. Implement only the current task. Keep the change small.
4. Test: `npm test` and `npx tsc --noEmit` (add tests with the task; HTTP tests use Supertest). Endpoints are also verified in Swagger UI (`/api/docs`) once B9 exists.
5. Tick the task in `TASKS.md` (not committed, since it's gitignored).
6. Commit with a message starting with the task id, e.g. `B-21: add sample service`. Never use `--no-verify`.
7. Push the phase branch after each task or at least at phase end (`git push -u origin <branch>`).
8. When the last task of the phase is done and tests pass, open ONE PR against `main` with `gh pr create` (summary listing the tasks + test plan). Pushing and opening PRs are visible to others: confirm with the user the first time, then follow whatever standing permission they gave.
9. Report the PR link and wait for the merge (or the user's OK) before starting the next phase on a fresh branch from updated `main`. Never commit directly to `main`.

Backend gate: the backend is "done" only when tests pass, it runs locally with live WebSocket ticks, and every endpoint works from Swagger UI. Then stop and ask the user before starting the frontend.

## Commands (target; confirm they exist before relying on them)
- `npm install` at the root installs all workspaces
- `npm run dev` runs backend and frontend together; Vite proxies `/api` and `/ws` to the backend (`127.0.0.1:4317`)
- `npm test` (Vitest); single test: `npx vitest run <file> -t "<name>"` from `backend/`, `frontend/` or `shared/`
- `npx tsc --noEmit` for type checks
- Prisma (from `backend/`): `npx prisma generate`, `npx prisma migrate dev`; the generated client (`src/generated/prisma`) and `*.db` are gitignored
- Swagger UI at `http://127.0.0.1:4317/api/docs`, raw spec at `/api/openapi.json`

## Architecture
Local, single-user Windows app: live PC performance charts plus buttons that run fix scripts. TypeScript strict everywhere. Prisma + SQLite for storage.

**Feature-based design in every package.** Dependency direction: `app -> features -> core -> shared`. A feature never imports another feature's internals, only its `index.ts`. Tests live next to the code.
- `shared/` (`@pc-monitor/shared`): zod schemas + inferred types for metrics, processes, actions, logs, config and the WebSocket message union. **Rule: add or change a schema here first, then use it in backend and frontend.** The backend validates requests and generates OpenAPI from these schemas; the frontend derives types from them and parses WS messages with them.
- `backend/src/core/`: env config, Prisma client, `AppError` + global error handler, security middleware, validation middleware, WS hub, OpenAPI registry. `backend/src/features/{health,metrics,processes,actions,logs,config}`: each with `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `index.ts`. `backend/src/app.ts` builds the Express app (all routes under `/api`), `server.ts` listens and attaches `/ws`. Controllers only handle the happy path and forward errors with `next(new AppError(...))`.
- `frontend/src/{app,core,features/{metrics,processes,actions,logs}}`: each feature owns its `components/`, `hooks/`, `api.ts`.

Data flow:
1. `metrics/ticker.ts` runs every 2s: `snapshot.ts` collects CPU/RAM/disk/network/processes via `systeminformation`, broadcasts through the WS hub, persists a sample, and writes an alert `Log` when an `AppConfig` threshold (`CPU_THRESHOLD` etc.) is exceeded.
2. The frontend prefills charts from `GET /api/metrics/history`, then appends live WS ticks to a rolling buffer.
3. Fix actions are declarative: `features/actions/registry.ts` maps an action id to a PowerShell script in `features/actions/scripts/` plus label, risk level and `requiresConfirm`. `GET /api/actions` exposes metadata only; `POST /api/actions/:id/run` looks up the registry and `runner.ts` spawns the script. Every run is written to the `Log` table (`source`, `actionId`, `success`, `durationMs`), which is the audit trail.
4. Confirmation: flush DNS and clear temp run immediately; kill process and empty recycle bin need `{"confirm": true}` (server-enforced, 409 otherwise) and a confirm dialog in the UI.

## Security rules (localhost CSRF is the real threat: no login, any website tab can hit localhost)
- Bind the server to `127.0.0.1` only; never `0.0.0.0`
- Prisma queries only; no raw string-built SQL
- Scripts: `child_process.spawn` with an argv array, never `exec` or string-built commands; validate PIDs as integers and refuse system PIDs; request-supplied action ids are only registry lookup keys, never part of a file path
- CORS allow-list of the frontend origin only; mutating routes require `Content-Type: application/json` plus an Origin check; also check Origin on the WebSocket upgrade (CORS doesn't cover WS)
- The `x-api-key` admin guard (`crypto.timingSafeEqual`) is defense in depth only: a key in browser code isn't secret
- Never use `dangerouslySetInnerHTML`; use `helmet`
- No auth/sessions by design: each clone runs its own isolated instance against its own machine

## Conventions
- Read the `dataviz` skill before writing chart code
- `si.cpuTemperature()` is unreliable on Windows; return null and show "N/A" instead of erroring
- When testing, never confirm Empty Recycle Bin; only kill throwaway processes you started yourself
- README should warn that the app runs local system-modifying scripts
