import {actor,body,fail} from '@/lib/server';
import {pluginsAction} from '@/lib/plugins-service';
export async function POST(req:Request){try{return await pluginsAction(await actor(req),await body(req));}catch(e){return fail(e);}}
