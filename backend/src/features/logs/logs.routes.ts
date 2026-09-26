import { createLogSchema, logIdParamsSchema, logQuerySchema, updateLogSchema } from '@pc-monitor/shared';
import { Router } from 'express';
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
loggerRouter.delete('/:id', validate({ params: logIdParamsSchema }), deleteLogsController);
loggerRouter.patch(
  '/:id',
  validate({ params: logIdParamsSchema, body: updateLogSchema }),
  patchLogController,
);

export default loggerRouter;
