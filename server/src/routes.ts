import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { Attempt, Mystery } from './models.js';
import { generateMystery, serializePublic, serializeResult } from './generator.js';
import { generateSuspectReply } from './interrogation.js';
import { assistInterrogation, type InterviewAssistAction } from './interrogation-assistant.js';
import { compactInterviewSummary, findContradictionEvidence, projectInterviewState } from './interrogation-logic.js';
import { analyzeBoard } from './board-assistant.js';
import { boardStateSchema, caseNodeTypeIndex, validateBoardState } from './board-logic.js';
export const router=Router();
const createSchema=z.object({scenario:z.string().trim().min(20).max(3000),difficulty:z.enum(['Easy','Medium','Hard','Expert']).default('Medium'),category:z.enum(['Theft','Murder mystery','Missing person','Corporate investigation','Historical mystery','Suspicious incident','General mystery']).default('General mystery'),length:z.enum(['Short','Standard','Extended']).default('Standard'),evidenceTypes:z.array(z.string()).max(8).default([])});
const accusationSchema=z.object({suspectId:z.string().min(1).max(80)});
const interviewSchema=z.object({question:z.string().trim().min(2).max(1000),evidenceIds:z.array(z.string().min(1).max(80)).max(5).default([])});
const interviewAssistSchema=z.object({action:z.enum(['follow-up','review','compare'])});
const interviewNotesSchema=z.object({notes:z.string().max(4000)});
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
router.get('/mysteries/:id/board',wrap(async(req,res)=>{
  const caseId=routeParam(req.params.id);const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});
  return res.json({board:attempt.board??null,updatedAt:attempt.boardUpdatedAt??null});
}));
router.put('/mysteries/:id/board',wrap(async(req,res)=>{
  const caseId=routeParam(req.params.id);const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});
  const board=validateBoardState(boardStateSchema.parse(req.body?.board),caseNodeTypeIndex(mystery));const updatedAt=new Date();await Attempt.updateOne({caseId,ownerSession:req.sessionId},{$set:{board,boardUpdatedAt:updatedAt}});return res.json({success:true,updatedAt});
}));
router.post('/mysteries/:id/board/analyze',rateLimit({windowMs:60_000,limit:6,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
  if(!config.GEMINI_API_KEY)return res.status(503).json({error:{code:'AI_NOT_CONFIGURED',message:'AI board analysis requires the existing GEMINI_API_KEY setting.'}});
  const caseId=routeParam(req.params.id);const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});
  const board=validateBoardState(boardStateSchema.parse(req.body?.board),caseNodeTypeIndex(mystery));const result=await analyzeBoard({mystery,board,discoveredEvidenceIds:attempt.discoveredEvidenceIds??[]});return res.json(result);
}));
router.get('/mysteries/:id/interrogations/:suspectId',wrap(async(req,res)=>{
  const caseId=routeParam(req.params.id),suspectId=routeParam(req.params.suspectId);const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  if(!mystery.suspects.some((suspect:{id:string})=>suspect.id===suspectId))return res.status(404).json({error:{code:'SUSPECT_NOT_FOUND',message:'Suspect not found in this case.'}});
  const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});
  const state=(attempt.interrogations??[]).find((item:any)=>item.suspectId===suspectId);return res.json(projectInterviewState(suspectId,state));
}));
router.put('/mysteries/:id/interrogations/:suspectId/notes',wrap(async(req,res)=>{
  const caseId=routeParam(req.params.id),suspectId=routeParam(req.params.suspectId);const {notes}=interviewNotesSchema.parse(req.body);const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready'||!mystery.suspects.some((item:{id:string})=>item.id===suspectId))return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable suspect not found.'}});const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});await Attempt.updateOne({caseId,ownerSession:req.sessionId,'interrogations.suspectId':{$ne:suspectId}},{$push:{interrogations:{suspectId,turns:[],questionsAsked:[],presentedEvidenceIds:[],contradictionEvidenceIds:[],disclosedKnowledgeIds:[],unansweredQuestions:[],notes}}});await Attempt.updateOne({caseId,ownerSession:req.sessionId,'interrogations.suspectId':suspectId},{$set:{'interrogations.$.notes':notes}});return res.json({success:true});
}));
router.post('/mysteries/:id/interrogations/:suspectId/assist',rateLimit({windowMs:60_000,limit:8,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
  const caseId=routeParam(req.params.id),suspectId=routeParam(req.params.suspectId);const {action}=interviewAssistSchema.parse(req.body);if(!config.GEMINI_API_KEY)return res.status(503).json({error:{code:'AI_NOT_CONFIGURED',message:'Interrogation assistance requires the existing GEMINI_API_KEY setting.'}});const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});const suspect=mystery.suspects.find((item:{id:string})=>item.id===suspectId);if(!suspect)return res.status(404).json({error:{code:'SUSPECT_NOT_FOUND',message:'Suspect not found in this case.'}});const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});const discovered=new Set(attempt.discoveredEvidenceIds??[]);if(action==='compare'&&!discovered.size)return res.status(400).json({error:{code:'NO_DISCOVERED_EVIDENCE',message:'Discover evidence before comparing statements.'}});const evidence=(mystery.evidence??[]).filter((item:{id:string})=>discovered.has(item.id));const state=(attempt.interrogations??[]).find((item:any)=>item.suspectId===suspectId);const result=await assistInterrogation({action:action as InterviewAssistAction,suspect,evidence,state});return res.json(result);
}));
router.post('/mysteries/:id/interrogations/:suspectId',rateLimit({windowMs:60_000,limit:20,standardHeaders:true,legacyHeaders:false}),wrap(async(req,res)=>{
  const caseId=routeParam(req.params.id),suspectId=routeParam(req.params.suspectId);const {question,evidenceIds}=interviewSchema.parse(req.body);const mystery=await ownCase(caseId,req.sessionId);if(!mystery||mystery.status!=='ready')return res.status(404).json({error:{code:'NOT_FOUND',message:'Playable case not found.'}});
  const suspect=mystery.suspects.find((item:{id:string})=>item.id===suspectId);if(!suspect)return res.status(404).json({error:{code:'SUSPECT_NOT_FOUND',message:'Suspect not found in this case.'}});
  const attempt=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!attempt)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});if(attempt.accusation)return res.status(409).json({error:{code:'CASE_CLOSED',message:'Interviews are closed after the final accusation.'}});
  if(new Set(evidenceIds).size!==evidenceIds.length)return res.status(400).json({error:{code:'DUPLICATE_EVIDENCE',message:'Choose each evidence item only once.'}});
  if(evidenceIds.some(id=>!mystery.evidence.some((item:{id:string})=>item.id===id)))return res.status(400).json({error:{code:'INVALID_EVIDENCE',message:'Presented evidence must belong to this case.'}});
  if(evidenceIds.some(id=>!attempt.discoveredEvidenceIds.includes(id)))return res.status(403).json({error:{code:'EVIDENCE_NOT_DISCOVERED',message:'Discover evidence before presenting it to a suspect.'}});
  const presented=evidenceIds.map(id=>mystery.evidence.find((item:{id:string})=>item.id===id));const contradictionEvidenceIds=findContradictionEvidence(suspectId,presented as any[]);
  const previous=(attempt.interrogations??[]).find((item:any)=>item.suspectId===suspectId);const history=(previous?.turns??[]).map((turn:any)=>({...turn,askedAt:new Date(turn.askedAt).toISOString()}));
  const reply=await generateSuspectReply({suspect,question,evidence:presented,history,summary:previous?.summary,contradictionEvidenceIds});const turn={question,answer:reply.answer,askedAt:new Date(),presentedEvidenceIds:evidenceIds,usedEvidenceIds:reply.usedEvidenceIds,contradictionEvidenceIds,disclosedKnowledgeIds:reply.usedKnowledgeIds,answered:reply.answered};
  await Attempt.updateOne({caseId,ownerSession:req.sessionId,accusation:null,'interrogations.suspectId':{$ne:suspectId}},{$push:{interrogations:{suspectId,turns:[],questionsAsked:[],presentedEvidenceIds:[],contradictionEvidenceIds:[],disclosedKnowledgeIds:[],unansweredQuestions:[]}}});
  const statePath='interrogations.$.';
  const summary=compactInterviewSummary(previous?.summary??'',{question,answer:reply.answer,usedKnowledgeIds:reply.usedKnowledgeIds,presentedEvidenceIds:evidenceIds});const update:any={$push:{[`${statePath}turns`]:turn},$set:{[`${statePath}summary`]:summary},$addToSet:{[`${statePath}questionsAsked`]:question,[`${statePath}presentedEvidenceIds`]:{$each:evidenceIds},[`${statePath}contradictionEvidenceIds`]:{$each:contradictionEvidenceIds},[`${statePath}disclosedKnowledgeIds`]:{$each:reply.usedKnowledgeIds}}};
  if(reply.answered)update.$pull={[`${statePath}unansweredQuestions`]:question};else update.$addToSet[`${statePath}unansweredQuestions`]=question;
  await Attempt.updateOne({caseId,ownerSession:req.sessionId,accusation:null,'interrogations.suspectId':suspectId},update);
  const refreshed=await Attempt.findOne({caseId,ownerSession:req.sessionId});if(!refreshed)return res.status(404).json({error:{code:'NOT_FOUND',message:'Investigation attempt not found.'}});
  const latest=(refreshed.interrogations??[]).find((item:any)=>item.suspectId===suspectId);return res.json({turn:{...turn,askedAt:turn.askedAt.toISOString()},state:projectInterviewState(suspectId,latest)});
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
