export type DiscoveredModel={provider:string;id:string;label:string;reasoning:boolean;family:string;contextWindow:number|null;outputLimit:number|null;pricing?:{prompt?:string;completion?:string};source:string};
const positive=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:null;
export function normalizeModels(provider:string,data:any):DiscoveredModel[]{
 const list=Array.isArray(data)?data:data?.data||data?.models;if(!Array.isArray(list))throw new Error('The provider returned an invalid model catalog.');
 const result=new Map<string,DiscoveredModel>();
 for(const m of list){
  const id=String(m.id||m.name||'').replace(/^models\//,'');if(!id||id.length>240)continue;
  if(m.architecture?.output_modalities&&!m.architecture.output_modalities.includes('text'))continue;
  if(m.supportedGenerationMethods&&!m.supportedGenerationMethods.includes('generateContent'))continue;
  if(m.type&&['embedding','image','audio','rerank','moderation'].includes(m.type))continue;
  if(m.endpoints&&!m.endpoints.some((x:string)=>['chat','generate'].includes(x)))continue;
  if(/^(text-embedding|embed-|whisper|tts-|dall-e|gpt-image|omni-moderation)/.test(id)||/realtime|transcribe/.test(id))continue;
  result.set(id,{id,label:String(m.display_name||m.displayName||m.name||id).replace(/^models\//,''),provider,family:provider==='openrouter'?id.split('/')[0]:provider,reasoning:provider==='openrouter'?(m.supported_parameters||[]).includes('reasoning'):provider==='openai'?/^(gpt-5|gpt-6|o[134])/.test(id):provider==='google'&&/^gemini-3/.test(id),contextWindow:positive(m.context_length||m.context_window||m.inputTokenLimit),outputLimit:positive(m.outputTokenLimit||m.top_provider?.max_completion_tokens),...(m.pricing?{pricing:{prompt:m.pricing.prompt,completion:m.pricing.completion}}:{}),source:'provider-catalog'});
 }
 return [...result.values()];
}
