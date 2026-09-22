export type ModelOption={id:string;label:string;provider:string;reasoning:boolean;family:string;contextWindow?:number|null;outputLimit?:number|null};
// Requested catalog candidates. Availability and limits are verified by the connected provider, not implied by this list.
export const models:ModelOption[]=[
 ...[['gpt-6-astra','GPT-6 Astra'],['gpt-5.6-sol','GPT-5.6 Sol'],['gpt-5.6-terra','GPT-5.6 Terra'],['gpt-5.6-luna','GPT-5.6 Luna'],['gpt-5.5-pro','GPT-5.5 Pro'],['o3','o3'],['o4-mini','o4-mini'],['gpt-5.5-codex','Codex']].map(([id,label])=>({id,label,provider:'openai',reasoning:true,family:'OpenAI'})),
 ...[['claude-fable-5-1','Claude Fable 5.1'],['claude-mythos-5-1','Claude Mythos 5.1'],['claude-opus-5','Claude Opus 5'],['claude-sonnet-5','Claude Sonnet 5'],['claude-haiku-4-5','Claude Haiku']].map(([id,label])=>({id,label,provider:'anthropic',reasoning:false,family:'Anthropic'})),
 ...[['gemini-3.8-flash','Gemini 3.8 Flash'],['gemini-3.1-pro-preview','Gemini 3.1 Pro']].map(([id,label])=>({id,label,provider:'google',reasoning:true,family:'Google'})),
 ...[['grok-4.6','Grok 4.6'],['grok-4.5','Grok 4.5'],['grok-4.20','Grok 4.20'],['grok-build-0.1','Grok Build 0.1']].map(([id,label])=>({id,label,provider:'xai',reasoning:false,family:'xAI'})),
 ...[['deepseek-v4','DeepSeek V4','deepseek'],['deepseek-v4.1-flash','DeepSeek V4.1 Flash','deepseek'],['moonshotai/Kimi-K2.6','Kimi K2.6','together'],['moonshotai/Kimi-K3','Kimi K3','together'],['zai-org/GLM-5.3','GLM-5.3','together'],['zai-org/GLM-5.1','GLM-5.1','together'],['mistral-medium-latest','Mistral Medium 3.5','mistral'],['Qwen/Qwen3.8','Qwen3.8','together']].map(([id,label,provider])=>({id,label,provider,reasoning:false,family:'More engines'}))
];
export const reasoningLevels=['auto','low','medium','high'] as const;
export const pluginCatalog=[
 {id:'browserbase',name:'Browserbase',description:'An isolated cloud browser with a live viewer, reviewed navigation and page reading.',status:'Connect API',category:'Browser'},
 {id:'higgsfield',name:'Higgsfield',description:'Discover and call the tools exposed by your authorized Higgsfield MCP connection.',status:'Connect MCP',category:'Visual & audio',url:'https://mcp.higgsfield.ai/mcp'},
 {id:'github',name:'GitHub',description:'Publish your workspace to a new branch in an existing repository.',status:'Connect token',category:'Source control'},
 {id:'e2b',name:'E2B',description:'Run reviewed bash or PowerShell commands in an isolated remote sandbox.',status:'Connect API',category:'Runtime'},
 {id:'remotion',name:'Remotion',description:'Write React video projects using your AI engine. Rendering requires a connected runtime with packages installed.',status:'Code workflow',category:'Motion'},
 {id:'after-effects',name:'After Effects',description:'Desktop automation requires your licensed Adobe installation and a separately deployed local bridge.',status:'Bridge required',category:'Desktop'},
 {id:'blender',name:'Blender',description:'Generate Python scene scripts with your AI engine. Rendering requires a runtime template containing Blender.',status:'Runtime required',category:'3D'}
];
