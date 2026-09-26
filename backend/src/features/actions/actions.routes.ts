import { Router } from 'express';
import { listActionsController } from './actions.controller.js';

const actionsRouter = Router();

actionsRouter.get('/', listActionsController);

export default actionsRouter;
