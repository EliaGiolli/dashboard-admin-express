import { actionIdParamsSchema, runActionRequestSchema } from '@pc-monitor/shared';
import { Router } from 'express';
import { validate } from '../../core/validation/validate.js';
import { listActionsController, runActionController } from './actions.controller.js';

const actionsRouter = Router();

// A POST without a body leaves req.body undefined; treat it as {}.
const runBody = runActionRequestSchema.optional().transform((body) => body ?? {});

actionsRouter.get('/', listActionsController);
actionsRouter.post('/:id/run', validate({ params: actionIdParamsSchema, body: runBody }), runActionController);

export default actionsRouter;
