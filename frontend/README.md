# Frontend

Live dashboard for PC metrics, processes, fix actions and logs. *(planned: starts after the backend is verified)*

<p>
  <img src="https://skillicons.dev/icons?i=ts,react,vite,css" alt="frontend stack" />
</p>

## Stack

React, Vite, TypeScript (strict), Recharts, Vitest + Testing Library. Types and validation come from `@pc-monitor/shared`.

## Structure

```
src/
├── app/         entry, providers, layout shell
├── core/        typed API client, WebSocket client, theme
└── features/    metrics, processes, actions, logs
                 each: components/, hooks/, api.ts, tests
```

## Scripts

Added when the package is created (`npm run dev`, `npm test`).
