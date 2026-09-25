-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "System";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Sample" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuTotal" REAL NOT NULL,
    "cpuTemp" REAL,
    "ramUsed" REAL NOT NULL,
    "ramTotal" REAL NOT NULL,
    "diskReadBps" REAL NOT NULL,
    "diskWriteBps" REAL NOT NULL,
    "netRxBps" REAL NOT NULL,
    "netTxBps" REAL NOT NULL
);

-- CreateIndex
CREATE INDEX "Sample_createdAt_idx" ON "Sample"("createdAt");

