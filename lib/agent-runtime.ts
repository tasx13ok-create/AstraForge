import {generate,ProviderFailure,type ChatTurn} from './providers.ts';
import {shouldFailoverRoute} from './chat-routing.ts';

export type AgentInferenceRoute={provider:string;model:string};
export type AgentInferenceConfig={
 provider:string;
 model:string;
 routes?:AgentInferenceRoute[];
 reasoning?:string;
 maxTokens?:number;
};
export type AgentConnection={key:string};
export type AgentConnectionResolver=(provider:string)=>Promise<AgentConnection|null>;

export function agentRoutesFromConfig(config:AgentInferenceConfig){
 const stored=Array.isArray(config.routes)?config.routes.filter(route=>route&&typeof route.provider==='string'&&typeof route.model==='string'&&route.provider&&route.model):[];
 return stored.length?stored:[{provider:config.provider,model:config.model}];
}

export async function runAgentInference(
 config:AgentInferenceConfig,
 system:string,
 turns:ChatTurn[],
 signal:AbortSignal,
 resolveConnection:AgentConnectionResolver,
 maxOutputChars=500000
){
 const routes=agentRoutesFromConfig(config).slice(0,3);
 const meta:unknown[]=[];
 let lastError:unknown=null;
 for(let index=0;index<routes.length;index++){
  const route=routes[index];
  if(signal.aborted)throw signal.reason instanceof Error?signal.reason:new Error('Agent step stopped.');
  const connected=await resolveConnection(route.provider);
  if(!connected){
   const error=new Error('The agent engine was disconnected.');
   meta.push({provider:route.provider,model:route.model,result:'unavailable',error:error.message});
   lastError=error;
   if(routes.length===1)throw error;
   continue;
  }
  let output='';
  const started=Date.now();
  try{
   for await(const chunk of generate(route.provider,connected.key,route.model,system,turns,signal,{
    maxTokens:config.maxTokens,
    reasoning:config.reasoning,
    onMeta:value=>meta.push(value)
   })){
    output+=chunk;
    if(output.length>maxOutputChars)throw new Error('Agent output exceeded the review limit.');
   }
   meta.push({provider:route.provider,model:route.model,ms:Date.now()-started,result:'complete'});
   return {output,meta,engine:route};
  }catch(error){
   lastError=error;
   const status=error instanceof ProviderFailure?error.status:0;
   meta.push({
    provider:route.provider,
    model:route.model,
    ms:Date.now()-started,
    result:'interrupted',
    status,
    retryAfter:error instanceof ProviderFailure?error.retryAfter:0,
    error:error instanceof Error?error.message:'Unknown provider error.'
   });
   if(signal.aborted)throw error;
   if(output.length>0||!shouldFailoverRoute(status,false))throw error;
  }
 }
 throw lastError instanceof Error?lastError:new Error('No configured agent engine could complete this step.');
}
