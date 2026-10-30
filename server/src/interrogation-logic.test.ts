import assert from 'node:assert/strict';
import test from 'node:test';
import { compactInterviewSummary, fallbackSuspectReply, findContradictionEvidence, projectInterviewState, validateDialogueReply, validateInterviewAssist, validateOrFallbackDialogue } from './interrogation-logic.js';

const suspect={id:'s2',name:'Mara Vale',alibi:'I was in the west gallery with the caterers.',isCulprit:false};

test('a non-culprit cannot be turned into the culprit by generated dialogue',()=>{
  assert.throws(()=>validateDialogueReply({answer:'I stole the diamond and hid it.',usedKnowledgeIds:[],usedEvidenceIds:[],answered:true},[],[],false),/non-culprit/);
});

test('dialogue disclosures must refer to established knowledge IDs',()=>{
  assert.throws(()=>validateDialogueReply({answer:'I was near the west gallery.',usedKnowledgeIds:['invented-fact'],usedEvidenceIds:[],answered:true},['k1'],[],false),/unknown knowledge/);
  assert.throws(()=>validateDialogueReply({answer:'I do not know.',usedKnowledgeIds:['k1'],usedEvidenceIds:[],answered:false},['k1'],[],false),/unanswered response/);
});

test('answers cannot cite evidence that was not presented',()=>{
  assert.throws(()=>validateDialogueReply({answer:'The register shows you left early.',usedKnowledgeIds:[],usedEvidenceIds:['e-private'],answered:true},[],['e-presented'],false),/not presented/);
});

test('invalid model output uses a safe fallback instead of being stored',()=>{
  const safe={answer:'I do not know enough to answer.',usedKnowledgeIds:[],usedEvidenceIds:[],answered:false};
  const result=validateOrFallbackDialogue({answer:'An invented detail.',usedKnowledgeIds:['made-up'],usedEvidenceIds:[],answered:true},['k1'],[],false,()=>safe);
  assert.deepEqual(result,safe);
});

test('only case evidence explicitly linked to a suspect becomes a contradiction',()=>{
  const evidence=[{id:'e1',challengeSuspectIds:['s2']},{id:'e2',challengeSuspectIds:['s1']},{id:'e3'}];
  assert.deepEqual(findContradictionEvidence('s2',evidence),['e1']);
});

test('fallback preserves the established alibi rather than inventing a new one',()=>{
  const reply=fallbackSuspectReply('Where were you at 9 PM?',suspect,{direct:[],hiddenSecrets:[{id:'secret1',text:'I have unpaid debts.'}]},[]);
  assert.equal(reply.answer,'I was in the west gallery with the caterers.');
  assert.equal(reply.answered,true);
  assert.deepEqual(reply.usedKnowledgeIds,['alibi:s2']);
});

test('out-of-knowledge questions receive a clear bounded answer',()=>{
  const reply=fallbackSuspectReply('What did the security guard dream about?',suspect,{direct:[],beliefs:[],hearsay:[],hiddenSecrets:[]},[]);
  assert.equal(reply.answered,false);
  assert.match(reply.answer,/don't know enough/);
  assert.deepEqual(reply.usedKnowledgeIds,[]);
});

test('evidence changes the reaction without changing the suspect alibi',()=>{
  const reply=fallbackSuspectReply('Where were you?',suspect,{direct:[]},['e-location']);
  assert.match(reply.answer,/raises a question/);
  assert.doesNotMatch(reply.answer,/confess|stole|guilty/i);
  assert.deepEqual(reply.usedKnowledgeIds,[]);
});

test('personality affects delivery while leaving the established alibi unchanged',()=>{
  const nervous=fallbackSuspectReply('Where were you?',{...suspect,personality:{traits:['nervous'],communicationStyle:'hesitant',temperament:'anxious'}},{direct:[]},[]);
  const confident=fallbackSuspectReply('Where were you?',{...suspect,personality:{traits:['confident'],communicationStyle:'direct',temperament:'steady'}},{direct:[]},[]);
  assert.match(nervous.answer,/Um/);
  assert.match(confident.answer,/^I was in the west gallery/);
  assert.match(nervous.answer,/west gallery with the caterers/);
  assert.match(confident.answer,/west gallery with the caterers/);
});

test('saved interview history is projected without private suspect or solution fields',()=>{
  const stored={suspectId:'s2',privateNotes:'hidden',isCulprit:true,turns:[{question:'Where were you?',answer:'In the west gallery.',askedAt:new Date('2026-10-30T10:00:00Z'),presentedEvidenceIds:['e1'],usedEvidenceIds:['e1'],contradictionEvidenceIds:['e1'],disclosedKnowledgeIds:['alibi:s2'],answered:true}],questionsAsked:['Where were you?'],presentedEvidenceIds:['e1'],contradictionEvidenceIds:['e1'],disclosedKnowledgeIds:['alibi:s2'],unansweredQuestions:[]};
  const projected=projectInterviewState('s2',stored);
  assert.equal(projected.turns.length,1);
  assert.equal(projected.turns[0].askedAt,'2026-10-30T10:00:00.000Z');
  assert.deepEqual(projected.turns[0].usedEvidenceIds,['e1']);
  assert.equal('privateNotes' in projected,false);
  assert.equal('isCulprit' in projected,false);
});

test('interrogation assistant suggestions can cite only discovered evidence',()=>{
 const suggestion={message:'The two statements place the suspect at different locations.',questions:['Which location can be independently confirmed?'],evidenceIds:['e-found']};
 assert.equal(validateInterviewAssist(suggestion,['e-found']).evidenceIds[0],'e-found');
 assert.throws(()=>validateInterviewAssist({...suggestion,evidenceIds:['e-secret']},['e-found']),/not been discovered/);
});

test('long interview history gets a bounded rolling summary',()=>{
 let summary='';for(let index=0;index<40;index++)summary=compactInterviewSummary(summary,{question:`Question ${index} about the event`,answer:`Answer ${index} using established facts`,usedKnowledgeIds:[`fact-${index}`],presentedEvidenceIds:[]});
 assert.ok(summary.length<=1400);assert.match(summary,/Question 39/);assert.doesNotMatch(summary,/Question 0/);
});
