import {actor,connection,fail} from '@/lib/server';
import {providerCatalog} from '@/lib/providers';
import {normalizeModels} from '@/lib/model-discovery';
import {readProviderError} from '@/lib/provider-errors';
import cloudCatalog from '@/lib/cloud-models.json';
import ollamaCatalog from '@/lib/ollama-models.json';
const endpoints:Record<string,string>={openai:'https://api.openai.com/v1/models',anthropic:'https://api.anthropic.com/v1/models',google:'https://generativelanguage.googleapis.com/v1beta/models',xai:'https://api.x.ai/v1/models',deepseek:'https://api.deepseek.com/models',mistral:'https://api.mistral.ai/v1/models',together:'https://api.together.xyz/v1/models',fireworks:'https://api.fireworks.ai/inference/v1/models',groq:'https://api.groq.com/openai/v1/models'};
export async function GET(req:Request){try{
 const owner=await actor(req),provider=new URL(req.url).searchParams.get('provider')||'openrouter';
 const url=providerCatalog[provider]?.modelsUrl||endpoints[provider];if(!url)throw new Error('Use an exact model ID for this provider; a compatible discovery endpoint is not configured.');
 const c=await connection(owner,provider);if(!c&&!['openrouter','ollama'].includes(provider))throw new Error('Connect this provider first.');
 const headers:Record<string,string>={Accept:'application/json'};
 if(c){if(provider==='anthropic'){headers['x-api-key']=c.key;headers['anthropic-version']='2023-06-01';}else if(provider==='google')headers['x-goog-api-key']=c.key;else headers.Authorization='Bearer '+c.key;}
 try{
 const entries=new Map();let pageUrl=url;let pages=0;let hasMore=false;
 do{
 const r=await fetch(pageUrl,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok){const issue=await readProviderError(r,c?.key||'',provider);if(!c&&['openrouter','ollama'].includes(provider))throw new Error(issue.hint);return Response.json({error:issue.hint,...issue},{status:issue.httpStatus});}
 const data:any=await r.json();for(const m of normalizeModels(provider,data))entries.set(m.id,m);
 pages++;hasMore=false;const next=new URL(url);
 if(provider==='google'&&data.nextPageToken){next.searchParams.set('pageToken',String(data.nextPageToken));hasMore=true;}
 if(provider==='anthropic'&&data.has_more&&data.last_id){next.searchParams.set('after_id',String(data.last_id));hasMore=true;}
 if(provider==='cohere'&&data.next_page_token){next.searchParams.set('page_token',String(data.next_page_token));hasMore=true;}
 pageUrl=next.toString();
 }while(hasMore&&pages<20);
 return Response.json({provider,fetchedAt:new Date().toISOString(),models:[...entries.values()],truncated:hasMore,cached:false});
 }catch(e){if(!['openrouter','ollama'].includes(provider)||c)throw e;return Response.json({...provider==='ollama'?ollamaCatalog:cloudCatalog,provider,cached:true,warning:'Live catalog unavailable. Showing the saved provider catalog.'});}
 }catch(e){return fail(e);}}
