import { thresholdKeys, type AppConfig, type ConfigValueType, type SafeEnv, type ThresholdKey } from '@pc-monitor/shared';
import { AppError } from '../../core/errors/appError.js';
import { prisma } from '../../core/prisma.js';
import { envWhitelist } from './envWhitelist.js';
import { parseEnvVariable } from './parseEnvVariable.js';

// Returns only the whitelisted environment variables, converted to their declared type.
export function getSafeEnv(): SafeEnv {
  const result: SafeEnv = {};
  for (const key in envWhitelist) {
    const type = envWhitelist[key];
    if (type === undefined) continue;
    const value = parseEnvVariable(process.env[key], type);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function isValidForType(value: string, type: ConfigValueType): boolean {
  if (type === 'number') return value.trim() !== '' && Number.isFinite(Number(value));
  if (type === 'boolean') return value === 'true' || value === 'false';
  return true;
}

export async function updateConfigValue(key: string, value: string): Promise<AppConfig> {
  const existing = await prisma.appConfig.findUnique({ where: { key } });
  if (!existing) throw new AppError(`Configuration key ${key} not found`, 404);

  const type = existing.type as ConfigValueType;
  if (!isValidForType(value, type)) {
    throw new AppError(`Value for ${key} must be a valid ${type}`, 400);
  }
  return (await prisma.appConfig.update({ where: { key }, data: { value } })) as AppConfig;
}

// Current alert thresholds in percent. A key that is missing, not a number, or outside
// 0-100 is left out, which disables alerts for that metric instead of alerting on junk.
export async function getThresholds(): Promise<Partial<Record<ThresholdKey, number>>> {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: [...thresholdKeys] } } });
  const result: Partial<Record<ThresholdKey, number>> = {};
  for (const row of rows) {
    const value = row.value.trim() === '' ? Number.NaN : Number(row.value);
    if (Number.isFinite(value) && value >= 0 && value <= 100) result[row.key as ThresholdKey] = value;
  }
  return result;
}
