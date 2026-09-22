import {providerIssueFromValue,readProviderError} from './provider-errors.ts';
export const providerCatalog:Record<string,{label:string;model:string;kind:'openai'|'anthropic'|'google'|'runtime'|'git'|'plugin'|'browser';url?:string;modelsUrl?:string;streamUsage?:boolean}>={
 openai:{label:'OpenAI',model:'gpt-6-astra',kind:'openai',url:'https://api.openai.com/v1/chat/completions'},
 anthropic:{label:'Anthropic',model:'claude-fable-5-1',kind:'anthropic',url:'https://api.anthropic.com/v1/messages'},
 google:{label:'Google Gemini',model:'gemini-3.8-flash',kind:'google',url:'https://generativelanguage.googleapis.com/v1beta/models/'},
 xai:{label:'xAI',model:'grok-4.6',kind:'openai',url:'https://api.x.ai/v1/chat/completions'},
 deepseek:{label:'DeepSeek',model:'deepseek-chat',kind:'openai',url:'https://api.deepseek.com/chat/completions'},
 mistral:{label:'Mistral',model:'mistral-medium-latest',kind:'openai',url:'https://api.mistral.ai/v1/chat/completions'},
 together:{label:'Together AI',model:'',kind:'openai',url:'https://api.together.xyz/v1/chat/completions'},
 fireworks:{label:'Fireworks',model:'',kind:'openai',url:'https://api.fireworks.ai/inference/v1/chat/completions'},
 groq:{label:'Groq',model:'',kind:'openai',url:'https://api.groq.com/openai/v1/chat/completions'},
 ollama:{label:'Ollama Cloud',model:'gemma4:31b',kind:'openai',url:'https://ollama.com/v1/chat/completions',modelsUrl:'https://ollama.com/api/tags',streamUsage:false},
 openrouter:{label:'OpenRouter',model:'openrouter/auto',kind:'openai',url:'https://openrouter.ai/api/v1/chat/completions',modelsUrl:'https://openrouter.ai/api/v1/models',streamUsage:true},
 cerebras:{label:'Cerebras',model:'gpt-oss-120b',kind:'openai',url:'https://api.cerebras.ai/v1/chat/completions',modelsUrl:'https://api.cerebras.ai/v1/models',streamUsage:false},
 sambanova:{label:'SambaNova',model:'MiniMax-M2.7',kind:'openai',url:'https://api.sambanova.ai/v1/chat/completions',modelsUrl:'https://api.sambanova.ai/v1/models',streamUsage:false},
 moonshot:{label:'Moonshot · Kimi',model:'kimi-k2.5',kind:'openai',url:'https://api.moonshot.ai/v1/chat/completions',modelsUrl:'https://api.moonshot.ai/v1/models',streamUsage:false},
 zai:{label:'Z.AI · GLM',model:'glm-5.1',kind:'openai',url:'https://api.z.ai/api/paas/v4/chat/completions',streamUsage:false},
 minimax:{label:'MiniMax',model:'MiniMax-M2.7',kind:'openai',url:'https://api.minimax.io/v1/chat/completions',modelsUrl:'https://api.minimax.io/v1/models',streamUsage:false},
 nvidia:{label:'NVIDIA NIM',model:'nvidia/llama-3.1-nemotron-70b-instruct',kind:'openai',url:'https://integrate.api.nvidia.com/v1/chat/completions',modelsUrl:'https://integrate.api.nvidia.com/v1/models',streamUsage:false},
 cohere:{label:'Cohere',model:'command-a-plus-05-2026',kind:'openai',url:'https://api.cohere.ai/compatibility/v1/chat/completions',modelsUrl:'https://api.cohere.com/v1/models?page_size=1000',streamUsage:false},
 perplexity:{label:'Perplexity',model:'sonar',kind:'openai',url:'https://api.perplexity.ai/chat/completions',streamUsage:false},
 browserbase:{label:'Browserbase',model:'default',kind:'browser'},
 e2b:{label:'E2B sandbox',model:'base',kind:'runtime'},
 higgsfield:{label:'Higgsfield MCP',model:'mcp',kind:'plugin',url:'https://mcp.higgsfield.ai/mcp'},
 github:{label:'GitHub',model:'',kind:'git'}
};
export type ChatTurn={role:'user'|'assistant';content:string};
export class ProviderFailure extends Error {status:number;retryAfter:number;detail?:string;code?:string;constructor(status:number,retryAfter:number=0,detail?:string,code?:string){super(detail||`Engine request failed (${status}).`);this.status=status;this.retryAfter=retryAfter;this.detail=detail;this.code=code;}}
export function retryAfterSeconds(value:string|null,now=Date.now()){if(!value)return 0;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return Math.min(86400,Math.ceil(seconds));const at=Date.parse(value);if(!Number.isFinite(at))return 0;return Math.min(86400,Math.max(0,Math.ceil((at-now)/1000)));}
export async function* sseData(stream:ReadableStream<Uint8Array>){const reader=stream.getReader();const decoder=new TextDecoder();let buffer='';try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let m;while((m=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,m.index);buffer=buffer.slice(m.index+m[0].length);const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)yield data;}if(done)break;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
export async function* generate(provider:string,key:string,model:string,system:string,messages:ChatTurn[],signal:AbortSignal,options:{maxTokens?:number;reasoning?:string;onMeta?:(value:Record<string,unknown>)=>void}={}){
 const p=providerCatalog[provider];if(!p?.url)throw new Error('Unsupported engine.');let url=p.url;let payload:unknown;let headers:Record<string,string>={'Content-Type':'application/json'};
 if(p.kind==='anthropic'){headers={...headers,'x-api-key':key,'anthropic-version':'2023-06-01'};payload={model,system,messages,max_tokens:options.maxTokens||8192,stream:true};}
 else if(p.kind==='google'){url+=encodeURIComponent(model)+':streamGenerateContent?alt=sse';headers['x-goog-api-key']=key;payload={systemInstruction:{parts:[{text:system}]},contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:options.maxTokens||8192}};}
 else{headers.Authorization=`Bearer ${key}`;payload={model,messages:[{role:'system',content:system},...messages],stream:true,stream_options:{include_usage:true},max_completion_tokens:options.maxTokens||8192};if(provider!=='openai'){delete (payload as Record<string,unknown>).max_completion_tokens;(payload as Record<string,unknown>).max_tokens=options.maxTokens||8192;}}
 if(p.kind==='openai'&&p.streamUsage===false)delete (payload as any).stream_options;
 if(options.reasoning&&options.reasoning!=='auto'){
 if(provider==='openrouter')(payload as any).reasoning={effort:options.reasoning,exclude:true};
 if(provider==='openai'&&/^(gpt-6|gpt-5\.6|gpt-5\.5|o[34])/.test(model))(payload as Record<string,unknown>).reasoning_effort=options.reasoning;
 if(provider==='google'&&/^gemini-3/.test(model))((payload as any).generationConfig).thinkingConfig={thinkingLevel:options.reasoning.toUpperCase()};
 }
 const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal,redirect:'error'});
 const limits:Record<string,string>={};for(const [k,v] of response.headers)if(/^(x-ratelimit-|anthropic-ratelimit-|retry-after)/.test(k))limits[k]=v;
 options.onMeta?.({provider,model,limits,httpStatus:response.status});
 if(!response.ok){const issue=await readProviderError(response,key,provider);options.onMeta?.({provider,model,error:issue});throw new ProviderFailure(response.status,retryAfterSeconds(response.headers.get('retry-after')),issue.hint+(issue.detail?' '+issue.detail:''),issue.code);}
 if(!response.body)throw new ProviderFailure(502);
 let completed=false;
 for await(const data of sseData(response.body)){
  if(data==='[DONE]'){completed=true;break;}
  let v;try{v=JSON.parse(data);}catch{throw new ProviderFailure(502);}
  const usage=v.usage||v.usageMetadata||v.message?.usage;if(usage)options.onMeta?.({provider,model,usage});
  if(v.error||v.type==='error'){const issue=providerIssueFromValue(v,502,key,provider);options.onMeta?.({provider,model,error:issue});throw new ProviderFailure(issue.httpStatus,0,issue.hint+(issue.detail?' '+issue.detail:''),issue.code);}
  let chunk='';
  if(p.kind==='anthropic'){if(v.type==='content_block_delta'&&v.delta?.type==='text_delta')chunk=v.delta.text;if(v.type==='message_stop')completed=true;}
  else if(p.kind==='google'){chunk=(v.candidates?.[0]?.content?.parts||[]).map((x:{text?:string;thought?:boolean})=>x.thought?'':x.text||'').join('');if(v.candidates?.[0]?.finishReason)completed=true;}
  else{chunk=v.choices?.[0]?.delta?.content||'';if(v.choices?.[0]?.finish_reason)completed=true;}
  if(chunk)yield chunk;
 }
 if(!completed)throw new ProviderFailure(502);
}
