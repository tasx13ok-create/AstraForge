import {actor,body,db,fail,now,projectFor,record,seal,uid,connection} from '@/lib/server';
import {templates,validateFiles} from '@/lib/templates';
import {providerCatalog} from '@/lib/providers';

export async function GET(req:Request){try{
 const owner=await actor(req);const id=new URL(req.url).searchParams.get('project');
 const projects=(await db().prepare('SELECT id,name,revision,created,updated FROM projects WHERE owner=? ORDER BY updated DESC').bind(owner).all()).results;
 const connections=(await db().prepare('SELECT id,provider,model,enabled FROM connections WHERE owner=? ORDER BY created').bind(owner).all()).results;
 if(!id)return Response.json({projects,connections});
 const p=await projectFor(owner,id);
 const [messages,snapshots,audit,policies,workspaceTools]=await Promise.all([
 db().prepare('SELECT id,role,content,status,revision,created FROM messages WHERE owner=? AND project=? ORDER BY created LIMIT 200').bind(owner,id).all(),
 db().prepare('SELECT id,message,created FROM snapshots WHERE owner=? AND project=? ORDER BY created DESC LIMIT 60').bind(owner,id).all(),
 db().prepare('SELECT id,event,detail,created FROM audit WHERE owner=? AND project=? ORDER BY created DESC LIMIT 100').bind(owner,id).all(),
 db().prepare('SELECT * FROM policies WHERE owner=? AND project=?').bind(owner,id).all(),db().prepare('SELECT plugin,enabled FROM workspace_tools WHERE owner=? AND project=?').bind(owner,id).all()]);
 return Response.json({projects,connections,project:{...p,owner:undefined,files:JSON.parse(p.files)},messages:messages.results,snapshots:snapshots.results,audit:audit.results,policies:policies.results,workspaceTools:workspaceTools.results});
 }catch(e){return fail(e);}}
