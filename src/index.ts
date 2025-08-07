import express from 'express'
import dotenv from 'dotenv'

import { 
    type Request, 
    type Response, 
    type NextFunction 
} from 'express';

import envRouter from './routes/safeEnvRoute.js';
import loggerRouter from './routes/loggerRoute.js';
import cryptoRouter from './routes/cryptoRoute.js';
import systemRouter from './routes/systemRoute.js';

//server creation with Express
const app = express();
//dotenv configuration
dotenv.config({path:'../.env'});
//middlewares definition - the response will be in JSON format
app.use(express.json());

const PORT = process.env.PORT || 3000;


//Routes here
app.use('/env', envRouter);
app.use('/system', systemRouter);
app.use('/crypto/hash',cryptoRouter);
app.use('/crypto/compare', cryptoRouter);
app.use('/logs',loggerRouter);
app.use('/:id', loggerRouter);


//Middleware usage for error handling
app.use((err:Error, req:Request, res:Response, next:NextFunction) => {
    console.error(err.stack);
    res.status(500).json({error: 'internal error'});
    next();
})

app.listen(PORT, () => console.log(`Server runs on port ${PORT}`));