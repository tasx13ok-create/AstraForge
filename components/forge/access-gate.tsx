'use client';

import {FormEvent,useEffect,useState} from 'react';
import Workspace from '@/components/forge/workspace';

type State='checking'|'authenticated'|'login'|'error';

export default function AccessGate(){
 const [state,setState]=useState<State>('checking');
 const [token,setToken]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);

 useEffect(()=>{
  let active=true;
  fetch('/api/auth',{cache:'no-store',credentials:'include'})
   .then(async response=>{
    if(!active)return;
    if(response.ok){setState('authenticated');return;}
    if(response.status===401){setState('login');return;}
    const data=await response.json().catch(()=>({}));
    setMessage(typeof data.error==='string'?data.error:'AstraForge authentication is unavailable.');
    setState('error');
   })
   .catch(()=>{
    if(active){setMessage('AstraForge could not reach its production API.');setState('error');}
   });
  return()=>{active=false;};
 },[]);

 async function submit(event:FormEvent){
  event.preventDefault();
  if(!token||busy)return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/auth',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    body:JSON.stringify({token})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Access denied.');
   setToken('');
   setState('authenticated');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Access denied.');
  }finally{setBusy(false);}
 }

 if(state==='authenticated')return <Workspace/>;

 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#07090d',color:'#f5f7fb',padding:'24px',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}}>
  <section style={{width:'min(440px,100%)',border:'1px solid rgba(255,255,255,.12)',borderRadius:24,background:'rgba(17,20,27,.86)',boxShadow:'0 24px 80px rgba(0,0,0,.45)',padding:28,backdropFilter:'blur(20px)'}}>
   <div style={{fontSize:12,letterSpacing:'.16em',textTransform:'uppercase',color:'#8f9bad',marginBottom:12}}>AstraForge</div>
   <h1 style={{fontSize:28,lineHeight:1.1,margin:'0 0 10px'}}>Private operator workspace</h1>
   {state==='checking'&&<p style={{margin:0,color:'#aeb7c5'}}>Connecting to the production runtime…</p>}
   {state==='error'&&<>
    <p style={{color:'#ffb4b4',lineHeight:1.5}}>{message}</p>
    <button type="button" onClick={()=>location.reload()} style={{width:'100%',border:0,borderRadius:14,padding:'12px 16px',fontWeight:700,cursor:'pointer'}}>Retry</button>
   </>}
   {state==='login'&&<form onSubmit={submit}>
    <p style={{margin:'0 0 18px',color:'#aeb7c5',lineHeight:1.5}}>Enter the private AstraForge access token configured on the server. It is exchanged for an HttpOnly session cookie and is not saved by this page.</p>
    <label style={{display:'grid',gap:8,fontSize:13,color:'#cbd3df'}}>
     Access token
     <input type="password" autoComplete="current-password" value={token} onChange={event=>setToken(event.target.value)} disabled={busy} style={{width:'100%',boxSizing:'border-box',border:'1px solid rgba(255,255,255,.14)',borderRadius:14,background:'#0d1118',color:'#fff',padding:'12px 14px',outline:'none'}}/>
    </label>
    {message&&<p role="alert" style={{color:'#ffb4b4',fontSize:13}}>{message}</p>}
    <button type="submit" disabled={busy||!token} style={{width:'100%',marginTop:16,border:0,borderRadius:14,padding:'12px 16px',fontWeight:800,cursor:busy?'wait':'pointer',opacity:busy||!token?.55:1}}>
     {busy?'Verifying…':'Open AstraForge'}
    </button>
   </form>}
  </section>
 </main>;
}
