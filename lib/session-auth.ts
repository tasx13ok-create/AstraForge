const encoder=new TextEncoder();
const decoder=new TextDecoder();

function toBase64Url(bytes:Uint8Array){
 let binary='';
 for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64Url(value:string){
 const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
 const padded=normalized+'='.repeat((4-normalized.length%4)%4);
 const binary=atob(padded);
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function hmac(secret:string,value:string){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
function sameBytes(a:Uint8Array,b:Uint8Array){
 if(a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
export async function secureEqual(a:string,b:string){
 const [left,right]=await Promise.all([
  crypto.subtle.digest('SHA-256',encoder.encode(a)),
  crypto.subtle.digest('SHA-256',encoder.encode(b))
 ]);
 return sameBytes(new Uint8Array(left),new Uint8Array(right));
}
export async function issueSession(owner:string,secret:string,ttlSeconds=60*60*24*7,now=Date.now()){
 const payload=toBase64Url(encoder.encode(JSON.stringify({sub:owner,exp:now+ttlSeconds*1000})));
 const signature=toBase64Url(await hmac(secret,payload));
 return payload+'.'+signature;
}
export async function verifySession(value:string|undefined,secret:string,now=Date.now()){
 if(!value)return null;
 const [payload,signature,...extra]=value.split('.');
 if(!payload||!signature||extra.length)return null;
 let expected:Uint8Array,provided:Uint8Array;
 try{
  expected=await hmac(secret,payload);
  provided=fromBase64Url(signature);
 }catch{return null;}
 if(!sameBytes(expected,provided))return null;
 try{
  const parsed=JSON.parse(decoder.decode(fromBase64Url(payload))) as {sub?:unknown;exp?:unknown};
  if(typeof parsed.sub!=='string'||!parsed.sub||typeof parsed.exp!=='number'||!Number.isFinite(parsed.exp)||parsed.exp<=now)return null;
  return parsed.sub;
 }catch{return null;}
}
export function cookieValue(req:Request,name:string){
 const header=req.headers.get('cookie');
 if(!header)return undefined;
 for(const part of header.split(';')){
  const index=part.indexOf('=');
  if(index<0)continue;
  const key=part.slice(0,index).trim();
  if(key!==name)continue;
  try{return decodeURIComponent(part.slice(index+1).trim());}catch{return undefined;}
 }
 return undefined;
}
