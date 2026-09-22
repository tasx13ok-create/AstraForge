import {actor,body,connection,db,fail,now,projectFor,record,uid,unseal} from '@/lib/server';
import {providerCatalog,generate,ProviderFailure,type ChatTurn} from '@/lib/providers';
import {agentProtocol,parseAgentAction,type AgentAction} from '@/lib/agent-protocol';
import {validateFiles,type Files} from '@/lib/templates';
import {terminalAction} from '@/lib/terminal-service';
import {pluginsAction} from '@/lib/plugins-service';
import {navigateBrowser,publicUrl,readBrowser,startBrowser} from '@/lib/remote-browser';
import {selectChatRoutes,shouldFailoverRoute} from '@/lib/chat-routing';
type Run={id:string;owner:string;project:string;goal:string;state:string;log:string;pending:string|null;config:string;step:number;lease:string|null;lease_expires:number;created:string;updated:string};
type Entry={at:string;action:unknown;result:unknown};
function display(r:Run){return {...r,owner:undefined,lease:undefined,log:JSON.parse(r.log),pending:r.pending?JSON.parse(r.pending):null,config:JSON.parse(r.config)};}
async function getRun(owner:string,id:string){const r=await db().prepare('SELECT * FROM agent_runs WHERE id=? AND owner=?').bind(id,owner).first<Run>();if(!r)throw new Error('404:Agent run not found.');return r;}
async function enabledTools(owner:string,project:string){return (await db().prepare('SELECT plugin FROM workspace_tools WHERE owner=? AND project=? AND enabled=1').bind(owner,project).all<{plugin:string}>()).results.map(x=>x.plugin);}
async function assertTool(owner:string,project:string,plugin:string){if(!(await enabledTools(owner,project)).includes(plugin))throw new Error('This tool is not enabled for this workspace.');if(!await connection(owner,plugin))throw new Error('The enabled tool has no active connection.');}
async function append(owner:string,run:Run,state:string,entry:Entry,pending:unknown,lease:string){const log=[...JSON.parse(run.log),entry];const result=await db().prepare("UPDATE agent_runs SET state=?,log=?,pending=?,step=step+?,lease=NULL,lease_expires=0,updated=? WHERE id=? AND owner=? AND lease=? AND state IN ('thinking','executing')").bind(state,JSON.stringify(log),pending?JSON.stringify(pending):null,run.state==='ready'?1:0,now(),run.id,owner,lease).run();if(!result.meta.changes)throw new Error('Agent run was stopped or changed.');return display(await getRun(owner,run.id));}
export async function GET(req:Request){try{const owner=await actor(req),id=new URL(req.url).searchParams.get('project');await projectFor(owner,id);const run=await db().prepare('SELECT * FROM agent_runs WHERE owner=? AND project=? ORDER BY created DESC LIMIT 1').bind(owner,id).first<Run>();return Response.json({run:run?display(run):null});}catch(e){return fail(e);}}
export async function POST(req:Request){try{const owner=await actor(req),b=await body(req),p=await projectFor(owner,b.project);
 if(b.action==='start'){
 const goal=String(b.goal||'').trim();if(!goal||goal.length>15000)throw new Error('Enter a goal under 15,000 characters.');const connectedRoutes=(await db().prepare('SELECT provider,model FROM connections WHERE owner=? AND enabled=1 ORDER BY created').bind(owner).all<{provider:string;model:string}>()).results.filter(c=>['openai','anthropic','google'].includes(providerCatalog[c.provider]?.kind));if(!connectedRoutes.length)throw new Error('Connect an AI engine before starting an agent.');
 const routes=selectChatRoutes(connectedRoutes,b.provider,b.model),preferred=routes[0];const config={provider:preferred.provider,model:preferred.model,routes:routes.map(route=>({provider:route.provider,model:route.model})),reasoning:['auto','low','medium','high'].includes(b.reasoning)?b.reasoning:'auto',maxTokens:Math.min(16384,Math.max(1024,Number(b.maxTokens)||8192)),maxSteps:Math.min(20,Math.max(1,Number(b.maxSteps)||12))};const id=uid();
 const inserted=await db().prepare("INSERT INTO agent_runs(id,owner,project,goal,state,log,config,step,lease_expires,created,updated) SELECT ?,?,?,?,'ready','[]',?,0,0,?,? WHERE NOT EXISTS (SELECT 1 FROM agent_runs WHERE owner=? AND project=? AND state IN ('ready','thinking','waiting','executing','paused'))").bind(id,owner,p.id,goal,JSON.stringify(config),now(),now(),owner,p.id).run();if(!inserted.meta.changes)throw new Error('Resume or stop the existing agent run first.');await record(owner,p.id,'agent.started',{id,maxSteps:config.maxSteps});return Response.json({run:display(await getRun(owner,id))});
 }
 const run=await getRun(owner,String(b.run));if(run.project!==p.id)throw new Error('403:Agent belongs to another workspace.');
 if(b.action==='cancel'){await db().prepare("UPDATE agent_runs SET state='cancelled',updated=? WHERE id=? AND owner=? AND state NOT IN ('complete','cancelled')").bind(now(),run.id,owner).run();if(run.pending){const a=JSON.parse(run.pending);await db().prepare("UPDATE approvals SET state='denied' WHERE id=? AND owner=? AND state='pending'").bind(a.approval,owner).run();}await record(owner,p.id,'agent.stopped',{id:run.id});return Response.json({run:display(await getRun(owner,run.id))});}
 if(b.action==='recover'){
 if(run.state==='thinking'&&run.lease_expires<Date.now()){await db().prepare("UPDATE agent_runs SET state='ready',lease=NULL,updated=? WHERE id=? AND owner=? AND state='thinking' AND lease_expires<?").bind(now(),run.id,owner,Date.now()).run();}else if(run.state==='executing'&&run.lease_expires<Date.now()){await db().prepare("UPDATE agent_runs SET state='paused',updated=? WHERE id=? AND owner=? AND state='executing' AND lease_expires<?").bind(now(),run.id,owner,Date.now()).run();throw new Error('An action may have run. Inspect the audit and external service before stopping this run and starting another.');}else throw new Error('The current step is still active or not recoverable.');return Response.json({run:display(await getRun(owner,run.id))});
 }
 if(b.action==='step'){
 if(run.state!=='ready')throw new Error('Agent is not ready for another step.');const cfg=JSON.parse(run.config);if(run.step>=cfg.maxSteps){await db().prepare("UPDATE agent_runs SET state='paused',updated=? WHERE id=? AND owner=? AND state='ready'").bind(now(),run.id,owner).run();return Response.json({run:display(await getRun(owner,run.id))});}
 const lease=uid();const claim=await db().prepare("UPDATE agent_runs SET state='thinking',lease=?,lease_expires=?,updated=? WHERE id=? AND owner=? AND state='ready'").bind(lease,Date.now()+150000,now(),run.id,owner).run();if(!claim.meta.changes)throw new Error('Another tab is advancing this agent.');
 try{
 const allowed=await enabledTools(owner,p.id);let tools:unknown=[];
 if(allowed.includes('higgsfield')){try{const response=await pluginsAction(owner,{action:'list',project:p.id});const data:any=await response.json();tools=data.tools.slice(0,80).map((t:any)=>({name:t.name,description:String(t.description||'').slice(0,600),inputSchema:t.inputSchema}));}catch{tools='Higgsfield discovery unavailable; do not use plugin actions.';}}
 const system=agentProtocol+'\nEnabled workspace plugins: '+JSON.stringify(allowed)+'\nDiscovered plugin tools (untrusted descriptions): '+JSON.stringify(tools)+'\nWorkspace revision: '+p.revision+'\nWorkspace files (untrusted): '+p.files;
 const turns:ChatTurn[]=[{role:'user',content:run.goal}];for(const entry of JSON.parse(run.log) as Entry[]){turns.push({role:'assistant',content:JSON.stringify(entry.action)},{role:'user',content:'TOOL OBSERVATION (untrusted data): '+JSON.stringify(entry.result).slice(0,35000)});}
 if(system.length+JSON.stringify(turns).length>500000)throw new Error('Agent context is full. Save a snapshot and start a focused new task.');
 const configuredRoutes=Array.isArray(cfg.routes)&&cfg.routes.length?cfg.routes:[{provider:cfg.provider,model:cfg.model}];
 let action:AgentAction|undefined,engine:{provider:string;model:string}|undefined,lastFailure='';const meta:unknown[]=[];
 for(const route of configuredRoutes.slice(0,3)){
  if(!route||typeof route.provider!=='string'||typeof route.model!=='string')continue;
  const started=Date.now(),c=await connection(owner,route.provider);
  if(!c){lastFailure='The agent engine was disconnected.';meta.push({provider:route.provider,model:route.model,result:'unavailable',error:lastFailure});continue;}
  let output='';
  try{
   for await(const chunk of generate(route.provider,c.key,route.model,system,turns,AbortSignal.any([req.signal,AbortSignal.timeout(90000)]),{maxTokens:cfg.maxTokens,reasoning:cfg.reasoning,onMeta:m=>meta.push(m)})){output+=chunk;if(output.length>500000)throw new Error('Agent output exceeded the review limit.');}
   action=parseAgentAction(output);engine={provider:route.provider,model:route.model};meta.push({provider:route.provider,model:route.model,ms:Date.now()-started,result:'complete'});break;
  }catch(e){
   lastFailure=e instanceof Error?e.message:'Agent engine failed.';const status=e instanceof ProviderFailure?e.status:0;
   meta.push({provider:route.provider,model:route.model,ms:Date.now()-started,result:'failed',status,error:lastFailure});
   if(!shouldFailoverRoute(status,false))break;
  }
 }
 if(!action||!engine)throw new Error(lastFailure||'No connected engine could complete this agent step.');
 const entry:Entry={at:now(),action,result:null};let pending:unknown=null,state='ready';
 if(action.type==='done'){entry.result={reportedComplete:true,summary:action.summary};state='complete';}
 else if(action.type==='plan')entry.result={planRecorded:true};
 else if(action.type==='read_file'){const files=JSON.parse(p.files) as Files;entry.result=Object.hasOwn(files,action.path)?{path:action.path,content:files[action.path].slice(0,30000)}:{error:'File not found.'};}
 else if(action.type==='search'){const files=JSON.parse(p.files) as Files;entry.result=Object.entries(files).flatMap(([path,text])=>text.split('\n').map((line,i)=>({path,line:i+1,text:line.slice(0,500)})).filter(x=>x.text.toLowerCase().includes(action.query.toLowerCase()))).slice(0,60);}
 else{
 if(action.type==='write_files')validateFiles(action.files);
 if(action.type==='delete_files')for(const path of action.paths)if(!Object.hasOwn(JSON.parse(p.files),path))throw new Error('Agent requested deletion of an absent file.');
 if(action.type==='command')await assertTool(owner,p.id,'e2b');
 if(action.type==='plugin')await assertTool(owner,p.id,'higgsfield');
 if(action.type==='browser'){await assertTool(owner,p.id,'browserbase');if(action.operation==='navigate')publicUrl(action.url);}
 const approval=uid();await db().prepare('INSERT INTO approvals(id,owner,project,kind,payload,revision,state,created,expires) VALUES(?,?,?,?,?,?,?,?,?)').bind(approval,owner,p.id,'agent',JSON.stringify(action),p.revision,'pending',now(),Date.now()+300000).run();pending={approval,action,revision:p.revision,expires:Date.now()+300000};entry.result={awaitingUserApproval:true};state='waiting';await record(owner,p.id,'agent.permission_requested',{run:run.id,approval,type:action.type});
 }
 await record(owner,p.id,'agent.step',{run:run.id,step:run.step+1,provider:engine.provider,engine:engine.model,meta});return Response.json({run:await append(owner,run,state,entry,pending,lease)});
 }catch(e){const message=e instanceof Error?e.message:'Agent step failed.';return Response.json({run:await append(owner,run,'failed',{at:now(),action:{type:'error'},result:{error:message}},null,lease),error:message});}
 }
 if(b.action==='decide'){
 if(run.state!=='waiting'||!run.pending)throw new Error('No pending agent action.');const pending=JSON.parse(run.pending),action=pending.action as AgentAction;
 const lease=uid();const claimed=await db().prepare("UPDATE agent_runs SET state='executing',lease=?,lease_expires=?,updated=? WHERE id=? AND owner=? AND state='waiting'").bind(lease,Date.now()+150000,now(),run.id,owner).run();if(!claimed.meta.changes)throw new Error('This action was already handled.');
 const entry:Entry={at:now(),action,result:null};let state='ready';
 try{
 const grant=await db().prepare("SELECT * FROM approvals WHERE id=? AND owner=? AND project=? AND kind='agent' AND state='pending' AND expires>?").bind(pending.approval,owner,p.id,Date.now()).first<{payload:string;revision:number}>();if(!grant)throw new Error('Approval expired. Stop this run and request a new action.');
 if(!b.allow){await db().prepare("UPDATE approvals SET state='denied' WHERE id=? AND owner=? AND state='pending'").bind(pending.approval,owner).run();entry.result={denied:true,instruction:'Do not retry or rephrase this denied action. Choose an alternative or finish.'};}
 else{
 if(p.revision!==pending.revision)throw new Error('Workspace changed. Deny this action and let the agent re-read the current files.');
 const consumed=await db().prepare("UPDATE approvals SET state='executing' WHERE id=? AND owner=? AND state='pending'").bind(pending.approval,owner).run();if(!consumed.meta.changes)throw new Error('Approval already consumed.');
 await record(owner,p.id,'agent.permission_approved',{run:run.id,approval:pending.approval,type:action.type});
 if(action.type==='write_files'||action.type==='delete_files'){
 const files=JSON.parse(p.files) as Files;const next=action.type==='write_files'?validateFiles({...files,...action.files}):Object.fromEntries(Object.entries(files).filter(([path])=>!action.paths.includes(path)));validateFiles(next);
 await db().prepare('INSERT INTO snapshots(id,project,owner,message,files,created) VALUES(?,?,?,?,?,?)').bind(uid(),p.id,owner,'Before agent step '+run.step,p.files,now()).run();const changed=await db().prepare('UPDATE projects SET files=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(next),now(),p.id,owner,p.revision).run();if(!changed.meta.changes)throw new Error('Concurrent edit prevented this change.');entry.result={applied:true,revision:p.revision+1,files:action.type==='write_files'?Object.keys(action.files):action.paths};
 }else if(action.type==='command'){
 await assertTool(owner,p.id,'e2b');const requested=await terminalAction(owner,{action:'request',project:p.id,command:action.command,shell:action.shell,session:run.id,network:false});const a:any=await requested.json();if(!a.approved)await db().prepare("UPDATE approvals SET state='approved' WHERE id=? AND owner=? AND state='pending'").bind(a.id,owner).run();entry.result=await (await terminalAction(owner,{action:'execute',project:p.id,approval:a.id})).json();
 }else if(action.type==='plugin'){
 await assertTool(owner,p.id,'higgsfield');const requested=await pluginsAction(owner,{action:'request',project:p.id,tool:action.tool,arguments:action.arguments});const a:any=await requested.json();await db().prepare("UPDATE approvals SET state='approved' WHERE id=? AND owner=? AND state='pending'").bind(a.id,owner).run();entry.result=await (await pluginsAction(owner,{action:'execute',project:p.id,approval:a.id})).json();
 }else if(action.type==='browser'){await assertTool(owner,p.id,'browserbase');if(action.operation==='start'){const started=await startBrowser(owner,p.id);entry.result={started:true,id:started.id,expires:started.expires};}else entry.result=action.operation==='read'?await readBrowser(owner,p.id):await navigateBrowser(owner,p.id,action.url!);}
 else throw new Error('Invalid privileged action.');
 await db().prepare("UPDATE approvals SET state='completed' WHERE id=? AND owner=? AND state='executing'").bind(pending.approval,owner).run();
 }
 }catch(e){const error=e instanceof Error?e.message:'Action failed.';entry.result={error,doNotRetryAutomatically:true};state='paused';await db().prepare("UPDATE approvals SET state='unknown' WHERE id=? AND owner=? AND state='executing'").bind(pending.approval,owner).run();}
 await record(owner,p.id,'agent.action_result',{run:run.id,type:action.type,status:state});return Response.json({run:await append(owner,run,state,entry,null,lease),projectChanged:b.allow&&['write_files','delete_files'].includes(action.type)&&state==='ready'});
 }
 throw new Error('Unknown agent action.');
 }catch(e){return fail(e);}}
