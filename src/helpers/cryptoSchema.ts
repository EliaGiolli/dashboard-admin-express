// /validators/cryptoSchema.ts
import { z } from 'zod';

export const hashSchema = z.object({
  value: z.string().min(1, "La stringa non può essere vuota"),
  algorithm: z.enum(['bcrypt', 'sha256']).default('bcrypt') 
});
