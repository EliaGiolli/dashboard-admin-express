# Dev Dashboard REST API (Database Edition) 🚀
A REST API designed to simulate a developer/admin dashboard. This project has evolved from a simple **Express** server to a full-blown database-driven application using **Prisma** and **SQLite3**, making it perfect for learning how to build scalable backends with persistent data.

## 🌟 Main Features
### 1. System Monitoring (Historical Data)
**Persistence**: Snapshotting CPU, RAM, and uptime into SQLite to track system health trends via Prisma.

- `GET /system` – Fetch historical performance stats.

- `POST /system/record` – Force an immediate system snapshot.

- `PATCH /system/settings` – Update monitoring thresholds.

### 2. Advanced Log Management
**Persistent Storage**: Logs are stored with metadata, allowing for archiving and level-based filtering (info, warning, error).

- `GET /logs` – Fetch all logs from DB.

- `POST /logs` – Write a new log entry.

- `PATCH /logs/:id` – Update log status (e.g., archived: true).

- `DELETE /logs/:id` – Permanent removal of a log entry.

### 3. Cryptography and Hash Testing
**Security Suite**: Built-in CryptoService for hashing and verifying strings using bcrypt.

- `POST /crypto/hash` – Generate a secure hash.

- `POST /crypto/compare` – Validate plain text against a hash.

### 4. Hybrid Environment Management
**Safe Exposure**: Combines static .env variables (via whitelist) with dynamic configurations stored in the database.

- `GET /env` – Returns safe env variables and DB configs (like THEME_COLOR).

- `PATCH /env/:key` – Update dynamic settings in the database.

---

## 🛡️ Global Error Handling (The "NestJS" Way)
In this version, I moved away from manual `res.status().json()` calls inside controllers. I implemented a Centralized Error Layer, which is the standard approach in enterprise frameworks like NestJS.

### Why this approach?
- **Consistency**: Every error response follows the same schema.

- **Clean Controllers**: Controllers only focus on the "Happy Path". If something goes wrong, they just "throw" the error forward.

- **Future Proof**: This mirrors NestJS Exception Filters, making the transition to that framework much smoother.

### How it works (Code Reference)
**The Custom Class (appError.ts)**: Extends the native `Error` class to include a statusCode.

```TypeScript
export class AppError extends Error {
    constructor(public message: string, public statusCode: number) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
    }
}
```

**The Middleware (errorHandler.ts)**: A global "catcher" registered at the end of the pipeline.

```TypeScript
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
```
Usage in Controller:

```TypeScript
// If something fails, we just call next()
catch (error) {
    next(new AppError('Database connection failed', 500));
}
```
---

## 🏗️ Project Structure
```bash
dashboard/
├── prisma/               # Database Schema (SQLite)
├── src/
│   ├── controllers/      # Lean Route Handlers (Request/Response logic)
│   ├── generated/prisma/ # Type-safe DB Client
│   ├── helpers/          # AppError class, Env Whitelist, Parsers
│   ├── lib/              # Prisma Client Singleton
│   ├── middlewares/      # AuthGuard & Global Error Handler
│   ├── routes/           # Express Route definitions
│   ├── services/         # Business Logic (DB interactions, OS logic)
│   ├── types/            # TS Interfaces
│   └── server.ts         # App configuration & Middleware registration
```
---

## 🚀 Getting Started
### 1. Installation
```bash
git clone https://github.com/EliaGiolli/dashboard-admin-express.git
npm install
```

### 2. Database Setup
Ensure your .env contains: `DATABASE_URL="file:./dev.db" and API_SEGRETO="your_secret"`.

```bash
npx prisma generate  # Sync TypeScript types
npx prisma db push   # Sync SQLite database
```

### 3. Run
```bash
npm run dev # Hot-reload enabled
```
---

## 🔐 Security
- **Whitelist Filtering**: Only variables in envWhiteList.ts are exposed.

- **Admin Guard**: Sensitive routes (Crypto, Delete, Patch) require an x-api-key header matching your API_SEGRETO.

- **Bcrypt**: Industrial-standard hashing for all cryptographic operations.

---

Developed with a "NestJS-ready" mindset.