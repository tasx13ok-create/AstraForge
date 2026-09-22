import {actor,body,connection,fail} from '@/lib/server';
import {readProviderError} from '@/lib/provider-errors';
export async function POST(req:Request){try{
 const owner=await actor(req),b=await body(req);if(!['openai','browserbase'].includes(b.provider))throw new Error('Use Refresh available models to check this provider.');
 const c=await connection(owner,b.provider);if(!c)throw new Error('Save this connection first.');
 const url=b.provider==='openai'?'https://api.openai.com/v1/models/'+encodeURIComponent(c.model):'https://api.browserbase.com/v1/projects';
 const r=await fetch(url,{headers:b.provider==='openai'?{Authorization:'Bearer '+c.key}:{'X-BB-API-Key':c.key},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok){const issue=await readProviderError(r,c.key,b.provider);return Response.json({ok:false,...issue});}
 const data:any=await r.json();return Response.json({ok:true,provider:b.provider,model:b.provider==='openai'?c.model:undefined,message:b.provider==='openai'?'Key accepted and selected model is listed. This read-only check does not verify generation credit or remaining quota.':'Browserbase accepted the key. Session creation still depends on available browser time and plan features.',projects:b.provider==='browserbase'?(Array.isArray(data)?data:data.projects||data.data||[]).map((p:any)=>({id:p.id,name:p.name})):undefined});
 }catch(e){return fail(e);}}
