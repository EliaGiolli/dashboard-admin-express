-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sample" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuTotal" REAL NOT NULL,
    "cpuTemp" REAL,
    "ramUsed" REAL NOT NULL,
    "ramTotal" REAL NOT NULL,
    "diskReadBps" REAL,
    "diskWriteBps" REAL,
    "netRxBps" REAL,
    "netTxBps" REAL
);
INSERT INTO "new_Sample" ("cpuTemp", "cpuTotal", "createdAt", "diskReadBps", "diskWriteBps", "id", "netRxBps", "netTxBps", "ramTotal", "ramUsed") SELECT "cpuTemp", "cpuTotal", "createdAt", "diskReadBps", "diskWriteBps", "id", "netRxBps", "netTxBps", "ramTotal", "ramUsed" FROM "Sample";
DROP TABLE "Sample";
ALTER TABLE "new_Sample" RENAME TO "Sample";
CREATE INDEX "Sample_createdAt_idx" ON "Sample"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

