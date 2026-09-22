import {actor,body,fail} from '@/lib/server';
import {terminalAction} from '@/lib/terminal-service';
export async function POST(req:Request){try{return await terminalAction(await actor(req),await body(req));}catch(e){return fail(e);}}
