# Dev Dashboard REST API

A REST API designed to simulate a developer/admin dashboard—perfect for DevOps, admins, or anyone who wants to learn how to monitor system health, manage logs, test cryptography, and use backend testing tools with Node.js/Express.

---

## Main Features

### 1. System Monitoring

- **CPU, RAM, uptime:** See the status of the machine running the server.
- **Endpoints:**  
  - `GET /system` – General system info  
  - `GET /system/cpus` – CPU details  
  - `GET /system/memory` – Total and free RAM  
  - `GET /system/uptime` – Server uptime

### 2. Log Management

- **Read and delete logs:**  
  - Read the latest events from `.log` files
  - Delete logs (admin only)
  - Simulate log levels: info, warning, error
- **Endpoints:**  
  - `GET /logs` – Read logs  
  - `POST /logs` – Write a new log event  
  - `DELETE /logs` – Delete logs (admin only)
  - `GET /:id` – Get log by ID (if implemented)

### 3. Cryptography and Hash Testing

- **Hashing and comparison:**  
  - Calculate hashes (SHA256, bcrypt) for a string
  - Compare hashes
- **Endpoints:**  
  - `POST /crypto/hash` – Receives a string and returns its hash  
  - `POST /crypto/compare` – Compare a string to a hash

### 4. Environment Variable Access

- **View safe environment variables:**  
  - Only a safe subset, never secrets
  - Simulate different environments (dev/prod)
- **Endpoint:**  
  - `GET /env` – Returns safe environment variables

---

## Tech Stack

This project uses a simple, modern Node.js stack:

- **[Node.js](https://nodejs.org/)** – JavaScript runtime for the backend.
- **[Express](https://expressjs.com/)** – Minimal and flexible web framework for building REST APIs.
- **[TypeScript](https://www.typescriptlang.org/)** – Strongly typed language that builds on JavaScript, for safer and clearer code.
- **[ts-node-dev](https://github.com/wclr/ts-node-dev)** – Runs TypeScript code directly with automatic restarts on file changes (hot-reloading) for development.
- **[dotenv](https://github.com/motdotla/dotenv)** – Loads environment variables from a `.env` file into `process.env`.
- **[bcrypt](https://www.npmjs.com/package/bcrypt)** – For hashing and comparing passwords.
- **[zod](https://www.npmjs.com/package/zod)** – TypeScript-first schema validation with static type inference.
- **[@types/express](https://www.npmjs.com/package/@types/express)** and **[@types/node](https://www.npmjs.com/package/@types/node)** – TypeScript type definitions for Express and Node.js, for better IntelliSense and type safety.

All dependencies are listed in `package.json`.

## Project Structure
```bash
dashboard/
│
├── src/
│   ├── index.ts # Express entry point
│   ├── server.ts # Express app setup
│   ├── routes/ # All Express routes
│   ├── controllers/ # Route logic
│   ├── services/ # Core logic (RAM, uptime, logs, etc.)
│   ├── utils/ # General utilities
│   ├── types/ # Centralized TypeScript types
│
├── data/ # .json or .log files
│
├── .env # Environment variables
├── tsconfig.json
└── package.json
```


## Getting Started

1. **Clone the project**
   ```bash
   git clone https://github.com/EliaGiolli/dashboard-admin-express.git
   cd dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Create a `.env` file (you can copy from `.env.example` if available)
   - Only add safe variables—never secrets!

4. **Run the server in development mode**
   ```bash
   npx ts-node-dev src/index.ts
   ```
   This uses [ts-node-dev](https://github.com/wclr/ts-node-dev) for hot-reloading with TypeScript.

   Or, if you want to build and run the compiled code:

   ```bash
   npm run build
   npm start
   ```
   - `npm run build` compiles TypeScript to JavaScript in the `dist/` folder.
   - `npm start` runs the compiled code with Node.js.

---

## Example API Calls

- **System info:**  
  `GET http://localhost:3000/system`

- **Read logs:**  
  `GET http://localhost:3000/logs`

- **Write a log:**  
  `POST http://localhost:3000/logs`  
  Body: `{ "level": "info", "message": "Test log" }`

- **Delete logs:**  
  `DELETE http://localhost:3000/logs`

- **Hash a string:**  
  `POST http://localhost:3000/crypto/hash`  
  Body: `{ "text": "password123" }`

- **Compare a string to a hash:**  
  `POST http://localhost:3000/crypto/compare`  
  Body: `{ "text": "password123", "hash": "<hash>" }`

- **Get environment variables:**  
  `GET http://localhost:3000/env`

---

## Security

- Endpoints that modify or delete data (e.g., DELETE /logs) are protected and require “admin” permissions.
- Exposed environment variables are filtered to avoid leaking sensitive data.

---

## Why this project?

- **Educational:** Perfect for learning about REST APIs, security, log management, and backend testing tools.
- **Practical:** Great for testing frontends, automations, or simulating real DevOps scenarios.

---

## Contributing

Pull requests and suggestions are welcome!  
Write code that is simple, clear, and well-commented—clarity always wins over cleverness.

---

## License