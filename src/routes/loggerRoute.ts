import { Router } from "express";
import { getLogsController, writeLogsController,deleteLogsController } from "../controllers/infoLogController.js";

const router = Router();

router.get('/logs', getLogsController);
router.post('/logs', writeLogsController);
router.delete('/:id',deleteLogsController);

export default router;