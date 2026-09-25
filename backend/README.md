# Backend

REST + WebSocket API that collects PC metrics, stores them and runs fix scripts.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,powershell" alt="backend stack" />
</p>

## Stack

Node.js, Express 5, TypeScript (ESM), Prisma 7 + SQLite, zod (via `@pc-monitor/shared`), Swagger UI (`@asteasolutions/zod-to-openapi` + `swagger-ui-express`), Vitest + Supertest, `tsx`. Planned: `systeminformation`, `ws`.

## Structure

Feature-based (`app -> features -> core -> shared`):

```
src/
├── core/        env, Prisma client, errors, security + validation middleware, ws hub
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

Swagger UI is served at `/api/docs` (raw spec at `/api/openapi.json`); the app listens on `127.0.0.1` only (`PORT` env, default 4317).

## Security

`app.ts` applies, in order: `helmet()`, a CORS allow-list, `originGuard`, `requireJsonContentType`, then `express.json()`.

- **CORS + Origin check** (`core/security/cors.ts`, `originGuard.ts`): both consult `ALLOWED_ORIGINS` (`core/config/env.ts`) — the frontend's origin (`FRONTEND_ORIGIN` env, default `http://localhost:5173`) plus the server's own origin, so Swagger UI's "Try it out" (same-origin) still works. CORS controls whether a browser can *read* a cross-origin response; `originGuard` is an independent server-side check that rejects a mismatched `Origin` on `POST`/`PUT`/`PATCH`/`DELETE` with 403, regardless of what the browser would have allowed.
- **`requireJsonContentType`**: any request carrying a body must be `application/json` (415 otherwise). Together with the Origin check this closes the CORS "simple request" gap — a plain HTML form can only submit `application/x-www-form-urlencoded`/`multipart/form-data`/`text/plain` and skip preflight, so requiring JSON forces even same-site form-based attempts through a real preflight.
- **`adminGuard`** (`core/security/authGuard.ts`): compares the `x-api-key` header against `API_SEGRETO` with `crypto.timingSafeEqual`. Not wired to any route yet — a key shipped to a browser isn't a real secret, so this is defense in depth only; the binding to `127.0.0.1` plus the two checks above are the actual protection.
