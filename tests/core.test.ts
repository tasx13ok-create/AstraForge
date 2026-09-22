import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFiles} from '../lib/templates.ts';
import {sseData,generate,ProviderFailure} from '../lib/providers.ts';

test('workspace traversal, absolute paths and non-text values are rejected',()=>{
 for(const path of ['../secret','/etc/passwd','a/../../b','x\\y','a//b','./a','a\0b'])assert.throws(()=>validateFiles({[path]:'x'}));
 assert.throws(()=>validateFiles({'safe.txt':42}));assert.deepEqual(validateFiles({'src/main.ts':'export {}'}),{'src/main.ts':'export {}'});
});
test('file count and project size bounds are enforced',()=>{
 assert.throws(()=>validateFiles(Object.fromEntries(Array.from({length:151},(_,i)=>['f'+i,'']))));
 assert.throws(()=>validateFiles({'large.txt':'a'.repeat(1500001)}));
});
test('SSE parser preserves split UTF-8 and CRLF boundaries',async()=>{
 const bytes=new TextEncoder().encode('data: {"text":"🙂"}\r\n\r\ndata: [DONE]\n\n');
 const stream=new ReadableStream<Uint8Array>({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}});
 const seen=[];for await(const data of sseData(stream))seen.push(data);assert.deepEqual(seen,['{"text":"🙂"}','[DONE]']);
});
test('SSE multiline data and ignored comments are handled',async()=>{
 const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode(': heartbeat\ndata: one\ndata: two\n\n'));c.close();}});
 const seen=[];for await(const data of sseData(stream))seen.push(data);assert.deepEqual(seen,['one\ntwo']);
});
test('truncated provider stream is never reported as complete',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',{headers:{'content-type':'text/event-stream'}});
 try{let output='';await assert.rejects(async()=>{for await(const chunk of generate('openai','test-key','gpt-6-astra','system',[{role:'user',content:'hi'}],new AbortController().signal))output+=chunk;},ProviderFailure);assert.equal(output,'partial');}finally{globalThis.fetch=original;}
});
test('actual quota headers and usage are surfaced, reasoning and cap reach provider',async()=>{
 const original=globalThis.fetch;let payload:any;const metadata:any[]=[];
 globalThis.fetch=async(_url,init)=>{payload=JSON.parse(String(init?.body));return new Response('data: {"choices":[{"delta":{"content":"answer"},"finish_reason":null}]}\n\ndata: {"usage":{"prompt_tokens":17,"completion_tokens":4},"choices":[]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream','x-ratelimit-remaining-requests':'23'}});};
 try{let result='';for await(const chunk of generate('openai','test-key','gpt-6-astra','system',[{role:'user',content:'hi'}],new AbortController().signal,{maxTokens:4096,reasoning:'high',onMeta:m=>metadata.push(m)}))result+=chunk;assert.equal(result,'answer');assert.equal(payload.reasoning_effort,'high');assert.equal(payload.max_completion_tokens,4096);assert.equal(metadata[0].limits['x-ratelimit-remaining-requests'],'23');assert.equal(metadata[1].usage.prompt_tokens,17);}finally{globalThis.fetch=original;}
});
test('429 raises an explicit retry-after error',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:429,headers:{'retry-after':'12'}});
 try{await assert.rejects(async()=>{for await(const _ of generate('openai','test-key','gpt-6-astra','system',[],new AbortController().signal)){}},(e:any)=>e instanceof ProviderFailure&&e.status===429&&e.retryAfter===12);}finally{globalThis.fetch=original;}
});

import {parseAgentAction} from '../lib/agent-protocol.ts';
test('agent protocol accepts exactly one known structured action',()=>{
 assert.equal(parseAgentAction('{"type":"command","summary":"Run tests","command":"npm test","shell":"bash"}').type,'command');
 assert.throws(()=>parseAgentAction('{"type":"eval","code":"anything"}'));
 assert.throws(()=>parseAgentAction('{"type":"command","summary":"Run","command":"npm test","shell":"bash","approved":true}'));
 assert.throws(()=>parseAgentAction('{"type":"command","summary":"Run","command":"npm test","shell":"host"}'));
 assert.throws(()=>parseAgentAction('I already changed all your files.'));
});
test('agent rejects partial or multiple JSON actions without execution',()=>{
 assert.throws(()=>parseAgentAction('{"type":"write_files","summary":"Edit","files":'));
 assert.throws(()=>parseAgentAction('{"type":"done","summary":"one"}{"type":"done","summary":"two"}'));
});

