import {actor,body,connection,db,fail,now,projectFor,record,uid} from '@/lib/server';
import {sseData} from '@/lib/providers';
async function rpc(key:string,method:string,params:unknown,session?:string){
 const r=await fetch('https://mcp.higgsfield.ai/mcp',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+key,'MCP-Protocol-Version':'2025-03-26',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:uid(),method,params}),signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw new Error(`MCP request failed (${r.status}). Check the connector credentials and tool access.`);
 let value:any;if(r.headers.get('content-type')?.includes('text/event-stream')){if(!r.body)throw new Error('Empty MCP response.');for await(const data of sseData(r.body)){const parsed=JSON.parse(data);if(parsed.result||parsed.error){value=parsed;break;}}}else value=await r.json();
 if(value?.error)throw new Error('The MCP server rejected this request. Check tool arguments and access.');if(!value)throw new Error('No MCP result returned.');return {value:value.result,session:r.headers.get('mcp-session-id')||session};
}
async function init(key:string){const s=await rpc(key,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'AstraForge',version:'0.1.0'}});const response=await fetch('https://mcp.higgsfield.ai/mcp',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+key,'MCP-Protocol-Version':'2025-03-26',...(s.session?{'Mcp-Session-Id':s.session}:{})},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('MCP initialization was not accepted.');return s;}
export async function pluginsAction(owner:string,b:any){
 const p=await projectFor(owner,b.project);const c=await connection(owner,'higgsfield');if(!c)throw new Error('Connect Higgsfield MCP in Settings.');
 if(b.action==='list'){const s=await init(c.key);const result=await rpc(c.key,'tools/list',{},s.session);return Response.json({tools:result.value.tools||[]});}
 if(b.action==='request'){
 if(typeof b.tool!=='string'||b.tool.length>150||!b.arguments||typeof b.arguments!=='object'||Array.isArray(b.arguments)||JSON.stringify(b.arguments).length>100000)throw new Error('Invalid tool arguments.');
 const id=uid();await db().prepare('INSERT INTO approvals(id,owner,project,kind,payload,revision,state,created,expires) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,owner,p.id,'plugin',JSON.stringify({tool:b.tool,arguments:b.arguments}),p.revision,'pending',now(),Date.now()+300000).run();await record(owner,p.id,'plugin.permission_requested',{id,tool:b.tool});return Response.json({id});
 }
 if(b.action==='execute'){
 const a=await db().prepare("SELECT payload FROM approvals WHERE id=? AND owner=? AND project=? AND kind='plugin' AND state='approved' AND expires>?").bind(b.approval,owner,p.id,Date.now()).first<{payload:string}>();if(!a)throw new Error('An active tool approval is required.');
 const claim=await db().prepare("UPDATE approvals SET state='executing' WHERE id=? AND owner=? AND state='approved'").bind(b.approval,owner).run();if(!claim.meta.changes)throw new Error('Tool already started.');
 try{const args=JSON.parse(a.payload),s=await init(c.key);const result=await rpc(c.key,'tools/call',{name:args.tool,arguments:args.arguments},s.session);await db().prepare("UPDATE approvals SET state='completed' WHERE id=? AND owner=?").bind(b.approval,owner).run();await record(owner,p.id,'plugin.completed',{id:b.approval,tool:args.tool});return Response.json({result:result.value});}
 catch(e){await db().prepare("UPDATE approvals SET state='unknown' WHERE id=? AND owner=?").bind(b.approval,owner).run();await record(owner,p.id,'plugin.outcome_unknown',{id:b.approval});throw new Error('The plugin result is unknown. Check the provider job history before retrying; the action may already have started.');}
 }
 throw new Error('Unknown plugin action.');
 }
