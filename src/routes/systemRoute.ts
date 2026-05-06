import { Router } from "express";
import { 
    getSystemStats, 
    recordCurrentStats, 
    patchSystemSettings 
} from "../controllers/systemController.js";

const systemRouter = Router();

systemRouter.get('/', getSystemStats);
systemRouter.post('/record', recordCurrentStats);
systemRouter.patch('/settings', patchSystemSettings);

export default systemRouter;