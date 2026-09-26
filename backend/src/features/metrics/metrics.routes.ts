import { configKeyParamsSchema, historyQuerySchema, updateConfigSchema } from "@pc-monitor/shared";
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../core/validation/validate.js";
import { 
    getSystemStats, 
    getHistoryController,
    recordCurrentStats, 
    patchSystemSettings 
} from "./metrics.controller.js";

const systemRouter = Router();

systemRouter.get('/', getSystemStats);
systemRouter.get('/history', validate({ query: historyQuerySchema }), getHistoryController);
systemRouter.post('/record', recordCurrentStats);
systemRouter.patch(
    '/settings',
    validate({ body: z.object({ key: configKeyParamsSchema.shape.key, value: updateConfigSchema.shape.value }) }),
    patchSystemSettings,
);

export default systemRouter;