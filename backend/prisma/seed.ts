import { seedDefaultConfig } from '../src/features/config/index.js';
import { prisma } from '../src/core/prisma.js';

await seedDefaultConfig();
await prisma.$disconnect();
console.log('Seeded default AppConfig thresholds');
