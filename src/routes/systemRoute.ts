import { Router } from "express";
import { handleSystemStats } from "../controllers/systemController.js";

const systemRouter = Router();

systemRouter.get('/system', handleSystemStats);


export default systemRouter;