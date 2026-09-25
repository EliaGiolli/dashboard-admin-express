import { z } from 'zod';

export const errorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
  stack: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const messageResponseSchema = z.object({
  message: z.string(),
});
export type MessageResponse = z.infer<typeof messageResponseSchema>;
