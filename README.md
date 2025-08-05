# Dev Dashboard REST API

A REST API designed to simulate a developer/admin dashboard—perfect for DevOps, admins, or anyone who wants to learn how to monitor system health, manage logs, test cryptography, and use backend testing tools with Node.js/Express.

---

## Main Features

### 1. System Monitoring

- **CPU, RAM, uptime:** See the status of the machine running the server.
- **Endpoints:**  
  - `GET /system` – General system info  
  - `GET /cpus` – CPU details  
  - `GET /memory` – Total and free RAM  
  - `GET /uptime` – Server uptime

### 2. Log Management

- **Read and delete logs:**  
  - Read the latest events from `.log` files
  - Delete logs (admin only)
  - Simulate log levels: info, warning, error
- **Endpoints:**  
  - `GET /logs` – Read logs  
  - `POST /logs` – Write a new log event  
  - `DELETE /logs` – Delete logs (admin only)

### 3. Cryptography and Hash Testing

- **Hashing and encryption:**  
  - Calculate hashes (SHA256, bcrypt) for a string
  - Simulate basic encryption
- **Endpoint:**  
  - `POST /hash` – Receives a string and returns its hash

### 4. Environment Variable Access

- **View safe environment variables:**  
  - Only a safe subset, never secrets
  - Simulate different environments (dev/prod)
- **Endpoint:**  
  - `GET /env` – Returns safe environment variables

### 5. Testing Tools

- **Ping, delay, redirect:**  
  - Test if the server responds (`/ping`)
  - Simulate a slow server (`/delay/:seconds`)
  - Simulate HTTP redirects (`/redirect/:url`)
- **Endpoints:**  
  - `GET /ping`  
  - `GET /delay/:seconds`  
  - `GET /redirect/:url`

---

## Tech Stack

This project uses a simple, modern Node.js stack:

- **[Node.js](https://nodejs.org/)** – JavaScript runtime for the backend.
- **[Express](https://expressjs.com/)** – Minimal and flexible web framework for building REST APIs.
- **[TypeScript](https://www.typescriptlang.org/)** – Strongly typed language that builds on JavaScript, for safer and clearer code.
- **[ts-node-dev](https://github.com/wclr/ts-node-dev)** – Runs TypeScript code directly with automatic restarts on file changes (hot-reloading) for development.
- **[dotenv](https://github.com/motdotla/dotenv)** – Loads environment variables from a `.env` file into `process.env`.
- **[@types/express](https://www.npmjs.com/package/@types/express)** and **[@types/node](https://www.npmjs.com/package/@types/node)** – TypeScript type definitions for Express and Node.js, for better IntelliSense and type safety.

All dependencies are listed in `package.json`.

## Project Structure
```bash
my-app/
│
├── src/
│ ├── index.ts # Express entry point
│ ├── routes/ # All Express routes
│ ├── controllers/ # Route logic
│ ├── services/ # Core logic (RAM, uptime, logs, etc.)
│ ├── utils/ # General utilities
│ ├── types/ # Centralized TypeScript types
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
   git clone <repo-url>
   cd my-app
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

- **Hash a string:**  
  `POST http://localhost:3000/hash`  
  Body: `{ "text": "password123" }`

- **Ping:**  
  `GET http://localhost:3000/ping`

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

MIT