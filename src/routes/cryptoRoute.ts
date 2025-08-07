import { Router } from "express";
import { 
    comparePasswordController, 
    hashPasswordController 
} from "../controllers/cryptoController.js";

const cryptoRouter = Router();

cryptoRouter.post('/crypto/hash', hashPasswordController);
cryptoRouter.post('/crypto/compare', comparePasswordController);

export default cryptoRouter;