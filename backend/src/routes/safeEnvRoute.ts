import { getSafeEnvController } from "../controllers/safeEnvController.js";
import { updateEnvController } from '../controllers/safeEnvController.js';
import { Router } from "express";

const envRouter = Router();

envRouter.get('/', getSafeEnvController);
envRouter.patch('/:key', updateEnvController);

export default envRouter;