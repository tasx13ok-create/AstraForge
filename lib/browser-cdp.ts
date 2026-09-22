export type CdpCall=(method:string,params?:unknown,sessionId?:string)=>Promise<any>;

export type BrowserObservation={
 url:string;
 title:string;
 text:string;
 readyState:string;
};

export type NavigationObservation=BrowserObservation&{
 requestedUrl:string;
 settled:boolean;
 warning?:string;
};

const pageObservationExpression='JSON.stringify({url:location.href,title:document.title,text:(document.body?.innerText||"").slice(0,24000),readyState:document.readyState})';

export async function readPageObservation(call:CdpCall,sessionId:string):Promise<BrowserObservation>{
 const result=await call('Runtime.evaluate',{expression:pageObservationExpression,returnByValue:true,awaitPromise:false},sessionId);
 if(result?.exceptionDetails||typeof result?.result?.value!=='string')throw new Error('Page text could not be read.');
 let value:any;
 try{value=JSON.parse(result.result.value);}catch{throw new Error('Page text could not be read.');}
 if(!value||typeof value.url!=='string'||typeof value.title!=='string'||typeof value.text!=='string'||typeof value.readyState!=='string')throw new Error('Page text could not be read.');
 return {url:value.url,title:value.title,text:value.text,readyState:value.readyState};
}

type NavigationOptions={
 timeoutMs?:number;
 pollMs?:number;
 minSettleMs?:number;
 now?:()=>number;
 sleep?:(ms:number)=>Promise<void>;
};

const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export async function navigateAndObserve(call:CdpCall,sessionId:string,url:string,options:NavigationOptions={}):Promise<NavigationObservation>{
 const timeoutMs=Math.max(250,options.timeoutMs??8000);
 const pollMs=Math.max(25,options.pollMs??200);
 const minSettleMs=Math.max(0,options.minSettleMs??400);
 const now=options.now??Date.now;
 const sleep=options.sleep??delay;
 const started=now(),deadline=started+timeoutMs;
 const navigation=await call('Page.navigate',{url},sessionId);
 if(navigation?.errorText)throw new Error('Navigation failed: '+String(navigation.errorText).slice(0,240));
 let last:BrowserObservation|null=null,lastError:unknown=null;
 while(now()<deadline){
  await sleep(Math.min(pollMs,Math.max(0,deadline-now())));
  try{
   const observation=await readPageObservation(call,sessionId);
   last=observation;
   if(observation.readyState!=='loading'&&observation.url!=='about:blank'&&now()-started>=minSettleMs)return {requestedUrl:url,...observation,settled:true};
  }catch(error){lastError=error;}
 }
 if(last)return {requestedUrl:url,...last,settled:false,warning:'Navigation did not reach a stable readable document before the wait limit.'};
 if(lastError instanceof Error)throw lastError;
 throw new Error('Navigation did not produce a readable page before the wait limit.');
}
