-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logLevel" TEXT NOT NULL,
    "logMessage" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "actionId" TEXT,
    "success" BOOLEAN,
    "durationMs" INTEGER
);
INSERT INTO "new_Log" ("archived", "id", "logLevel", "logMessage", "timestamp") SELECT "archived", "id", "logLevel", "logMessage", "timestamp" FROM "Log";
DROP TABLE "Log";
ALTER TABLE "new_Log" RENAME TO "Log";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

