import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { Attempt, Mystery } from './models.js';
import { generateMystery, serializePublic, serializeResult } from './generator.js';
export const router=Router();
const createSchema=z.object({scenario:z.string().trim().min(20).max(3000),difficulty:z.enum(['Easy','Medium','Hard','Expert']).default('Medium'),category:z.enum(['Theft','Murder mystery','Missing person','Corporate investigation','Historical mystery','Suspicious incident','General mystery']).default('General mystery'),length:z.enum(['Short','Standard','Extended']).default('Standard'),evidenceTypes:z.array(z.string()).max(8).default([])});
const accusationSchema=z.object({suspectId:z.string().min(1).max(80)});
const wrap=(fn:(req:Request,res:Response,next:NextFunction)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{void fn(req,res,next).catch(next)};
const ownCase=(id:string,owner:string)=>Mystery.findOne({caseId:id,ownerSession:owner});
const routeParam=(value:string|string[]|undefined):string=>Array.isArray(value)?value[0]??'':value??'';

router.get('/mysteries',wrap(async(req,res)=>{
  const cases=await Mystery.find({ownerSession:req.sessionId,status:'ready'}).sort({createdAt:-1}).limit(50).select('caseId title category difficulty createdAt').lean();
  const attempts=await Attempt.find({ownerSession:req.sessionId,caseId:{$in:cases.map(item=>item.caseId)}}).select('caseId accusation').lean();
  const attemptMap=new Map(attempts.map(item=>[item.caseId,Boolean(item.accusation)]));
  return res.json({cases:cases.map(item=>({id:item.caseId,title:item.title,category:item.category,difficulty:item.difficulty,createdAt:item.createdAt,accused:attemptMap.get(item.caseId)??false}))});
}));
router.post('/mysteries',rateLimit({windowMs:60*60_000,limit:8,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
  if(!config.GEMINI_API_KEY)return res.status(503).json({error:{code:'AI_NOT_CONFIGURED',message:'Add GEMINI_API_KEY to the project .env file, then restart the backend.'}});
  const input=createSchema.parse(req.body);const caseId=randomUUID();
  const mystery=await Mystery.create({caseId,ownerSession:req.sessionId,status:'generating',settings:{difficulty:input.difficulty,category:input.category,length:input.length},scenario:input.scenario});
  await Attempt.create({caseId,ownerSession:req.sessionId});
  void generateMystery(input).then(content=>Mystery.updateOne({caseId,ownerSession:req.sessionId,status:'generating'},{$set:{...content,status:'ready'}})).catch(async error=>{console.error('Mystery generation failed',error instanceof Error?error.message:'unknown error');await Mystery.updateOne({caseId},{$set:{status:'failed',failureMessage:'We could not prepare a valid case. Please create another mystery.'}})});
  res.status(202).json({id:mystery.caseId,status:'generating'});
}));
router.get('/mysteries/:id',wrap(async(req,res)=>{
  const mystery=await ownCase(routeParam(req.params.id),req.sessionId);if(!mystery)return res.status(404).json({error:{code:'NOT_FOUND',message:'Case not found.'}});
  if(mystery.status==='generating')return res.json({id:mystery.caseId,status:'generating'});
  if(mystery.status==='failed')return res.status(422).json({error:{code:'GENERATION_FAILED',message:mystery.failureMessage}});
  const attempt=await Attempt.findOne({caseId:mystery.caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});
  return res.json(serializePublic(mystery,attempt));
}));
router.post('/mysteries/:id/evidence/:evidenceId/discover',wrap(async(req,res)=>{
  const evidenceId=routeParam(req.params.evidenceId);const mystery=await ownCase(routeParam(req.params.id),req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  if(!mystery.evidence.some((item:{id:string})=>item.id===evidenceId))return res.status(404).json({error:{code:'EVIDENCE_NOT_FOUND',message:'Evidence not found.'}});
  await Attempt.updateOne({caseId:mystery.caseId,ownerSession:req.sessionId,accusation:null,discoveredEvidenceIds:{$ne:evidenceId}},{$addToSet:{discoveredEvidenceIds:evidenceId,discoveredEvidence:{evidenceId,discoveredAt:new Date()}}});return res.json({success:true});
}));
router.post('/mysteries/:id/accusations',wrap(async(req,res)=>{
  const {suspectId}=accusationSchema.parse(req.body);const mystery=await ownCase(routeParam(req.params.id),req.sessionId);
  if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  if(!mystery.suspects.some((suspect:{id:string})=>suspect.id===suspectId))return res.status(400).json({error:{code:'INVALID_SUSPECT',message:'Choose a suspect from this case.'}});
  const attempt=await Attempt.findOneAndUpdate({caseId:mystery.caseId,ownerSession:req.sessionId,accusation:null},{$set:{selectedSuspectId:suspectId,accusation:{suspectId},accusedAt:new Date()}},{new:true});
  if(!attempt)return res.status(409).json({error:{code:'ALREADY_ACCUSED',message:'An accusation has already been submitted for this case.'}});
  return res.json(serializeResult(mystery,attempt));
}));
router.get('/mysteries/:id/results',wrap(async(req,res)=>{
  const mystery=await ownCase(routeParam(req.params.id),req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Case not found.'}});
  const attempt=await Attempt.findOne({caseId:mystery.caseId,ownerSession:req.sessionId});if(!attempt?.accusation)return res.status(403).json({error:{code:'SOLUTION_LOCKED',message:'Submit your accusation before opening the solution.'}});
  return res.json(serializeResult(mystery,attempt));
}));
