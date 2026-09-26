import { z } from 'zod';

export const logLevelSchema = z.enum(['info', 'warning', 'error']);
export type LogLevel = z.infer<typeof logLevelSchema>;

// Where a log comes from: the API (manual), the threshold monitor, or a fix action run (audit trail).
export const logSourceSchema = z.enum(['manual', 'monitor', 'action']);
export type LogSource = z.infer<typeof logSourceSchema>;

export const logSchema = z.object({
  id: z.number().int(),
  timestamp: z.iso.datetime(),
  logLevel: logLevelSchema,
  logMessage: z.string(),
  archived: z.boolean(),
  source: logSourceSchema,
  actionId: z.string().nullable(),
  success: z.boolean().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});
export type Log = z.infer<typeof logSchema>;

// Public body for POST /api/logs; it cannot set source or audit fields, so clients can't forge action runs.
export const createLogSchema = z.object({
  logMessage: z.string().trim().min(1).max(1000),
  logLevel: logLevelSchema,
});
export type CreateLog = z.infer<typeof createLogSchema>;

// Server-side extras for logs written by the monitor or the action runner.
export type LogAudit = {
  source: LogSource;
  actionId?: string;
  success?: boolean;
  durationMs?: number;
};

export const updateLogSchema = z.object({
  archived: z.boolean(),
});
export type UpdateLog = z.infer<typeof updateLogSchema>;

export const logIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type LogIdParams = z.infer<typeof logIdParamsSchema>;

// Query-string boolean: only the literal strings "true"/"false". (z.coerce.boolean()
// would turn the string "false" into true.)
const queryBoolean = z.enum(['true', 'false']).transform((v) => v === 'true');

export const LOG_PAGE_MAX = 100;

// GET /api/logs query. Filters are optional and combined with AND; dates are ISO 8601
// and inclusive, and `from` must not be after `to`.
// Pagination is keyset-based: `cursor` is the `nextCursor` of the previous page, an
// opaque "<timestampMs>_<id>" of its last item. Unlike an offset, it doesn't skip or
// repeat rows when new logs arrive between pages (the ticker writes alerts at any time),
// and it keeps working if the row it points to is deleted.
export const logQuerySchema = z
  .object({
    level: logLevelSchema.optional(),
    source: logSourceSchema.optional(),
    actionId: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
    archived: queryBoolean.optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(LOG_PAGE_MAX).default(50),
    cursor: z.string().regex(/^\d{1,15}_\d{1,10}$/, 'must be a nextCursor from a previous page').optional(),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), {
    message: '`from` must not be after `to`',
    path: ['from'],
  });
export type LogQuery = z.infer<typeof logQuerySchema>;

export const logPageSchema = z.object({
  items: z.array(logSchema),
  nextCursor: z.string().nullable(), // null on the last page
});
export type LogPage = z.infer<typeof logPageSchema>;
