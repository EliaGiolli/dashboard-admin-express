import { getSafeEnvController } from "../controllers/safeEnvController.js";
import { Router } from "express";

const envRouter = Router();

envRouter.get('/', getSafeEnvController);

export default envRouter;