import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { router } from './routes.js';
declare global { namespace Express { interface Request { sessionId:string } } }
const app=express();app.disable('x-powered-by');app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:config.CLIENT_URL,credentials:true}));app.use(express.json({limit:'32kb'}));app.use(cookieParser(config.SESSION_SECRET));
app.use((req,res,next)=>{let sessionId=req.signedCookies['mystery.sid'] as string|undefined;if(!sessionId||sessionId.length>100){sessionId=randomUUID();res.cookie('mystery.sid',sessionId,{signed:true,httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',maxAge:1000*60*60*24*30,path:'/'});}req.sessionId=sessionId;next();});
app.get('/api/health',(_req,res)=>res.json({status:'ok'}));app.use('/api',rateLimit({windowMs:60_000,limit:60,standardHeaders:true,legacyHeaders:false}));app.use('/api',router);
app.use((_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found.'}}));
const errors:ErrorRequestHandler=(error,_req,res,_next)=>{if(error instanceof ZodError)return res.status(400).json({error:{code:'VALIDATION_ERROR',message:error.issues.map(i=>i.message).join(' ')}});console.error('Request failed',error instanceof Error?error.message:'unknown error');return res.status(500).json({error:{code:'INTERNAL_ERROR',message:'The request could not be completed.'}});};app.use(errors);
void connectDatabase().then(()=>app.listen(config.PORT,()=>console.info(`API listening on ${config.PORT}`))).catch(error=>{console.error('Database connection failed',error instanceof Error?error.message:'unknown');process.exit(1)});
