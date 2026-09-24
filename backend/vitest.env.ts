import path from 'node:path';

export const testDatabaseFile = path.resolve(import.meta.dirname, '.test', 'test.db');
export const testDatabaseUrl = `file:${testDatabaseFile.split(path.sep).join('/')}`;
