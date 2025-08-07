import { getSafeEnvController } from "../controllers/safeEnvController.js";
import { Router } from "express";

const envRouter = Router();

envRouter.get('/env', getSafeEnvController);

export default envRouter;