import { Router } from "express";
import { getLogsController, writeLogsController,deleteLogsController } from "../controllers/infoLogController.js";

const loggerRouter = Router();

loggerRouter.get('/', getLogsController);
loggerRouter.post('/', writeLogsController);
loggerRouter.delete('/:id',deleteLogsController);

export default loggerRouter;