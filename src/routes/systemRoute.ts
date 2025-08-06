import { Router } from "express";
import { handleSystemStats } from "../controllers/systemController.js";

const router = Router();

router.get('/system', handleSystemStats);


export default router;