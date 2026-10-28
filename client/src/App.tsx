import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clipboard, Clock3, Copy, Eye, FileSearch, Fingerprint, LockKeyhole, MessageSquareText, Plus, Search, Shield, Sparkles, UserRound, Video, X } from 'lucide-react';
import { accuse, createMystery, discoverEvidence, getMysteries, getMystery, getResults } from './api';
import type { CaseFile, Evidence, Result, Suspect } from './types';

function Shell({ children }: { children: ReactNode }) { return <div className="app-shell"><header className="topbar"><Link to="/" className="brand"><span className="brand-mark"><Fingerprint size={19}/></span><span>CASEFILE<span className="brand-dot">.</span></span></Link><div className="topbar-right"><Link className="nav-link explore-nav" to="/explore">Explore cases</Link><span className="secure-label"><LockKeyhole size={13}/> FICTIONAL INVESTIGATION</span><Link className="nav-link" to="/create">New case <Plus size={15}/></Link></div></header>{children}<footer className="footer"><span>CASEFILE — AI Mystery Room</span><span>All investigations are fictional entertainment.</span></footer></div> }
function Landing() { return <Shell><main className="landing"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> YOUR NEXT CASE IS WAITING</div><h1>Every detail<br/>hides <em>something.</em></h1><p className="hero-text">Step into an investigation built around your idea. Read the statements. Follow the evidence. Decide who did it.</p><div className="hero-actions"><Link className="button button-primary" to="/create">Create a case <ArrowRight size={17}/></Link><a className="text-link" href="#how">How it works <ChevronRight size={15}/></a></div><div className="hero-meta"><span><Shield size={14}/> Fictional cases</span><span><Eye size={14}/> You lead the investigation</span></div></div><div className="case-art" aria-label="Illustration of an investigation case file"><div className="art-grid"/><div className="folder"><div className="folder-tab"/><div className="folder-inner"><div className="stamp">OPEN CASE</div><div className="folder-line long"/><div className="folder-line medium"/><div className="folder-line short"/><div className="folder-photo"><span className="photo-silhouette"/></div><div className="red-string string-one"/><div className="red-string string-two"/><div className="pin pin-one"/><div className="pin pin-two"/></div></div><div className="art-caption"><span>CASE NO. 001</span><span>UNSOLVED · 23:41</span></div><div className="floating-note"><span className="note-icon"><MessageSquareText size={16}/></span><span><strong>Evidence found</strong><small>A detail doesn't add up</small></span><span className="note-count">03</span></div></div></section><section className="how-section" id="how"><div><div className="eyebrow">THE INVESTIGATION</div><h2>Three steps to the truth.</h2></div><div className="steps"><article><span className="step-number">01</span><Sparkles size={19}/><h3>Set the scene</h3><p>Start with a premise. Choose the case details you want to explore.</p></article><article><span className="step-number">02</span><FileSearch size={19}/><h3>Follow the evidence</h3><p>Review statements, messages, timelines, and suspicious details.</p></article><article><span className="step-number">03</span><Fingerprint size={19}/><h3>Make your call</h3><p>Name your suspect, then see how the clues fit together.</p></article></div></section><section className="disclaimer"><Shield size={16}/><span>Every case is fictional and created for entertainment. No real people or events are represented.</span></section></main></Shell> }

function ExplorePage(){const[cases,setCases]=useState<{id:string;title:string;category:string;difficulty:string;createdAt:string;accused:boolean}[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');useEffect(()=>{getMysteries().then(r=>setCases(r.cases)).catch(e=>setError(e instanceof Error?e.message:'Could not load saved cases.')).finally(()=>setLoading(false))},[]);return <Shell><main className="explore-page"><div className="eyebrow">YOUR CASE ARCHIVE</div><h1>Saved investigations.</h1><p className="explore-intro">Pick up where you left off. Each case is private to this browser session.</p>{loading?<div className="center-inline"><span className="spinner"/> Loading your case files…</div>:error?<div className="error-box">{error}</div>:cases.length===0?<div className="empty-archive"><span className="empty-icon"><FileSearch size={24}/></span><h2>No cases on file.</h2><p>Start an investigation and it will be saved here for you.</p><Link to="/create" className="button button-primary">Create a case <ArrowRight size={16}/></Link></div>:<div className="archive-grid">{cases.map(c=><Link className="archive-card" to={c.accused?`/mystery/${c.id}/results`:`/mystery/${c.id}`} key={c.id}><div className="archive-card-top"><span className="eyebrow">CASE {c.id.slice(-6).toUpperCase()}</span><span className={`status-pill ${c.accused?'closed':''}`}>{c.accused?'CASE CLOSED':'IN PROGRESS'}</span></div><h2>{c.title}</h2><p>{c.category} <span>·</span> {c.difficulty}</p><div className="archive-card-bottom"><span>{new Date(c.createdAt).toLocaleDateString()}</span><ArrowRight size={15}/></div></Link>)}</div>}</main></Shell>}
const evidenceOptions = [
  { id: 'chat', label: 'Messages', required: true },
  { id: 'cctv', label: 'CCTV simulation', required: true },
  { id: 'witness', label: 'Witnesses', required: true },
  { id: 'physical', label: 'Physical clues', required: true },
  { id: 'timeline', label: 'Timeline' },
  { id: 'document', label: 'Documents' },
  { id: 'call-log', label: 'Call logs' },
  { id: 'image', label: 'Images' },
];

function CreatePage() {
  const navigate = useNavigate();
  const [scenario, setScenario] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [category, setCategory] = useState('Suspicious incident');
  const length = 'Standard';
  const [evidenceTypes, setEvidenceTypes] = useState(['chat', 'cctv', 'witness', 'physical', 'timeline']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('Building the case outline…');
  const [clipboardMessage, setClipboardMessage] = useState('');

  const pasteScenario = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setClipboardMessage('Your clipboard is empty.');
        return;
      }
      setScenario(current => `${current}${current ? '\n' : ''}${text}`.slice(0, 3000));
      setClipboardMessage('Pasted from clipboard.');
    } catch {
      setClipboardMessage('Clipboard access was blocked. Click the scenario box and press Ctrl+V.');
    }
  };

  const copyScenario = async () => {
    try {
      await navigator.clipboard.writeText(scenario);
      setClipboardMessage('Scenario copied.');
    } catch {
      setClipboardMessage('Clipboard access was blocked. Select the scenario text and press Ctrl+C.');
    }
  };

  const toggleEvidence = (id: string) => {
    if (['chat', 'cctv', 'witness', 'physical'].includes(id)) return;
    setEvidenceTypes(current => current.includes(id) ? current.filter(type => type !== id) : [...current, id]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    setProgress('Establishing the canonical truth…');
    try {
      const { id } = await createMystery({ scenario, difficulty, category, length, evidenceTypes });
      let ready = false;
      for (let i = 0; i < 90; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const mystery = await getMystery(id);
          if (mystery.status === 'ready') { ready = true; break; }
        } catch (requestError) {
          if (i > 2) throw requestError;
        }
        setProgress(['Connecting the clues…', 'Preparing statements and evidence…', 'Checking the case for consistency…'][i % 3]);
      }
      if (!ready) throw new Error('Generation is taking longer than expected. Your case may still be processing; try opening it again shortly.');
      navigate(`/mystery/${id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create your case.');
      setBusy(false);
    }
  };

  return <Shell><main className="form-page">
    <Link to="/" className="back-link"><ArrowLeft size={15}/> Back to briefing</Link>
    <div className="page-heading"><div className="eyebrow">NEW INVESTIGATION · 01 / 02</div><h1>Set the scene.</h1><p>Give us a starting point. The details of the case will take shape from there.</p></div>
    <form className="case-form" onSubmit={submit}>
      <div className="scenario-label-row"><label className="field-label" htmlFor="scenario">YOUR SCENARIO <span>REQUIRED</span></label><div className="clipboard-actions"><button type="button" onClick={pasteScenario}><Clipboard size={13}/> Paste</button><button type="button" onClick={copyScenario} disabled={!scenario}><Copy size={13}/> Copy</button></div></div>
      <textarea id="scenario" required maxLength={3000} minLength={20} value={scenario} onChange={event => setScenario(event.target.value)} placeholder="A rare book vanished from a locked archive during a storm. Three people had a reason to be there…"/>
      <div className="textarea-meta"><span>{clipboardMessage || 'Keep it fictional. We’ll build the investigation around your idea.'}</span><span>{scenario.length} / 3000</span></div>
      <div className="form-grid">
        <label>CASE TYPE<select value={category} onChange={event => setCategory(event.target.value)}>{['Theft','Murder mystery','Missing person','Corporate investigation','Historical mystery','Suspicious incident','General mystery'].map(option => <option key={option}>{option}</option>)}</select></label>
        <label>DIFFICULTY<select value={difficulty} onChange={event => setDifficulty(event.target.value)}>{['Easy','Medium','Hard','Expert'].map(option => <option key={option}>{option}</option>)}</select></label>
        <label>SUSPECT COUNT<select value="4 suspects" disabled aria-label="Four suspects are included in every investigation"><option>4 suspects</option></select></label>
      </div>
      <div className="evidence-prefs"><div><span className="field-label">EVIDENCE IN THIS CASE</span><p>Messages, CCTV, witnesses, and physical clues are included in every case.</p></div><div className="chips">{evidenceOptions.map(option => <button key={option.id} type="button" className={`evidence-chip ${evidenceTypes.includes(option.id) || option.required ? 'selected' : ''}`} aria-pressed={evidenceTypes.includes(option.id) || Boolean(option.required)} disabled={option.required} onClick={() => toggleEvidence(option.id)}>{option.id === 'chat' ? <MessageSquareText size={13}/> : option.id === 'cctv' ? <Video size={13}/> : option.id === 'witness' ? <UserRound size={13}/> : option.id === 'timeline' ? <Clock3 size={13}/> : option.id === 'physical' ? <Fingerprint size={13}/> : <FileSearch size={13}/>} {option.label}{option.required ? ' · required' : ''}</button>)}</div></div>
      {error && <div className="error-box"><X size={16}/>{error}</div>}
      <button className="button button-primary submit-button" type="submit" disabled={busy || scenario.trim().length < 20}>{busy ? <><span className="spinner"/>{progress}</> : <>Build this case <ArrowRight size={17}/></>}</button>
      <p className="form-footnote"><LockKeyhole size={13}/> The solution stays sealed until you submit your accusation.</p>
    </form>
  </main></Shell>;
}
function EvidenceIcon({type}:{type:string}) { const t=type.toLowerCase();if(t.includes('chat'))return <MessageSquareText size={15}/>;if(t.includes('cctv'))return <Video size={15}/>;if(t.includes('witness'))return <UserRound size={15}/>;if(t.includes('timeline'))return <Clock3 size={15}/>;return <Fingerprint size={15}/> }
function CctvFrames({ evidence }: { evidence: Evidence }) {
  const frames = evidence.details?.frames;
  if (!Array.isArray(frames)) return null;
  return <div className="cctv-viewer"><div className="cctv-screen"><span className="cctv-rec"><i/> REC · SIMULATED</span><span className="cctv-camera">CAM 04 · {String(evidence.details?.location || 'LOCATION ON FILE')}</span><div className="cctv-crosshair">⌖</div><small>SIMULATED STILL FRAME SEQUENCE</small></div><div className="cctv-frames">{frames.map((frame: unknown, index: number) => { const item = frame as { time?: unknown; observation?: unknown }; return <article className="cctv-frame" key={`${String(item.time ?? 'frame')}-${index}`}><time>{String(item.time ?? 'Timestamp unavailable')}</time><p>{String(item.observation ?? 'No observation recorded.')}</p></article>; })}</div></div>;
}
function CasePage() { const {id=''}=useParams();const navigate=useNavigate();const [data,setData]=useState<CaseFile|null>(null);const [selected,setSelected]=useState<Evidence|null>(null);const [suspect,setSuspect]=useState<Suspect|null>(null);const [error,setError]=useState('');const [submitting,setSubmitting]=useState(false);const [confirm,setConfirm]=useState(false);
 useEffect(()=>{getMystery(id).then(c=>{setData(c);if(c.status==='accused')navigate(`/mystery/${id}/results`,{replace:true})}).catch(e=>setError(e.message))},[id,navigate]);
 const openEvidence=async(item:Evidence)=>{setSelected(item);if(!item.discovered){try{await discoverEvidence(id,item.id);setData(current=>current?{...current,evidence:current.evidence.map(e=>e.id===item.id?{...e,discovered:true}:e)}:current)}catch(e){setError(e instanceof Error?e.message:'Unable to save progress')}}};
 const submit=async()=>{if(!suspect)return;setSubmitting(true);setError('');try{await accuse(id,suspect.id);navigate(`/mystery/${id}/results`)}catch(e){setError(e instanceof Error?e.message:'Accusation could not be submitted.')}finally{setSubmitting(false);setConfirm(false)}};
 if(error&&!data)return <Shell><main className="center-state"><div className="empty-icon"><Search/></div><h2>Case file unavailable</h2><p>{error}</p><Link className="button button-primary" to="/create">Start a new case</Link></main></Shell>;if(!data)return <Shell><main className="center-state"><span className="spinner"/><p>Opening the case file…</p></main></Shell>;
 const discovered=data.evidence.filter(e=>e.discovered).length;
 return <Shell><main className="investigation"><div className="case-title-row"><div><div className="eyebrow"><span className="live-dot"/> ACTIVE INVESTIGATION <span className="divider">/</span> CASE {data.id.slice(-6).toUpperCase()}</div><h1>{data.title}</h1><p>{data.category} <span>·</span> {data.difficulty} <span>·</span> FICTIONAL CASE</p></div><div className="progress-card"><span>INVESTIGATION PROGRESS</span><strong>{discovered}<small> / {data.evidence.length} evidence reviewed</small></strong><div className="progress-track"><i style={{width:`${data.evidence.length?discovered/data.evidence.length*100:0}%`}}/></div></div></div><div className="case-intro"><span className="intro-label">CASE BRIEF</span><p>{data.introduction}</p></div><div className="investigation-grid"><aside className="side-column"><section className="panel"><div className="panel-title"><span>PERSONS OF INTEREST</span><span className="count">{data.suspects.length}</span></div><div className="suspect-list">{data.suspects.map((s,i)=><button className={`suspect-item ${suspect?.id===s.id?'selected':''}`} key={s.id} onClick={()=>setSuspect(s)}><span className="avatar">{s.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><span className="suspect-info"><strong>{s.name}</strong><small>{s.occupation}</small></span><ChevronRight size={15}/></button>)}</div></section><section className="panel"><div className="panel-title"><span>CASE TIMELINE</span><Clock3 size={14}/></div><div className="timeline-list">{data.timeline.map((event,i)=><div className="timeline-event" key={i}><span className="timeline-dot"/><time>{event.time}</time><p>{event.event}</p></div>)}</div></section></aside><section className="panel evidence-panel"><div className="panel-title"><span>CASE EVIDENCE</span><span className="count">{data.evidence.length} ITEMS</span></div><div className="evidence-list">{data.evidence.map(item=><button key={item.id} className={`evidence-row ${selected?.id===item.id?'active':''}`} onClick={()=>openEvidence(item)}><span className="evidence-icon"><EvidenceIcon type={item.type}/></span><span className="evidence-copy"><small>{item.type.toUpperCase()}{item.timestamp?` · ${item.timestamp}`:''}</small><strong>{item.title}</strong></span>{item.discovered?<span className="reviewed"><Check size={13}/> REVIEWED</span>:<span className="new-tag">NEW</span>}<ChevronRight size={15}/></button>)}</div>{selected&&<div className="evidence-detail"><div className="detail-head"><span><EvidenceIcon type={selected.type}/> EVIDENCE DETAIL</span><button onClick={()=>setSelected(null)} aria-label="Close evidence"><X size={16}/></button></div><h3>{selected.title}</h3><p>{selected.description}</p><CctvFrames evidence={selected}/>{selected.type.toLowerCase().includes('cctv')&&<div className="simulation-label"><Video size={14}/> SIMULATED CCTV OBSERVATION · NO ACTUAL FOOTAGE</div>}{selected.type.toLowerCase().includes('chat')&&Array.isArray(selected.details?.messages)&&<><div className="simulation-label"><MessageSquareText size={14}/> FICTIONAL WHATSAPP-STYLE TRANSCRIPT</div><div className="chat-messages">{(selected.details.messages as {sender:string;text:string;time?:string}[]).map((m,i)=><div className="chat-message" key={i}><small>{m.sender} · {m.time}</small><p>{m.text}</p></div>)}</div></>}</div>}</section></div>{suspect&&<section className="suspect-detail panel"><div><div className="eyebrow">PERSON OF INTEREST</div><h3>{suspect.name} <span>· {suspect.age||'Age undisclosed'}</span></h3><p>{suspect.biography}</p></div><div className="suspect-facts"><div><small>RELATIONSHIP</small><span>{suspect.relationship}</span></div><div><small>POSSIBLE MOTIVE</small><span>{suspect.motive}</span></div><div><small>STATED ALIBI</small><span>{suspect.alibi}</span></div></div></section>}<div className="accusation-bar"><div><span className="eyebrow">WHEN YOU’RE READY</span><strong>{suspect?`Accuse ${suspect.name}?`:'Select a person of interest to make an accusation.'}</strong></div><button className="button button-primary" disabled={!suspect} onClick={()=>setConfirm(true)}>Submit accusation <ArrowRight size={16}/></button></div>{error&&<div className="error-box">{error}</div>}{confirm&&suspect&&<div className="modal-backdrop"><section className="confirm-modal"><button className="modal-close" onClick={()=>setConfirm(false)}><X/></button><div className="modal-icon"><Fingerprint/></div><div className="eyebrow">FINAL ACCUSATION</div><h2>Name {suspect.name}?</h2><p>This is your final answer for this case. The full solution will be revealed after you submit.</p><div className="modal-actions"><button className="button button-muted" onClick={()=>setConfirm(false)}>Review the evidence</button><button className="button button-primary" disabled={submitting} onClick={submit}>{submitting?'Submitting…':'Confirm accusation'} <ArrowRight size={15}/></button></div></section></div>}</main></Shell> }
function ResultsPage() { const {id=''}=useParams();const [result,setResult]=useState<Result|null>(null);const [error,setError]=useState('');useEffect(()=>{getResults(id).then(setResult).catch(e=>setError(e.message))},[id]);if(error)return <Shell><main className="center-state"><h2>Solution still sealed</h2><p>{error}</p><Link to={`/mystery/${id}`} className="button button-primary">Return to case</Link></main></Shell>;if(!result)return <Shell><main className="center-state"><span className="spinner"/><p>Unsealing the case notes…</p></main></Shell>;return <Shell><main className="results-page"><div className="result-banner"><div className={`result-seal ${result.correct?'correct':''}`}><Fingerprint size={27}/></div><div><div className="eyebrow">CASE CLOSED · FINAL FINDINGS</div><h1>{result.correct?'Your instincts were right.':'A different story was hiding in plain sight.'}</h1><p>{result.correct?'You identified the person responsible.':'Your accusation did not match the evidence. Here is what happened.'}</p></div></div><section className="culprit-card"><div className="eyebrow">THE PERSON RESPONSIBLE</div><h2>{result.culprit}</h2><p>{result.motive}</p></section><div className="results-grid"><section className="panel result-panel"><div className="panel-title">HOW THE CLUES CONNECT</div><p>{result.explanation}</p><h3>Decisive evidence</h3>{result.decisiveClues.map((x,i)=><div className="clue-line" key={i}><span>{String(i+1).padStart(2,'0')}</span>{x}</div>)}<h3>Misleading details</h3>{result.misleadingClues.map((x,i)=><div className="clue-line muted-clue" key={i}><span>↳</span>{x}</div>)}</section><section className="panel result-panel"><div className="panel-title">RECONSTRUCTED TIMELINE</div><div className="timeline-list">{result.timeline.map((x,i)=><div className="timeline-event" key={i}><span className="timeline-dot"/><time>{x.time}</time><p>{x.event}</p></div>)}</div><h3>Why not the others?</h3>{result.alternatives.map((x,i)=><p className="alternative" key={i}>{x}</p>)}</section></div><div className="result-actions"><Link to="/create" className="button button-primary">Open another case <ArrowRight size={16}/></Link><Link to={`/mystery/${id}`} className="text-link">Review the evidence <ArrowLeft size={15}/></Link></div></main></Shell> }
export default function App(){return <Routes><Route path="/" element={<Landing/>}/><Route path="/create" element={<CreatePage/>}/><Route path="/explore" element={<ExplorePage/>}/><Route path="/mystery/:id" element={<CasePage/>}/><Route path="/mystery/:id/results" element={<ResultsPage/>}/><Route path="*" element={<Landing/>}/></Routes>}
