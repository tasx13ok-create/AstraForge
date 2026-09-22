import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const required=[
 'ASTRA_WORKER_NAME',
 'ASTRA_API_ORIGIN',
 'ASTRA_FRONTEND_ORIGIN',
 'ASTRA_OWNER_ID',
 'CLOUDFLARE_D1_DATABASE_ID',
 'CLOUDFLARE_D1_DATABASE_NAME'
];
const missing=required.filter(name=>!process.env[name]?.trim());
if(missing.length)throw new Error('Missing deployment configuration: '+missing.join(', '));

function origin(name){
 const value=process.env[name].trim();
 const url=new URL(value);
 if(url.protocol!=='https:')throw new Error(name+' must use https.');
 if(url.pathname!=='/'||url.search||url.hash)throw new Error(name+' must be an origin without a path, query, or hash.');
 return url.origin;
}

const source=resolve('dist/server/wrangler.json');
const target=resolve('dist/server/wrangler.production.json');
const config=JSON.parse(await readFile(source,'utf8'));

config.name=process.env.ASTRA_WORKER_NAME.trim();
config.d1_databases=[{
 binding:'DB',
 database_name:process.env.CLOUDFLARE_D1_DATABASE_NAME.trim(),
 database_id:process.env.CLOUDFLARE_D1_DATABASE_ID.trim(),
 migrations_dir:'../../drizzle'
}];
config.vars={
 ...(config.vars||{}),
 ASTRA_API_ORIGIN:origin('ASTRA_API_ORIGIN'),
 ASTRA_FRONTEND_ORIGIN:origin('ASTRA_FRONTEND_ORIGIN'),
 ASTRA_OWNER_ID:process.env.ASTRA_OWNER_ID.trim()
};
config.secrets={
 ...(config.secrets||{}),
 required:['FORGE_VAULT_KEY','ASTRA_ACCESS_TOKEN','ASTRA_SESSION_SECRET']
};

await writeFile(target,JSON.stringify(config,null,2)+'\n');
console.log('Prepared '+target+' for Worker '+config.name+'.');