export async function POST(req:Request){try{
 const owner=await actor(req),b=await body(req);let id=b.project;
 if(b.action==='create'){
 const count=await db().prepare('SELECT COUNT(*) AS n FROM projects WHERE owner=?').bind(owner).first<{n:number}>();if((count?.n||0)>=30)throw new Error('Project limit reached (30). Export and delete a project to make room.');
 const files=validateFiles(b.files||templates[b.template||'web']?.files||templates.blank.files);id=uid();const name=String(b.name||'Untitled project').trim().slice(0,80)||'Untitled project';
 await db().prepare('INSERT INTO projects(id,owner,name,files,revision,created,updated) VALUES(?,?,?,?,0,?,?)').bind(id,owner,name,JSON.stringify(files),now(),now()).run();await record(owner,id,'project.created',{name});return Response.json({id});
 }
 if(b.action==='connect'){
 if(!providerCatalog[b.provider])throw new Error('Unsupported connection.');if(typeof b.key!=='string'||b.key.length<10||b.key.length>8192)throw new Error('Enter a valid API key.');
 const model=String(b.model||providerCatalog[b.provider].model).trim();if(!model&&providerCatalog[b.provider].kind!=='git')throw new Error('Enter the model identifier.');if(model.length>180)throw new Error('Model identifier is too long.');
 await db().prepare('INSERT INTO connections(id,owner,provider,model,secret,enabled,created) VALUES(?,?,?,?,?,1,?) ON CONFLICT(owner,provider) DO UPDATE SET model=excluded.model,secret=excluded.secret,enabled=1').bind(uid(),owner,b.provider,model,await seal(owner,b.key.trim()),now()).run();return Response.json({ok:true});
 }
 if(b.action==='disconnect'){await db().prepare('DELETE FROM connections WHERE owner=? AND provider=?').bind(owner,b.provider).run();return Response.json({ok:true});}
 const p=await projectFor(owner,id);
 if(b.action==='toolToggle'){
 if(!['e2b','higgsfield','browserbase'].includes(b.plugin))throw new Error('Unknown workspace tool.');
 if(b.enabled&&!await connection(owner,b.plugin))throw new Error('Connect this service before enabling it.');
 await db().prepare('INSERT INTO workspace_tools(id,owner,project,plugin,enabled,created) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,project,plugin) DO UPDATE SET enabled=excluded.enabled').bind(uid(),owner,p.id,b.plugin,b.enabled?1:0,now()).run();await record(owner,p.id,'workspace.tool_changed',{plugin:b.plugin,enabled:!!b.enabled});return Response.json({ok:true});
 }
 if(b.action==='save'){
 const files=validateFiles(b.files);const result=await db().prepare('UPDATE projects SET files=?,name=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(files),String(b.name||p.name).slice(0,80),now(),id,owner,b.revision).run();if(!result.meta.changes)throw new Error('409:This project changed in another tab. Export your local files, then reload before saving.');return Response.json({revision:b.revision+1});
 }
 if(b.action==='snapshot'){
 const snapshot=uid();await db().prepare('INSERT INTO snapshots(id,project,owner,message,files,created) VALUES(?,?,?,?,?,?)').bind(snapshot,id,owner,String(b.message||'Workspace snapshot').slice(0,200),p.files,now()).run();await record(owner,id,'snapshot.created',{id:snapshot});return Response.json({id:snapshot});
 }
 if(b.action==='readSnapshot'){const snap=await db().prepare('SELECT * FROM snapshots WHERE id=? AND project=? AND owner=?').bind(b.snapshot,id,owner).first<{files:string}>();if(!snap)throw new Error('404:Snapshot not found.');return Response.json({files:JSON.parse(snap.files)});}
 if(b.action==='policy'){
 if(!['allow','deny','ask'].includes(b.effect)||!['session','workspace'].includes(b.scope)||typeof b.pattern!=='string'||!b.pattern||b.pattern.length>2000)throw new Error('Invalid policy.');
 await db().prepare('INSERT INTO policies(id,owner,project,kind,pattern,effect,scope,session,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid(),owner,id,'command',b.pattern,b.effect,b.scope,b.scope==='session'?String(b.session):null,now()).run();await record(owner,id,'permission.rule_added',{effect:b.effect,scope:b.scope,command:b.pattern});return Response.json({ok:true});
 }
 if(b.action==='deletePolicy'){await db().prepare('DELETE FROM policies WHERE id=? AND owner=? AND project=?').bind(b.policy,owner,id).run();await record(owner,id,'permission.rule_removed',{});return Response.json({ok:true});}
 if(b.action==='approve'){
 const state=b.allow?'approved':'denied';const result=await db().prepare("UPDATE approvals SET state=? WHERE id=? AND owner=? AND project=? AND state='pending' AND expires>?").bind(state,b.approval,owner,id,Date.now()).run();if(!result.meta.changes)throw new Error('Approval expired or already handled.');await record(owner,id,'permission.'+state,{id:b.approval});return Response.json({ok:true});
 }
 if(b.action==='delete'){
 await db().batch(['messages','snapshots','approvals','policies','audit','runs','workspace_tools','agent_runs'].map(table=>db().prepare(`DELETE FROM ${table} WHERE owner=? AND project=?`).bind(owner,id)).concat([db().prepare('DELETE FROM projects WHERE owner=? AND id=?').bind(owner,id)]));return Response.json({ok:true});
 }
 if(b.action==='github'){
 const c=await connection(owner,'github');if(!c)throw new Error('Connect GitHub in Settings first.');
 if(!/^[\w.-]+\/[\w.-]+$/.test(b.repo)||!/^astraforge\/[\w.-]+$/.test(b.branch))throw new Error('Use owner/repository and a new astraforge/branch-name.');
 const base='https://api.github.com/repos/'+b.repo;const headers={Authorization:`Bearer ${c.key}`,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'AstraForge'};
 async function gh(path:string,data?:unknown){const r=await fetch(base+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined});if(!r.ok)throw new Error(`GitHub request failed (${r.status}). Check repository access and use a new branch name.`);return r.json() as Promise<any>;}
 const repo=await gh('');const ref=await gh('/git/ref/heads/'+encodeURIComponent(repo.default_branch));const commit=await gh('/git/commits/'+ref.object.sha);
 const tree=await gh('/git/trees',{base_tree:commit.tree.sha,tree:Object.entries(JSON.parse(p.files) as Record<string,string>).map(([path,content])=>({path,mode:'100644',type:'blob',content}))});
 const newCommit=await gh('/git/commits',{message:String(b.message||'Build with AstraForge').slice(0,200),tree:tree.sha,parents:[ref.object.sha]});
 await gh('/git/refs',{ref:'refs/heads/'+b.branch,sha:newCommit.sha});
 await record(owner,id,'git.branch_created',{repo:b.repo,branch:b.branch,sha:newCommit.sha});
 return Response.json({url:`https://github.com/${b.repo}/compare/${encodeURIComponent(repo.default_branch)}...${encodeURIComponent(b.branch)}?expand=1`,sha:newCommit.sha});
 }
 throw new Error('Unknown action.');
 }catch(e){return fail(e);}}
