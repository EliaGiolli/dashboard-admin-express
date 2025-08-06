import { Router } from "express";
import { 
    comparePasswordController, 
    hashPasswordController 
} from "../controllers/cryptoController.js";

const router = Router();

router.post('/crypto/hash', hashPasswordController);
router.post('/crypto/compare', comparePasswordController);

export default router;