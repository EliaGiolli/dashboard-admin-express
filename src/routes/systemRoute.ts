import { Router } from "express";
import { handleSystemStats } from "../controllers/systemController.js";

const systemRouter = Router();

systemRouter.get('/', handleSystemStats);


export default systemRouter;