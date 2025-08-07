import { Router } from "express";
import { 
    comparePasswordController, 
    hashPasswordController 
} from "../controllers/cryptoController.js";

const cryptoRouter = Router();

cryptoRouter.post('/hash', hashPasswordController);
cryptoRouter.post('/compare', comparePasswordController);

export default cryptoRouter;