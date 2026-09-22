import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export type ProjectRow={id:string;owner:string;name:string;files:string;revision:number;created:string;updated:string};
const bindings=env as unknown as Record<string,unknown>;
export function db(){const binding=bindings.DB as D1Database|undefined;if(!binding)throw new Error('Workspace storage is unavailable.');return binding;}
export async function actor(req:Request){
 if(!['GET','HEAD'].includes(req.method)) {const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('403:Origin not allowed.');}
 const user=await getChatGPTUser();if(user)return user.userId;
 if(process.env.NODE_ENV==='development'&&bindings.FORGE_DEV_AUTH==='true')return 'local-preview-user';
 throw new Error('401:Sign in with ChatGPT to open your workspace.');
}
export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export async function projectFor(owner:string,id:unknown){if(typeof id!=='string')throw new Error('Project required.');const p=await db().prepare('SELECT * FROM projects WHERE id=? AND owner=?').bind(id,owner).first<ProjectRow>();if(!p)throw new Error('404:Project not found.');return p;}
export async function record(owner:string,project:string,event:string,detail:unknown){await db().prepare('INSERT INTO audit(id,owner,project,event,detail,created) VALUES(?,?,?,?,?,?)').bind(uid(),owner,project,event,JSON.stringify(detail),now()).run();}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>2_000_000)throw new Error('Request too large.');const text=await req.text();if(text.length>2_000_000)throw new Error('Request too large.');return JSON.parse(text);}
async function vault(){const raw=bindings.FORGE_VAULT_KEY;if(typeof raw!=='string')throw new Error('Credential vault is not configured.');return crypto.subtle.importKey('raw',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(owner:string,value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await vault(),new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...bytes));}
export async function unseal(owner:string,value:string){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(owner)},await vault(),bytes.slice(12)));}
export async function connection(owner:string,provider:string){const row=await db().prepare('SELECT * FROM connections WHERE owner=? AND provider=? AND enabled=1').bind(owner,provider).first<{id:string;provider:string;model:string;secret:string}>();return row?{...row,key:await unseal(owner,row.secret)}:null;}
export function fail(error:unknown){const msg=error instanceof Error?error.message:'Request failed.';const m=msg.match(/^(401|403|404|409|429):([\s\S]*)$/);return Response.json({error:m?m[2]:msg},{status:m?Number(m[1]):400});}
