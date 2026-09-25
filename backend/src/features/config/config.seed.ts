import { defaultThresholds, thresholdKeys } from '@pc-monitor/shared';
import { prisma } from '../../core/prisma.js';

// Creates missing threshold rows; values the user already changed are left untouched.
export async function seedDefaultConfig(): Promise<void> {
  for (const key of thresholdKeys) {
    await prisma.appConfig.upsert({
      where: { key },
      create: { key, value: String(defaultThresholds[key]), type: 'number' },
      update: {},
    });
  }
}
