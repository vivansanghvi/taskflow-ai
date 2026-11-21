'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, CalendarDays, Check, CheckCircle2, Circle, ClipboardList, Edit3, LogOut, Mic, MicOff, Plus, Search, Trash2, Volume2, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import CommandCenter from '@/components/CommandCenter';

type Task={id:string;user_id:string;title:string;description:string;priority:'low'|'medium'|'high';status:'pending'|'completed';due_at:string|null;created_at:string};
type Note={id:string;user_id:string;task_id:string|null;storage_path:string;duration_seconds:number;created_at:string};
type Tab='dashboard'|'tasks'|'voice'|'analytics';
type SpeechResult={results:ArrayLike<ArrayLike<{transcript:string}>>};
type SpeechRecognitionLike={lang:string;interimResults:boolean;onresult:((event:SpeechResult)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
const priorityOptions=['low','medium','high'] as const;
const formatDate=(s:string|null)=>s?new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No deadline';
const todayKey=()=>new Date().toLocaleDateString('en-CA');

export default function Home(){
    const [transcript, setTranscript] = useState('');
 const supabase=getSupabase();
 const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false),[authMode,setAuthMode]=useState<'signin'|'signup'>('signin');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authBusy,setAuthBusy]=useState(false);
 const [tab,setTab]=useState<Tab>('dashboard'),[tasks,setTasks]=useState<Task[]>([]),[notes,setNotes]=useState<Note[]>([]),[error,setError]=useState(''),[info,setInfo]=useState('');
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[priority,setPriority]=useState<Task['priority']>('medium'),[due,setDue]=useState('');
 const [editing,setEditing]=useState<string|null>(null),[showForm,setShowForm]=useState(false),[saving,setSaving]=useState(false),[filter,setFilter]=useState<'all'|'pending'|'completed'>('all'),[search,setSearch]=useState('');
 const [recording,setRecording]=useState(false),[recordSeconds,setRecordSeconds]=useState(0),[recordBusy,setRecordBusy]=useState(false),[listening,setListening]=useState(false),[audioUrls,setAudioUrls]=useState<Record<string,string>>({});
 const recorderRef=useRef<MediaRecorder|null>(null),streamRef=useRef<MediaStream|null>(null),chunksRef=useRef<Blob[]>([]),recordStartRef=useRef(0),speechRef=useRef<SpeechRecognitionLike|null>(null),recordTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
 const alert=(message:string)=>{setError(message);setInfo('');};
 const notify=(message:string)=>{setInfo(message);setError('');};
 const load=useCallback(async()=>{
  if(!supabase)return;
  const [t,n]=await Promise.all([supabase.from('tasks').select('*').order('created_at',{ascending:false}),supabase.from('voice_notes').select('*').order('created_at',{ascending:false})]);
  if(t.error)alert(t.error.message);else setTasks((t.data||[]) as Task[]);
  if(n.error)alert(n.error.message);else setNotes((n.data||[]) as Note[]);
 },[supabase]);
 useEffect(()=>{
  if(!supabase){setAuthReady(true);return;}
  let active=true;
  supabase.auth.getUser().then(({data})=>{if(active){setUser(data.user);setAuthReady(true);}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user??null);if(!session){setTasks([]);setNotes([]);setAudioUrls({});}}});
  return()=>{active=false;subscription.unsubscribe();};
 },[supabase]);
 useEffect(()=>{if(user)void load();},[user,load]);
 useEffect(()=>()=>{speechRef.current?.stop();if(recordTimerRef.current)clearInterval(recordTimerRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());},[]);
 const login=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase)return;setAuthBusy(true);setError('');const result=authMode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});setAuthBusy(false);if(result.error)alert(result.error.message);else if(authMode==='signup'&&!result.data.session)notify('Account created. Check your email to confirm, then sign in.');};
 const resetForm=()=>{setTitle('');setDescription('');setPriority('medium');setDue('');setEditing(null);setShowForm(false);};
 const openEdit=(task:Task)=>{setEditing(task.id);setTitle(task.title);setDescription(task.description);setPriority(task.priority);setDue(task.due_at?new Date(task.due_at).toLocaleDateString('en-CA'):'');setShowForm(true);setTab('tasks');};
 const saveTask=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase||!user||!title.trim())return;setSaving(true);setError('');const payload={title:title.trim(),description:description.trim(),priority,due_at:due?new Date(`${due}T12:00:00`).toISOString():null};const result=editing?await supabase.from('tasks').update({...payload,updated_at:new Date().toISOString()}).eq('id',editing):await supabase.from('tasks').insert({...payload,user_id:user.id,status:'pending'});setSaving(false);if(result.error)alert(result.error.message);else{resetForm();await load();notify(editing?'Task updated.':'Task created.');}};
 const toggleTask=async(t:Task)=>{if(!supabase)return;const {error:e}=await supabase.from('tasks').update({status:t.status==='pending'?'completed':'pending',updated_at:new Date().toISOString()}).eq('id',t.id);if(e)alert(e.message);else void load();};
 const deleteTask=async(t:Task)=>{if(!supabase||!window.confirm(`Delete "${t.title}"?`))return;const {error:e}=await supabase.from('tasks').delete().eq('id',t.id);if(e)alert(e.message);else void load();};
 const dictate=()=>{
  type SpeechCtor=new()=>SpeechRecognitionLike;
  const w=window as Window & {SpeechRecognition?:SpeechCtor;webkitSpeechRecognition?:SpeechCtor};const Ctor=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Ctor){alert('Speech-to-text is not available in this browser. Try Chrome or Edge, or type the task manually.');return;}
  if(listening){speechRef.current?.stop();setListening(false);return;}
  const speech=new Ctor();speech.lang='en-IN';speech.interimResults=false;
