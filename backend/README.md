# Backend

REST + WebSocket API that collects PC metrics, stores them and runs fix scripts.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,powershell" alt="backend stack" />
</p>

## Stack

Node.js, Express 5, TypeScript (ESM), Prisma 7 + SQLite, zod (via `@pc-monitor/shared`), Vitest + Supertest, `tsx`. Planned: `systeminformation`, `ws`, Swagger UI.

## Structure

Feature-based (`app -> features -> core -> shared`):

```
src/
├── core/        env, Prisma client, errors, security + validation middleware, ws hub
└── features/    health, metrics, processes, actions, logs, config
                 each: *.routes.ts, *.controller.ts, *.service.ts, index.ts, tests
prisma/          schema + migrations
```

`src/app.ts` builds the Express app (everything under `/api`), `src/server.ts` starts it. `architecture.test.ts` fails if a feature imports another feature's internals. Request validation uses zod schemas from `@pc-monitor/shared` through the `validate()` middleware (`core/validation`); tests run against a throwaway SQLite database created with `prisma migrate deploy`.

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

API docs will be served at `http://127.0.0.1:4317/api/docs` *(planned)*.
