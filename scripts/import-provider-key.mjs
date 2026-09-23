#!/usr/bin/env node
import {createInterface} from 'node:readline';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,webcrypto} from 'node:crypto';

const PROVIDERS={
  openai:{env:['OPENAI_API_KEY'],model:'gpt-6-astra'},
  anthropic:{env:['ANTHROPIC_API_KEY'],model:'claude-fable-5-1'},
  google:{env:['GEMINI_API_KEY','GOOGLE_API_KEY'],model:'gemini-3.8-flash'},
  xai:{env:['XAI_API_KEY'],model:'grok-4.6'},
  deepseek:{env:['DEEPSEEK_API_KEY'],model:'deepseek-chat'},
  mistral:{env:['MISTRAL_API_KEY'],model:'mistral-medium-latest'},
  together:{env:['TOGETHER_API_KEY'],model:''},
  fireworks:{env:['FIREWORKS_API_KEY'],model:''},
  groq:{env:['GROQ_API_KEY'],model:''},
  ollama:{env:['OLLAMA_API_KEY'],model:'gemma4:31b'},
  openrouter:{env:['OPENROUTER_API_KEY'],model:'openrouter/auto'},
  cerebras:{env:['CEREBRAS_API_KEY'],model:'gpt-oss-120b'},
  sambanova:{env:['SAMBANOVA_API_KEY'],model:'MiniMax-M2.7'},
  moonshot:{env:['MOONSHOT_API_KEY'],model:'kimi-k2.5'},
  zai:{env:['ZAI_API_KEY'],model:'glm-5.1'},
  minimax:{env:['MINIMAX_API_KEY'],model:'MiniMax-M2.7'},
  nvidia:{env:['NVIDIA_API_KEY'],model:'nvidia/llama-3.1-nemotron-70b-instruct'},
  cohere:{env:['COHERE_API_KEY'],model:'command-a-plus-05-2026'},
  perplexity:{env:['PERPLEXITY_API_KEY'],model:'sonar'}
};

function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0?process.argv[i+1]:undefined;
}
function flag(name){return process.argv.includes(name);}
function sql(value){return "'" + String(value).replaceAll("'","''") + "'";}

async function loadConfig(){
  const configPath=resolve(arg('--config')||'dist/server/wrangler.production.json');
  const config=JSON.parse(await readFile(configPath,'utf8'));
  const d1=(config.d1_databases||[]).find(entry=>entry.binding==='DB');
  const owner=String(config.vars?.ASTRA_OWNER_ID||'').trim();
  if(!d1?.database_id||!owner)throw new Error('Production Wrangler config must contain DB and ASTRA_OWNER_ID.');
  return {configPath,owner};
}
async function loadVaultKey(){
  const path=arg('--secrets')||join(homedir(),'.astraforge','production-secrets.json');
  const secrets=JSON.parse(await readFile(path,'utf8'));
  const raw=String(secrets.FORGE_VAULT_KEY||'').trim();
  if(!raw)throw new Error('FORGE_VAULT_KEY is missing from '+path+'.');
  return Uint8Array.from(Buffer.from(raw,'base64'));
}
async function seal(owner,value,keyBytes){
  const key=await webcrypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt']);
  const iv=webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await webcrypto.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},
    key,
    new TextEncoder().encode(value)
  ));
  return Buffer.concat([Buffer.from(iv),Buffer.from(ciphertext)]).toString('base64');
}
function maskedPrompt(label){
  return new Promise((resolve,reject)=>{
    if(!process.stdin.isTTY)throw new Error('Interactive secret entry requires a TTY. Use an environment variable instead.');
    const rl=createInterface({input:process.stdin,output:process.stdout,terminal:true});
    const input=process.stdin;
    const originalRaw=input.isRaw;
    let value='';
    process.stdout.write(label);
    input.setRawMode?.(true);
    input.resume();
    const onData=chunk=>{
      const text=chunk.toString('utf8');
      for(const ch of text){
        if(ch==='\r'||ch==='\n'){
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if(ch==='\u0003'){
          cleanup();
          reject(new Error('Cancelled.'));
          return;
        }
        if(ch==='\u007f'||ch==='\b'){
          value=value.slice(0,-1);
          continue;
        }
        if(ch>=' ')value+=ch;
      }
    };
    function cleanup(){
      input.off('data',onData);
      input.setRawMode?.(Boolean(originalRaw));
      rl.close();
    }
    input.on('data',onData);
  });
}
function findEnv(provider){
  for(const name of provider.env){
    const value=process.env[name]?.trim();
    if(value)return {name,value};
  }
  return null;
}
function runWrangler(configPath,statement){
  const command=process.platform==='win32'?'corepack.cmd':'corepack';
  const result=spawnSync(command,[
    'pnpm','exec','wrangler','d1','execute','DB',
    '--remote','--config',configPath,'--command',statement
  ],{stdio:['ignore','pipe','pipe'],encoding:'utf8'});
  if(result.status!==0)throw new Error((result.stderr||result.stdout||'D1 import failed.').trim());
}
async function importOne(providerId,model,key,config,keyBytes){
  if(!PROVIDERS[providerId])throw new Error('Unsupported provider: '+providerId);
  if(!key||key.length<10||key.length>8192)throw new Error('Provider secret has an invalid length.');
  const selectedModel=String(model||PROVIDERS[providerId].model||'').trim();
  if(!selectedModel)throw new Error('Pass --model for '+providerId+'.');
  if(selectedModel.length>180)throw new Error('Model identifier is too long.');
  const encrypted=await seal(config.owner,key,keyBytes);
  const statement=
    'INSERT INTO connections(id,owner,provider,model,secret,enabled,created) VALUES('+
    [randomUUID(),config.owner,providerId,selectedModel,encrypted,1,new Date().toISOString()].map(sql).join(',')+
    ') ON CONFLICT(owner,provider) DO UPDATE SET model=excluded.model,secret=excluded.secret,enabled=1;';
  runWrangler(config.configPath,statement);
  process.stdout.write(providerId+' connected securely ('+selectedModel+').\n');
}

const config=await loadConfig();
const keyBytes=await loadVaultKey();

if(flag('--scan-env')){
  let count=0;
  for(const [providerId,provider] of Object.entries(PROVIDERS)){
    const found=findEnv(provider);
    if(!found)continue;
    await importOne(providerId,undefined,found.value,config,keyBytes);
    count++;
  }
  process.stdout.write(count?('Imported '+count+' provider connection(s) without printing secrets.\n'):'No supported provider API-key environment variables were found.\n');
  process.exit(0);
}

const providerId=String(arg('--provider')||'').trim().toLowerCase();
if(!PROVIDERS[providerId]){
  process.stderr.write('Usage:\n');
  process.stderr.write('  node scripts/import-provider-key.mjs --scan-env\n');
  process.stderr.write('  node scripts/import-provider-key.mjs --provider groq [--model MODEL] [--env GROQ_API_KEY]\n');
  process.stderr.write('Supported providers: '+Object.keys(PROVIDERS).join(', ')+'\n');
  process.exit(2);
}
const envName=arg('--env');
let secret=envName?process.env[envName]?.trim():findEnv(PROVIDERS[providerId])?.value;
if(!secret)secret=String(await maskedPrompt(providerId+' API key (hidden): ')).trim();
await importOne(providerId,arg('--model'),secret,config,keyBytes);
