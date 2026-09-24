import { Router } from "express";
import { 
    getLogsController, 
    writeLogsController,
    deleteLogsController,
    patchLogController 
} from "../controllers/infoLogController.js";

const loggerRouter = Router();

loggerRouter.get('/', getLogsController);
loggerRouter.post('/', writeLogsController);
loggerRouter.delete('/:id',deleteLogsController);
loggerRouter.patch('/:id', patchLogController);

export default loggerRouter;