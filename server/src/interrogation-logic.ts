import { z } from 'zod';

const assistReplySchema=z.object({message:z.string().trim().min(8).max(1200),questions:z.array(z.string().trim().min(5).max(240)).max(4),evidenceIds:z.array(z.string().min(1)).max(12)});
export function validateInterviewAssist(value:unknown,allowedEvidenceIds:Iterable<string>){const parsed=assistReplySchema.parse(value);const allowed=new Set(allowedEvidenceIds);if(parsed.evidenceIds.some(id=>!allowed.has(id)))throw new Error('Assistant referenced evidence that has not been discovered.');return parsed;}

export const dialogueReplySchema=z.object({answer:z.string().trim().min(1).max(1200),usedKnowledgeIds:z.array(z.string()).max(8),usedEvidenceIds:z.array(z.string()).max(5),answered:z.boolean()});
export type DialogueReply=z.infer<typeof dialogueReplySchema>;
export type SimpleFact={id:string;text:string};
export const asFacts=(value:unknown):SimpleFact[]=>Array.isArray(value)?value.filter((fact):fact is SimpleFact=>Boolean(fact&&typeof fact==='object'&&typeof (fact as any).id==='string'&&typeof (fact as any).text==='string')):[];
export function compactInterviewSummary(previous:string,turn:{question:string;answer:string;usedKnowledgeIds:string[];presentedEvidenceIds:string[]},maxChars=1400){return `${previous}\nQ: ${turn.question}\nA: ${turn.answer}\nInformation IDs: ${turn.usedKnowledgeIds.join(', ')||'none'}; evidence IDs: ${turn.presentedEvidenceIds.join(', ')||'none'}`.trim().slice(-maxChars);}
export function projectInterviewState(suspectId:string,state:any){return {suspectId,turns:(state?.turns??[]).map((turn:any)=>({question:turn.question,answer:turn.answer,askedAt:new Date(turn.askedAt).toISOString(),presentedEvidenceIds:turn.presentedEvidenceIds??[],usedEvidenceIds:turn.usedEvidenceIds??[],contradictionEvidenceIds:turn.contradictionEvidenceIds??[],disclosedKnowledgeIds:turn.disclosedKnowledgeIds??[],answered:Boolean(turn.answered)})),questionsAsked:state?.questionsAsked??[],presentedEvidenceIds:state?.presentedEvidenceIds??[],contradictionEvidenceIds:state?.contradictionEvidenceIds??[],disclosedKnowledgeIds:state?.disclosedKnowledgeIds??[],unansweredQuestions:state?.unansweredQuestions??[],notes:state?.notes??'',summary:state?.summary??''};}

export function validateDialogueReply(value:unknown,allowedIds:Iterable<string>,allowedEvidenceIds:Iterable<string>,isCulprit:boolean):DialogueReply {
  const parsed=dialogueReplySchema.parse(value);const allowed=new Set(allowedIds);
  if(parsed.usedKnowledgeIds.some(id=>!allowed.has(id)))throw new Error('The suspect response cited unknown knowledge.');
  const allowedEvidence=new Set(allowedEvidenceIds);if(parsed.usedEvidenceIds.some(id=>!allowedEvidence.has(id)))throw new Error('The suspect response cited evidence that was not presented.');
  if(!parsed.answered&&parsed.usedKnowledgeIds.length)throw new Error('An unanswered response cannot disclose facts.');
  const confession=/\b(?:i\s+(?:stole|killed|committed the crime|did it|was responsible for (?:the|this) (?:crime|theft|murder|incident))\b|i(?: am|'m) (?:the culprit|guilty|responsible))\b/i;
  if(!isCulprit&&confession.test(parsed.answer))throw new Error('A non-culprit response claimed responsibility for the crime.');
  if(parsed.answered&&!parsed.usedKnowledgeIds.length&&!parsed.usedEvidenceIds.length)throw new Error('An answer must be grounded in known facts or presented evidence.');
  return parsed;
}
export function validateOrFallbackDialogue(value:unknown,allowedIds:Iterable<string>,allowedEvidenceIds:Iterable<string>,isCulprit:boolean,fallback:()=>DialogueReply):DialogueReply{try{return validateDialogueReply(value,allowedIds,allowedEvidenceIds,isCulprit)}catch{return fallback()}}

export function findContradictionEvidence(suspectId:string,evidence:readonly {id:string;challengeSuspectIds?:string[]}[]):string[]{return evidence.filter(item=>item.challengeSuspectIds?.includes(suspectId)).map(item=>item.id)}

export function fallbackSuspectReply(question:string,suspect:any,knowledge:any,contradictions:string[]):DialogueReply {
  const traits=(suspect.personality?.traits??[]).join(' ').toLowerCase();const candidates=[...asFacts(knowledge.direct).map(fact=>({fact,kind:'direct'})),...asFacts(knowledge.beliefs).map(fact=>({fact,kind:'belief'})),...asFacts(knowledge.hearsay).map(fact=>({fact,kind:'hearsay'})),...asFacts(suspect.statements).map(fact=>({fact,kind:'direct'}))];const tokens=question.toLowerCase().match(/[a-z0-9]{4,}/g)??[];
  const ranked=candidates.map(item=>({...item,score:tokens.filter(token=>item.fact.text.toLowerCase().includes(token)).length})).sort((a,b)=>b.score-a.score);
  const chosen=ranked[0]?.score?ranked[0].fact:undefined;
  if(contradictions.length)return {answer:chosen?`I understand why that record raises a question. What I remember is: ${chosen.text}`:`I can see why that record raises a question. I can't explain what it shows, and I don't want to guess.`,usedKnowledgeIds:chosen?[chosen.id]:[],usedEvidenceIds:contradictions,answered:Boolean(chosen)};
  if(/where|location|\bwhen\b|alibi|what time/i.test(question)){const alibi=/^i\b/i.test(suspect.alibi)?suspect.alibi:`I was ${suspect.alibi}`;const answer=/nervous|anxious|hesitant/i.test(traits)?`Um… ${alibi}`:/confident|assertive/i.test(traits)?alibi:/secretive|guarded/i.test(traits)?`I've already told you: ${alibi}`:alibi;return {answer,usedKnowledgeIds:[`alibi:${suspect.id}`],usedEvidenceIds:[],answered:true};}
  if(chosen){const kind=ranked[0].kind;const answer=kind==='belief'?`I believe ${chosen.text.charAt(0).toLowerCase()}${chosen.text.slice(1)}`:kind==='hearsay'?`I heard that ${chosen.text.charAt(0).toLowerCase()}${chosen.text.slice(1)}`:chosen.text;return {answer,usedKnowledgeIds:[chosen.id],usedEvidenceIds:[],answered:true};}
  return {answer:/secretive|guarded/i.test(traits)?`I don't know that, and I'm not going to guess.`:`I don't know enough to answer that. I can only tell you what I personally remember.`,usedKnowledgeIds:[],usedEvidenceIds:[],answered:false};
}
