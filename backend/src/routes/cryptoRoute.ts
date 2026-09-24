import { Router } from "express";
import { 
    comparePasswordController, 
    hashPasswordController 
} from "../controllers/cryptoController.js";

// custom middleware
import { adminGuard } from "../middlewares/authGuard.js";

const cryptoRouter = Router();

cryptoRouter.post('/hash', adminGuard, hashPasswordController);
cryptoRouter.post('/compare', adminGuard, comparePasswordController);

export default cryptoRouter;