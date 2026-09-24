# Backend

REST + WebSocket API that collects PC metrics, stores them and runs fix scripts.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,powershell" alt="backend stack" />
</p>

## Stack

Node.js, Express 5, TypeScript (ESM), Prisma 7 + SQLite, Vitest + Supertest, `tsx`. Planned: `systeminformation`, `ws`, zod + Swagger UI.

## Structure

Feature-based (`app -> features -> core -> shared`):

```
src/
├── core/        env, Prisma client, errors, security + validation middleware, ws hub
└── features/    health, metrics, processes, actions, logs, config
                 each: *.routes.ts, *.controller.ts, *.service.ts, index.ts, tests
prisma/          schema + migrations
```

`src/app.ts` builds the Express app (everything under `/api`), `src/server.ts` starts it. `architecture.test.ts` fails if a feature imports another feature's internals.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | start with `tsx watch` |
| `npm test` | Vitest + Supertest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm start` | compile to `dist/` and run it |
| `npx prisma generate` | generate the Prisma client |
| `npx prisma migrate dev` | apply schema changes |

API docs will be served at `http://127.0.0.1:4317/api/docs` *(planned)*.
