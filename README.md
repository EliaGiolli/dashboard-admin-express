# Dev Dashboard REST API (Database Edition)
A REST API designed to simulate a developer/admin dashboard. This project has evolved from a simple Express server to a full-blown database-driven application using **Prisma** and **SQLite3**, making it perfect for learning how to build scalable backends with persistent data.

## Main Features
### 1. System Monitoring (Database Backed)
**Real-time & Historical Stats**: Monitor CPU, RAM, and uptime. Data is now persisted to track system health over time.

Endpoints:

`GET /system` – General system info

`GET /system/cpus` – CPU details

`GET /system/memory` – Total and free RAM

`GET /system/uptime` – Server uptime

### 2. Advanced Log Management
**Persistence**: Logs are stored in SQLite3 via Prisma, allowing for complex queries and reliable storage.

Levels: Simulate and filter log levels: info, warning, error.

Endpoints:

`GET /logs` – Fetch all logs from DB

`POST /logs` – Write a new log entry

`DELETE /logs` – Wipe logs (Admin only)

### 3. Cryptography and Hash Testing
**Security Tools**: Calculate and verify hashes using SHA256 and bcrypt.

Endpoints:

`POST /crypto/hash` – Hash a string

`POST /crypto/compare` – Compare text against a stored hash

### 4. Environment Variable Access
**Safe Exposure**: Filtered access to environment variables using a whitelist helper to prevent sensitive data leaks.

Endpoint:

`GET /env` – Returns non-sensitive environment variables

---

## Tech Stack Evolution
- **Prisma** – Next-generation ORM for Node.js and TypeScript.

- **SQLite3** – Lightweight, serverless SQL database engine.

- **Express** – Web framework for the API layer.

- **TypeScript** – Ensuring type safety across the entire stack.

- **bcrypt** – Secure password/string hashing.

---

## Project Structure
The project follows a clean, modular architecture:

```Bash
dashboard/
├── prisma/                # Prisma schema and migrations
├── src/
│   ├── controllers/       # Route handlers (System, Logs, Crypto, Env)
│   ├── generated/prisma/  # Auto-generated Prisma Client (Type-safe)
│   ├── helpers/           # Utility functions (Env whitelist, Parsers)
│   ├── lib/               # Database connection instances (prisma.ts)
│   ├── routes/            # Express route definitions
│   ├── services/          # Business logic & DB interactions
│   ├── types/             # Custom TypeScript interfaces/types
│   ├── server.ts          # App configuration
│   └── index.ts           # Entry point
├── dev.db                 # SQLite database file
├── .env                   # Environment variables (DATABASE_URL, etc.)
└── tsconfig.json
```
---

## Getting Started
### Clone and Install

```Bash
git clone https://github.com/EliaGiolli/dashboard-admin-express.git
npm install
```
### Database Setup
Ensure your .env file contains: `DATABASE_URL="file:./dev.db`"

```Bash
#Generate Prisma Client
npx prisma generate
```
```Bash
# Push schema to the local SQLite database
npx prisma db push
Run the server
```
```Bash
# Development (Hot-reload)
npm run dev
```
```Bash
# Production
npm run build
npm start
```

## Why this version?
By integrating Prisma, this project now demonstrates:

- Type-Safe Database Queries: No more guessing what the DB returns.

- Schema Migrations: Easy-to-manage database versioning.

- Relational Thinking: Even in a dashboard, managing data relationships is key.

## Security
- Whitelist Filtering: Only variables explicitly allowed in envWhiteList.ts are exposed via the API.

- Protected Actions: Destructive operations (DELETE) are gated behind admin logic.