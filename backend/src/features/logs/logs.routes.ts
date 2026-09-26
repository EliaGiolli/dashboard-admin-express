import { createLogSchema, logIdParamsSchema, logQuerySchema, updateLogSchema } from '@pc-monitor/shared';
import { Router } from 'express';
import { adminGuard } from '../../core/security/authGuard.js';
import { validate } from '../../core/validation/validate.js';
import {
  deleteLogsController,
  getLogsController,
  patchLogController,
  writeLogsController,
} from './logs.controller.js';

const loggerRouter = Router();

loggerRouter.get('/', validate({ query: logQuerySchema }), getLogsController);
loggerRouter.post('/', validate({ body: createLogSchema }), writeLogsController);
// Changing or removing history is admin-only. The guard runs first, so an unauthorised
// request learns nothing (not even whether the id exists).
loggerRouter.delete('/:id', adminGuard, validate({ params: logIdParamsSchema }), deleteLogsController);
loggerRouter.patch(
  '/:id',
  adminGuard,
  validate({ params: logIdParamsSchema, body: updateLogSchema }),
  patchLogController,
);

export default loggerRouter;
