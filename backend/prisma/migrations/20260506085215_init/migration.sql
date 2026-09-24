-- CreateTable
CREATE TABLE "Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logLevel" TEXT NOT NULL,
    "logMessage" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "System" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uptime" INTEGER NOT NULL,
    "totalMemory" BIGINT NOT NULL,
    "freeMemory" BIGINT NOT NULL,
    "cpuUsagePercent" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "EnvVariable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvVariable_key_key" ON "EnvVariable"("key");