import {normalizeModels} from '../lib/model-discovery.ts';
test('catalog keeps more than 500 routes and filters non-chat models',()=>{
 const result=normalizeModels('openrouter',{data:[...Array.from({length:650},(_,i)=>({id:'author/model-'+i,name:'Model '+i,architecture:{output_modalities:['text']},supported_parameters:['reasoning'],context_length:100000,top_provider:{max_completion_tokens:8000}})),{id:'image-only',architecture:{output_modalities:['image']}}]});
 assert.equal(result.length,650);assert.equal(result[0].reasoning,true);assert.equal(result[0].contextWindow,100000);assert.equal(result[0].outputLimit,8000);
});
test('catalog normalizes native IDs and rejects malformed lists',()=>{
 assert.deepEqual(normalizeModels('google',{models:[{name:'models/gemini-3.1-pro',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]}).map(m=>m.id),['gemini-3.1-pro']);
 assert.throws(()=>normalizeModels('openai',{error:'bad'}));
});

import {providerHint,safeProviderDetail} from '../lib/provider-errors.ts';
test('quota failures explain billing separately from temporary rate limits',()=>{
 assert.match(providerHint(429,'insufficient_quota'),/credit or quota is exhausted/);
 assert.match(providerHint(429,'rate_limit_exceeded'),/rate or quota limit/);
 assert.match(providerHint(404,'model_not_found'),/model ID is unavailable/);
 assert.equal(safeProviderDetail('rejected secret-value','secret-value'),'rejected [redacted]');
});


import {navigateAndObserve} from '../lib/browser-cdp.ts';
test('browser navigation waits for a readable document and returns the observation',async()=>{
 let clock=0,reads=0;
 const call=async(method:string)=>{
  if(method==='Page.navigate')return {frameId:'frame-1'};
  if(method==='Runtime.evaluate'){
   reads++;
   const value=reads===1?{url:'https://example.com/',title:'',text:'',readyState:'loading'}:{url:'https://example.com/',title:'Example Domain',text:'Example Domain',readyState:'complete'};
   return {result:{value:JSON.stringify(value)}};
  }
  throw new Error('Unexpected CDP method '+method);
 };
 const result=await navigateAndObserve(call,'session-1','https://example.com/',{timeoutMs:1000,pollMs:100,minSettleMs:200,now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(result.settled,true);
 assert.equal(result.title,'Example Domain');
 assert.equal(result.text,'Example Domain');
 assert.equal(result.readyState,'complete');
});
test('browser navigation returns the last observation instead of hanging forever',async()=>{
 let clock=0;
 const call=async(method:string)=>{
  if(method==='Page.navigate')return {};
  if(method==='Runtime.evaluate')return {result:{value:JSON.stringify({url:'https://slow.example/',title:'Loading',text:'partial',readyState:'loading'})}};
  throw new Error('Unexpected CDP method '+method);
 };
 const result=await navigateAndObserve(call,'session-1','https://slow.example/',{timeoutMs:300,pollMs:100,minSettleMs:0,now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(result.settled,false);
 assert.equal(result.text,'partial');
 assert.match(result.warning||'',/stable readable document/);
});

test('Browserbase plan and session errors do not ask for a separate project id',()=>{
 assert.match(providerHint(403,'feature_not_available','browserbase'),/keep-alive support/);
 assert.match(providerHint(429,'rate_limit','browserbase'),/active sessions/);
 assert.doesNotMatch(providerHint(400,'bad_request','browserbase'),/project ID/i);
});

import {selectChatRoutes,shouldFailoverRoute} from '../lib/chat-routing.ts';
import {buildModelPickerItems,manualModelNeedsConnection} from '../lib/model-picker-items.ts';
test('manual model routing never silently switches providers',()=>{
 const routes=[{provider:'openai',model:'default-openai',secret:'a'},{provider:'anthropic',model:'default-anthropic',secret:'b'}];
 assert.deepEqual(selectChatRoutes(routes),routes);
 assert.deepEqual(selectChatRoutes(routes,'openai','gpt-custom'),[{provider:'openai',model:'gpt-custom',secret:'a'}]);
 assert.throws(()=>selectChatRoutes(routes,'google','gemini-custom'),/not connected/);
 const agentRoutes=[{provider:'openai',model:'default-openai'},{provider:'anthropic',model:'default-anthropic'}];
 assert.deepEqual(selectChatRoutes(agentRoutes,'anthropic','claude-custom'),[{provider:'anthropic',model:'claude-custom'}]);
});
test('auto failover retries only safe provider-local failures',()=>{
 assert.equal(shouldFailoverRoute(429,false),true);
 assert.equal(shouldFailoverRoute(503,true),true);
 assert.equal(shouldFailoverRoute(0,true),true);
 assert.equal(shouldFailoverRoute(401,false),true);
 assert.equal(shouldFailoverRoute(404,false),true);
 assert.equal(shouldFailoverRoute(401,true),false);
 assert.equal(shouldFailoverRoute(403,false),false);
 assert.equal(shouldFailoverRoute(400,false),false);
});
test('configured custom model remains selectable without discovery',()=>{
 const items=buildModelPickerItems([],[{provider:'openai',model:'gpt-custom'},{provider:'browserbase',model:'default'}]);
 assert(items.some(item=>item.value==='openai:gpt-custom'&&item.label.includes('configured')));
 assert(!items.some(item=>item.value==='browserbase:default'));
 assert.equal(manualModelNeedsConnection('openai:gpt-custom',[{provider:'openai',model:'gpt-custom'}]),false);
 assert.equal(manualModelNeedsConnection('openai:gpt-custom',[]),true);
 assert.equal(manualModelNeedsConnection('auto',[]),false);
});

import {providerIssueFromValue,providerIssueText} from '../lib/provider-errors.ts';
test('provider issue parsing preserves streamed rate-limit detail safely',()=>{
 const issue=providerIssueFromValue({error:{type:'rate_limit_exceeded',message:'slow down secret-key'}},502,'secret-key','openai');
 assert.equal(issue.httpStatus,429);assert.equal(issue.code,'rate_limit_exceeded');assert.equal(issue.detail,'slow down [redacted]');assert.match(providerIssueText(issue),/rate_limit_exceeded · HTTP 429/);
});
test('streamed provider errors retain inferred status and sanitized diagnostics',async()=>{
 const original=globalThis.fetch,metadata:any[]=[];globalThis.fetch=async()=>new Response('data: {"error":{"type":"rate_limit_exceeded","message":"retry test-key"}}\n\n',{headers:{'content-type':'text/event-stream'}});
 try{await assert.rejects(async()=>{for await(const _ of generate('openai','test-key','gpt-6-astra','system',[],new AbortController().signal,{onMeta:m=>metadata.push(m)})){}},(e:any)=>e instanceof ProviderFailure&&e.status===429&&e.code==='rate_limit_exceeded'&&!e.message.includes('test-key'));assert.equal((metadata.at(-1) as any).error.httpStatus,429);}finally{globalThis.fetch=original;}
});
