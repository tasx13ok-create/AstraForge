import {Sandbox} from 'e2b';
import {actor,body,connection,db,fail,now,projectFor,record,uid} from '@/lib/server';
export async function terminalAction(owner:string,b:any){
 const p=await projectFor(owner,b.project);
 const c=await connection(owner,'e2b');if(!c)throw new Error('Connect an E2B sandbox in Settings to run commands.');
 if(b.action==='request'){
 const command=String(b.command||'').trim();if(!command||command.length>2000)throw new Error('Enter a command under 2,000 characters.');if(!['bash','pwsh'].includes(b.shell))throw new Error('Unsupported shell.');
 if(b.network)throw new Error('Outbound network is disabled in this runner. Package installation and network grants require the hardened egress runtime described in the specification.');
 const pattern=JSON.stringify({command,shell:b.shell,network:false});
 const rules=(await db().prepare("SELECT * FROM policies WHERE owner=? AND project=? AND pattern=? AND (scope='workspace' OR (scope='session' AND session=?))").bind(owner,p.id,pattern,String(b.session)).all<{effect:string}>()).results;
 if(rules.some(r=>r.effect==='deny'))throw new Error('This command is denied by a workspace permission rule.');
 // PowerShell is always explicitly confirmed; exact-command allow rules apply only to bash.
 const allowed=b.shell!=='pwsh'&&!rules.some(r=>r.effect==='ask')&&rules.some(r=>r.effect==='allow');
 const id=uid();const payload=JSON.stringify({command,shell:b.shell,network:false});
 await db().prepare('INSERT INTO approvals(id,owner,project,kind,payload,revision,state,created,expires) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,owner,p.id,'command',payload,p.revision,allowed?'approved':'pending',now(),Date.now()+300000).run();await record(owner,p.id,allowed?'permission.rule_applied':'permission.requested',{id,command,shell:b.shell,network:false,revision:p.revision});
 return Response.json({id,approved:allowed,command,shell:b.shell,pattern,revision:p.revision});
 }
 if(b.action==='execute'){
 const approval=await db().prepare("SELECT * FROM approvals WHERE id=? AND project=? AND owner=? AND kind='command' AND state='approved' AND expires>?").bind(b.approval,p.id,owner,Date.now()).first<{payload:string;revision:number}>();if(!approval)throw new Error('Command approval is missing, expired, or already consumed.');if(approval.revision!==p.revision)throw new Error('409:Files changed after approval. Review the command again.');
 const claimed=await db().prepare("UPDATE approvals SET state='executing' WHERE id=? AND owner=? AND state='approved'").bind(b.approval,owner).run();if(!claimed.meta.changes)throw new Error('Command already started.');
 const action=JSON.parse(approval.payload);let sandbox:Sandbox|undefined;
 try{
 sandbox=await Sandbox.create(c.model||'base',{apiKey:c.key,timeoutMs:120000,allowInternetAccess:false});
 await sandbox.files.makeDir('/home/user/workspace');
 await sandbox.files.write(Object.entries(JSON.parse(p.files) as Record<string,string>).map(([path,data])=>({path:'/home/user/workspace/'+path,data})));
 // User commands execute exclusively in the remote VM. No host shell, credentials, or API environment is exposed.
 const script=action.shell==='pwsh'?"pwsh -NoLogo -NonInteractive -EncodedCommand "+btoa(String.fromCharCode(...new Uint8Array(new Uint16Array(Array.from({length:action.command.length},(_,i)=>action.command.charCodeAt(i))).buffer))):action.command;
 await record(owner,p.id,'command.started',{id:b.approval,command:action.command,shell:action.shell,sandbox:sandbox.sandboxId});
 const result=await sandbox.commands.run(script,{cwd:'/home/user/workspace',timeoutMs:60000,user:'user'});
 await db().prepare("UPDATE approvals SET state='completed' WHERE id=? AND owner=?").bind(b.approval,owner).run();await record(owner,p.id,'command.completed',{id:b.approval,exitCode:result.exitCode});
 return Response.json({stdout:result.stdout.slice(0,150000),stderr:result.stderr.slice(0,150000),exitCode:result.exitCode,note:'Ephemeral sandbox closed. Files created by the command are not imported automatically.'});
 }catch(e){await db().prepare("UPDATE approvals SET state='failed' WHERE id=? AND owner=?").bind(b.approval,owner).run();await record(owner,p.id,'command.failed',{id:b.approval});const result=e as {stdout?:string;stderr?:string;exitCode?:number};if(typeof result.exitCode==='number')return Response.json({stdout:(result.stdout||'').slice(0,150000),stderr:(result.stderr||'').slice(0,150000),exitCode:result.exitCode});throw new Error('Sandbox execution failed. Check your E2B key, template, and runtime availability. PowerShell requires a template with pwsh installed.');}
 finally{if(sandbox)await sandbox.kill().catch(()=>{});}
 }
 throw new Error('Unknown runtime action.');
 }
