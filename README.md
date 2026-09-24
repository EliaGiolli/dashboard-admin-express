# PC Monitor

A local Windows app that shows live PC performance charts (CPU, RAM, disk, network, processes) and offers buttons that run fix scripts (kill a process, clear temp files, flush DNS, empty the recycle bin).

Built on top of an earlier Express + Prisma admin dashboard API, restructured as a TypeScript monorepo with a feature-based design:

- `backend/`: Express 5, Prisma + SQLite, WebSocket live stats, PowerShell fix actions, Swagger docs
- `frontend/`: React + Vite dashboard (planned)
- `shared/`: zod schemas and types shared by both (planned)

> **Status:** work in progress. The backend is being reworked first; the frontend starts once the backend is fully tested.

## Warning

This app runs local scripts that **modify your system**: it can terminate processes, delete the contents of your temp folders, flush the DNS cache and empty the Recycle Bin. Read the scripts under `backend/src/**/scripts/` before running it. Risky actions ask for confirmation, but they cannot be undone.

It is designed to run on your own machine only: the server binds to `127.0.0.1` and has no login. Do not expose it to a network.

## Getting started

Requirements: Node.js 22+ and Windows (PowerShell).

```bash
git clone https://github.com/EliaGiolli/dashboard-admin-express.git
cd dashboard-admin-express
npm install
```

Create `backend/.env`:

```
DATABASE_URL="file:./dev.db"
API_SEGRETO="your_secret"
```

Then, from `backend/`:

```bash
npx prisma generate
npx prisma db push
```

```bash
npm run dev
```

The dev, build and test scripts are being rebuilt in phase B1, so they may not work yet.