speech.onresult = (e) => {
  const transcript = Array.from(e.results)
    .map((result) => result[0].transcript)
    .join(' ')
    .trim();
setTitle(transcript);
};
  speech.onerror=()=>{setListening(false);alert('Speech recognition failed. Check microphone permission and try again.');};speech.onend=()=>setListening(false);
  speechRef.current=speech;try{speech.start();setListening(true);}catch{alert('Could not start speech recognition.');}
 };
 const startRecording=async()=>{
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){alert('Audio recording is unavailable in this browser.');return;}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});streamRef.current=stream;
   const mime=['audio/webm','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
   chunksRef.current=[];recorder.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data);};
   recorder.onstop=()=>{void uploadRecording(recorder.mimeType||mime||'audio/webm');};
   recorderRef.current=recorder;recordStartRef.current=Date.now();setRecordSeconds(0);recorder.start();setRecording(true);
   recordTimerRef.current=setInterval(()=>setRecordSeconds(Math.floor((Date.now()-recordStartRef.current)/1000)),1000);
  }catch{alert('Microphone access was denied or could not be started.');}
 };
 const stopRecording=()=>{if(!recorderRef.current||recorderRef.current.state==='inactive')return;recorderRef.current.stop();setRecording(false);if(recordTimerRef.current)clearInterval(recordTimerRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());};
 const uploadRecording=async(mime:string)=>{if(!supabase||!user)return;setRecordBusy(true);const blob=new Blob(chunksRef.current,{type:mime});if(blob.size>10*1024*1024){alert('Recording exceeds 10 MB. Please record a shorter note.');setRecordBusy(false);return;}if(!blob.size){alert('No audio captured.');setRecordBusy(false);return;}
  const ext=mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm';const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
  const uploaded=await supabase.storage.from('voice-notes').upload(path,blob,{contentType:mime,upsert:false});
  if(uploaded.error){alert(uploaded.error.message);setRecordBusy(false);return;}
  const {error:e}=await supabase.from('voice_notes').insert({user_id:user.id,storage_path:path,duration_seconds:Math.ceil((Date.now()-recordStartRef.current)/1000)});
  if(e){await supabase.storage.from('voice-notes').remove([path]);alert(e.message);}else{notify('Voice note saved privately.');await load();}setRecordBusy(false);
 };
 const playNote=async(note:Note)=>{if(!supabase)return;const {data,error:e}=await supabase.storage.from('voice-notes').createSignedUrl(note.storage_path,3600);if(e||!data){alert(e?.message||'Cannot load recording.');return;}setAudioUrls(prev=>({...prev,[note.id]:data.signedUrl}));};
 const deleteNote=async(note:Note)=>{if(!supabase||!window.confirm('Delete this recording?'))return;const removed=await supabase.storage.from('voice-notes').remove([note.storage_path]);if(removed.error){alert(removed.error.message);return;}const {error:e}=await supabase.from('voice_notes').delete().eq('id',note.id);if(e)alert(e.message);else{setAudioUrls(prev=>{const n={...prev};delete n[note.id];return n;});await load();}};
 const completed=tasks.filter(t=>t.status==='completed').length,pending=tasks.length-completed;
 const isToday=(t:Task)=>!!t.due_at&&new Date(t.due_at).toLocaleDateString('en-CA')===todayKey();
 const overdue=tasks.filter(t=>t.status==='pending'&&t.due_at&&new Date(t.due_at).toLocaleDateString('en-CA')<todayKey()).length;
 const dueToday=tasks.filter(t=>t.status==='pending'&&isToday(t)).length;
 const percentage=tasks.length?Math.round(completed/tasks.length*100):0;
 const visible=tasks.filter(t=>(filter==='all'||t.status===filter)&&`${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()));
 const taskList=(items:Task[])=><>{items.length?items.map(t=><div className="task" key={t.id}><input type="checkbox" aria-label={`Complete ${t.title}`} checked={t.status==='completed'} onChange={()=>void toggleTask(t)}/><div className="taskbody"><div className={`tasktitle ${t.status==='completed'?'done':''}`}>{t.title}</div>{t.description&&<div className="muted small">{t.description}</div>}<div className="taskmeta"><span className={`priority ${t.priority}`}>{t.priority.toUpperCase()}</span><span>📅 {formatDate(t.due_at)}</span>{t.status==='pending'&&t.due_at&&new Date(t.due_at).toLocaleDateString('en-CA')<todayKey()&&<span style={{color:'#ff9dad'}}>Overdue</span>}</div></div><button className="iconbtn" aria-label="Edit task" onClick={()=>openEdit(t)}><Edit3 size={16}/></button><button className="iconbtn" aria-label="Delete task" onClick={()=>void deleteTask(t)}><Trash2 size={16}/></button></div>):<div className="empty">No tasks here yet. Create one to get started.</div>}</>;
 if(!authReady)return <div className="loading">Loading TaskFlow AI…</div>;
 if(!supabase)return <div className="authwrap"><div className="card authcard"><div className="brand">TaskFlow <span>AI</span></div><h1>Setup required</h1><p className="muted">Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run the SQL schema. See README.md.</p></div></div>;
 if(!user)return <div className="authwrap"><form className="card authcard" onSubmit={login}><div className="brand">TaskFlow <span>AI</span></div><h1>{authMode==='signin'?'Welcome back':'Create your account'}</h1><p className="muted">Your day, organized. Your progress, visible.</p>{error&&<p className="notice" role="alert">{error}</p>}{info&&<p className="notice">{info}</p>}<div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></div><button className="button" disabled={authBusy}>{authBusy?'Please wait…':authMode==='signin'?'Sign in':'Sign up'}</button><p className="muted small" style={{textAlign:'center'}}>{authMode==='signin'?'New here?':'Already registered?'} <button type="button" className="iconbtn" onClick={()=>{setAuthMode(authMode==='signin'?'signup':'signin');setError('');setInfo('');}}>{authMode==='signin'?'Create an account':'Sign in'}</button></p></form></div>;
 return <div className="app"><aside className="sidebar"><div className="brand">✦ TaskFlow <span>AI</span></div><div className="nav">{([['dashboard',Activity,'Dashboard'],['tasks',ClipboardList,'My Tasks'],['voice',Mic,'Voice Notes'],['analytics',CalendarDays,'Analytics']] as const).map(([key,Icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon size={17} style={{verticalAlign:'middle',marginRight:9}}/>{label}</button>)}</div><div className="sidefoot"><div>{user.email}</div><button className="iconbtn" onClick={()=>void supabase.auth.signOut()}><LogOut size={15} style={{verticalAlign:'middle'}}/> Sign out</button><p>Built with Next.js + Supabase</p></div></aside><main className="main"><div className="top"><div><div className="eyebrow">Your productivity workspace</div><h1>{tab==='dashboard'?'Good to see you 👋':tab==='tasks'?'My Tasks':tab==='voice'?'Voice Notes':'Productivity Analytics'}</h1><div className="muted">{tab==='dashboard'?`Here's your overview for ${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}`:'Stay focused, one step at a time.'}</div></div><button className="button" onClick={()=>{resetForm();setShowForm(true);setTab('tasks');}}><Plus size={17}/> New task</button></div>
 {error&&<div className="notice" role="alert">{error} <button className="iconbtn" onClick={()=>setError('')}><X size={14}/></button></div>}{info&&<div className="notice">{info} <button className="iconbtn" onClick={()=>setInfo('')}><X size={14}/></button></div>}
 {tab==='dashboard'&&<><CommandCenter
  total={tasks.length}
  completed={completed}
  pending={pending}
  onCreateTask={() => {
    resetForm();
    setShowForm(true);
    setTab('tasks');
  }}
/><div className="stats">{[[ClipboardList,'Total Tasks',tasks.length],[Circle,'Pending',pending],[CheckCircle2,'Completed',completed],[CalendarDays,'Due Today',dueToday]].map(([Icon,label,num],i)=>{const I=Icon as typeof ClipboardList;return <div className="card" key={i}><I className="stat-icon" size={21}/><div className="stat-number">{num as number}</div><div className="stat-label">{label as string}</div></div>;})}</div><div className="banner"><h2>Keep the momentum going ✨</h2><p>You've completed {completed} of {tasks.length} tasks. {overdue?`${overdue} overdue task(s) need attention.`:'Focus on what matters most today.'}</p><div className="progress"><div style={{width:`${percentage}%`}}/></div><div className="small" style={{marginTop:8}}>{percentage}% complete</div></div><div className="contentgrid"><section className="card"><div className="sectionhead"><h2>Recent tasks</h2><button className="chip" onClick={()=>setTab('tasks')}>View all</button></div>{taskList(tasks.slice(0,6))}</section><section className="card"><h2>Quick capture</h2><p className="muted">Turn your thoughts into tasks with your voice.</p><button className="button" onClick={()=>{setTab('tasks');setShowForm(true);setTimeout(dictate,0);}}><Mic size={17}/> Dictate a task</button><hr style={{borderColor:'var(--line)',margin:'24px 0'}}/><h2>Audio notes</h2><p className="muted">Save spoken ideas and play them back later.</p><button className="button secondary" onClick={()=>setTab('voice')}><Volume2 size={17}/> Open recorder</button></section></div></>}
 {tab==='tasks'&&<div className="contentgrid"><section className="card"><div className="sectionhead"><h2>All tasks ({visible.length})</h2></div><div className="field"><input className="search" aria-label="Search tasks" placeholder="Search your tasks…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filters" style={{marginBottom:12}}>{(['all','pending','completed'] as const).map(f=><button key={f} className={`chip ${filter===f?'selected':''}`} onClick={()=>setFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div>{taskList(visible)}</section><section className="card"><div className="sectionhead"><h2>{editing?'Edit task':'Create a task'}</h2>{showForm&&<button className="iconbtn" onClick={resetForm}><X size={17}/></button>}</div>{showForm?<form onSubmit={saveTask}><div className="field"><label htmlFor="tasktitle">Task title</label><input id="tasktitle" required maxLength={200} placeholder="What needs to be done?" value={title} onChange={e=>setTitle(e.target.value)}/></div><button type="button" className="button secondary" onClick={dictate}><Mic size={17}/>{listening?'Stop listening':'Speak task'}</button><div className="field"><label htmlFor="desc">Description</label><textarea id="desc" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optional details"/></div><div className="field"><label htmlFor="priority">Priority</label><select id="priority" value={priority} onChange={e=>setPriority(e.target.value as Task['priority'])}>{priorityOptions.map(p=><option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select></div><div className="field"><label htmlFor="due">Due date</label><input id="due" type="date" value={due} onChange={e=>setDue(e.target.value)}/></div><button className="button" disabled={saving} style={{width:'100%'}}><Check size={17}/>{saving?'Saving…':editing?'Save changes':'Add task'}</button></form>:<div className="empty"><Search size={28}/><p>Ready to plan something?</p><button className="button" onClick={()=>setShowForm(true)}><Plus size={17}/> Add task</button></div>}</section></div>}
 {tab==='voice'&&<div className="contentgrid"><section className="card"><h2>Record a voice note</h2><p className="muted">Capture ideas hands-free. Recordings are saved in private cloud storage (maximum 10 MB per note).</p><div style={{padding:'32px 0',textAlign:'center'}}><div style={{fontSize:38,marginBottom:12}}>🎙️</div><h2>{recording?`Recording… ${recordSeconds}s`:'Ready to record'}</h2><button className={`button ${recording?'danger':''}`} disabled={recordBusy} onClick={()=>recording?stopRecording():void startRecording()}>{recording?<MicOff size={17}/>:<Mic size={17}/>} {recordBusy?'Saving…':recording?'Stop & save':'Start recording'}</button></div></section><section className="card"><h2>Saved recordings ({notes.length})</h2>{notes.length?notes.map((n,i)=><div className="note" key={n.id}><div><strong>Voice note {notes.length-i}</strong><div className="muted small">{new Date(n.created_at).toLocaleString()} · {n.duration_seconds}s</div>{audioUrls[n.id]&&<audio controls src={audioUrls[n.id]} style={{width:'100%',maxWidth:230,marginTop:7}}/>}</div><div><button className="iconbtn" title="Play" aria-label="Play recording" onClick={()=>void playNote(n)}><Volume2 size={18}/></button><button className="iconbtn" title="Delete" aria-label="Delete recording" onClick={()=>void deleteNote(n)}><Trash2 size={18}/></button></div></div>):<div className="empty">No recordings yet.</div>}</section></div>}
 {tab==='analytics'&&<><div className="stats">{[['Completion rate',`${percentage}%`],['Completed',completed],['Pending',pending],['Overdue',overdue]].map(([label,value])=><div className="card" key={label}><div className="stat-label">{label}</div><div className="stat-number">{value}</div></div>)}</div><div className="contentgrid"><section className="card"><h2>Tasks by priority</h2>{priorityOptions.map(p=>{const count=tasks.filter(t=>t.priority===p).length;return <div className="chartbar" key={p}><span>{p[0].toUpperCase()+p.slice(1)}</span><div className="progress"><div style={{width:`${tasks.length?count/tasks.length*100:0}%`}}/></div><strong>{count}</strong></div>;})}</section><section className="card"><h2>Your progress</h2><p className="muted">Overall completion rate</p><div className="stat-number">{percentage}%</div><div className="progress"><div style={{width:`${percentage}%`}}/></div><p className="muted small">{completed} completed out of {tasks.length} tasks</p></section></div></>}
 </main></div>;
}
