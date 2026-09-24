import { getSafeEnvController } from "./config.controller.js";
import { updateEnvController } from './config.controller.js';
import { Router } from "express";

const envRouter = Router();

envRouter.get('/', getSafeEnvController);
envRouter.patch('/:key', updateEnvController);

export default envRouter;