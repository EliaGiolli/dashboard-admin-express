# Backend

REST + WebSocket API that collects PC metrics, stores them and runs fix scripts.

<p>
  <img src="https://skillicons.dev/icons?i=ts,nodejs,express,prisma,sqlite,powershell" alt="backend stack" />
</p>

## Stack

Node.js, Express 5, TypeScript (ESM), Prisma 7 + SQLite, `systeminformation` *(planned)*, `ws` *(planned)*, Vitest + Supertest *(planned)*, zod + Swagger UI *(planned)*.

## Structure

Feature-based (`app -> features -> core -> shared`):

```
src/
├── core/        env, Prisma client, errors, security + validation middleware, ws hub
└── features/    health, metrics, processes, actions, logs, config
                 each: *.routes.ts, *.controller.ts, *.service.ts, index.ts, tests
prisma/          schema + migrations
```

> Currently the code is still in its original layout (`controllers/`, `services/`, `routes/`); phase B1 moves it into `core/` and `features/`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | watch mode *(being fixed in B1)* |
| `npm test` | Vitest *(planned)* |
| `npx prisma generate` | generate the Prisma client |
| `npx prisma migrate dev` | apply schema changes |

API docs will be served at `http://127.0.0.1:4317/api/docs` *(planned)*.
