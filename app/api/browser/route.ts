import {actor,body,db,fail,now,projectFor,record,uid} from '@/lib/server';
import {findBrowserView,navigateBrowser,publicUrl,readBrowser,startBrowser,stopBrowser} from '@/lib/remote-browser';
export async function GET(req:Request){try{const owner=await actor(req),id=new URL(req.url).searchParams.get('project');await projectFor(owner,id);return Response.json({session:await findBrowserView(owner,id!)});}catch(e){return fail(e);}}
export async function POST(req:Request){try{const owner=await actor(req),b=await body(req),p=await projectFor(owner,b.project);
 if(b.action==='request'){
 if(!['start','navigate','read'].includes(b.operation))throw new Error('Unsupported browser operation.');const payload={operation:b.operation,url:b.operation==='navigate'?publicUrl(b.url):undefined,session:b.session};const id=uid();await db().prepare('INSERT INTO approvals(id,owner,project,kind,payload,revision,state,created,expires) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,owner,p.id,'browser',JSON.stringify(payload),p.revision,'pending',now(),Date.now()+300000).run();await record(owner,p.id,'browser.permission_requested',{id,operation:b.operation});return Response.json({id,...payload});
 }
 if(b.action==='stop'){await stopBrowser(owner,p.id,b.session);return Response.json({ok:true});}
 if(b.action==='execute'){
 const approval=await db().prepare("SELECT payload FROM approvals WHERE id=? AND owner=? AND project=? AND kind='browser' AND state='approved' AND expires>?").bind(b.approval,owner,p.id,Date.now()).first<{payload:string}>();if(!approval)throw new Error('Review and approve this browser action first.');const claim=await db().prepare("UPDATE approvals SET state='executing' WHERE id=? AND owner=? AND state='approved'").bind(b.approval,owner).run();if(!claim.meta.changes)throw new Error('Browser action already started.');
 try{const a=JSON.parse(approval.payload);const result=a.operation==='start'?await startBrowser(owner,p.id):a.operation==='navigate'?await navigateBrowser(owner,p.id,a.url,a.session):await readBrowser(owner,p.id,a.session);await db().prepare("UPDATE approvals SET state='completed' WHERE id=? AND owner=?").bind(b.approval,owner).run();return Response.json({result});}
 catch(e){const operation=JSON.parse(approval.payload).operation,state=operation==='read'?'failed':'unknown';await db().prepare('UPDATE approvals SET state=? WHERE id=? AND owner=?').bind(state,b.approval,owner).run();const detail=e instanceof Error?e.message:'No confirmed result.';await record(owner,p.id,'browser.failed',{operation,error:detail,state});throw new Error(detail+(operation==='start'?' Check the Browserbase session list before retrying an uncertain start.':''));}
 }
 throw new Error('Unknown browser action.');
 }catch(e){return fail(e);}}
