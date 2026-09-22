import {actor,assertRequestOrigin,body,fail,portableAuthConfig} from '@/lib/server';
import {issueSession,secureEqual} from '@/lib/session-auth';

const COOKIE='astra_session';
const MAX_AGE=60*60*24*7;

export async function GET(req:Request){
 try{
  const owner=await actor(req);
  return Response.json({authenticated:true,owner});
 }catch(error){return fail(error);}
}

export async function POST(req:Request){
 try{
  assertRequestOrigin(req);
  const payload=await body(req);
  const token=typeof payload?.token==='string'?payload.token:'';
  if(!token||token.length>4096)throw new Error('401:Invalid access token.');
  const config=portableAuthConfig();
  if(!config)throw new Error('503:Portable workspace access is not configured.');
  if(!await secureEqual(token,config.accessToken))throw new Error('401:Invalid access token.');
  const session=await issueSession(config.ownerId,config.sessionSecret,MAX_AGE);
  return Response.json({authenticated:true},{
   headers:{'Set-Cookie':`${COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}; Priority=High`}
  });
 }catch(error){return fail(error);}
}

export async function DELETE(req:Request){
 try{
  assertRequestOrigin(req);
  return Response.json({authenticated:false},{
   headers:{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Priority=High`}
  });
 }catch(error){return fail(error);}
}
