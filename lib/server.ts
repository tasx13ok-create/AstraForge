import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import {cookieValue,verifySession} from '@/lib/session-auth';

export type ProjectRow={id:string;owner:string;name:string;files:string;revision:number;created:string;updated:string};
type PortableAuthConfig={accessToken:string;sessionSecret:string;ownerId:string};

const bindings=env as unknown as Record<string,unknown>;
const SESSION_COOKIE='astra_session';

function bindingString(name:string){
 const value=bindings[name];
 return typeof value==='string'&&value.trim()?value.trim():null;
}

function normalizedOrigin(value:string){
 try{
  const url=new URL(value);
  return url.origin===value.replace(/\/$/,'')?url.origin:null;
 }catch{return null;}
}

function trustedOrigins(req:Request){
 const values=[new URL(req.url).origin];
 const configured=bindingString('ASTRA_FRONTEND_ORIGIN');
 if(configured){
  for(const value of configured.split(',').map(item=>item.trim()).filter(Boolean)){
   const origin=normalizedOrigin(value);
   if(origin)values.push(origin);
  }
 }
 return new Set(values);
}

export function assertRequestOrigin(req:Request){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return;
 const origin=req.headers.get('origin');
 if(origin&&!trustedOrigins(req).has(origin))throw new Error('403:Origin not allowed.');
}

export function portableAuthConfig():PortableAuthConfig|null{
 const accessToken=bindingString('ASTRA_ACCESS_TOKEN');
 const sessionSecret=bindingString('ASTRA_SESSION_SECRET');
 const ownerId=bindingString('ASTRA_OWNER_ID');
 return accessToken&&sessionSecret&&ownerId?{accessToken,sessionSecret,ownerId}:null;
}

export function db(){
 const binding=bindings.DB as D1Database|undefined;
 if(!binding)throw new Error('503:Workspace storage is unavailable.');
 return binding;
}

export async function actor(req:Request){
 assertRequestOrigin(req);
 const user=await getChatGPTUser();
 if(user)return user.userId;
 const sessionSecret=bindingString('ASTRA_SESSION_SECRET');
 if(sessionSecret){
  const owner=await verifySession(cookieValue(req,SESSION_COOKIE),sessionSecret);
  if(owner)return owner;
 }
 if(process.env.NODE_ENV==='development'&&bindings.FORGE_DEV_AUTH==='true')return 'local-preview-user';
 throw new Error('401:Sign in to open your AstraForge workspace.');
}

export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();

export async function projectFor(owner:string,id:unknown){
 if(typeof id!=='string')throw new Error('Project required.');
 const p=await db().prepare('SELECT * FROM projects WHERE id=? AND owner=?').bind(id,owner).first<ProjectRow>();
 if(!p)throw new Error('404:Project not found.');
 return p;
}

export async function record(owner:string,project:string,event:string,detail:unknown){
 await db().prepare('INSERT INTO audit(id,owner,project,event,detail,created) VALUES(?,?,?,?,?,?)').bind(uid(),owner,project,event,JSON.stringify(detail),now()).run();
}

export async function body(req:Request){
 if(Number(req.headers.get('content-length')||0)>2_000_000)throw new Error('Request too large.');
 const text=await req.text();
 if(text.length>2_000_000)throw new Error('Request too large.');
 return JSON.parse(text);
}

async function vault(){
 const raw=bindingString('FORGE_VAULT_KEY');
 if(!raw)throw new Error('503:Credential vault is not configured.');
 return crypto.subtle.importKey('raw',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}

export async function seal(owner:string,value:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await vault(),new TextEncoder().encode(value)));
 return btoa(String.fromCharCode(...iv,...bytes));
}

export async function unseal(owner:string,value:string){
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(owner)},await vault(),bytes.slice(12)));
}

export async function connection(owner:string,provider:string){
 const row=await db().prepare('SELECT * FROM connections WHERE owner=? AND provider=? AND enabled=1').bind(owner,provider).first<{id:string;provider:string;model:string;secret:string}>();
 return row?{...row,key:await unseal(owner,row.secret)}:null;
}

export function fail(error:unknown){
 const msg=error instanceof Error?error.message:'Request failed.';
 const match=msg.match(/^(400|401|403|404|409|429|500|503):([\s\S]*)$/);
 return Response.json({error:match?match[2]:msg},{status:match?Number(match[1]):400});
}
