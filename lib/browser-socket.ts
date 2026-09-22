export type BrowserSocket={
 send(data:string):void;
 close(code?:number,reason?:string):void;
 addEventListener(type:string,listener:(event:any)=>void):void;
 accept?:()=>void;
};

type SocketConstructor=new(url:string)=>BrowserSocket;
type OpenBrowserSocketOptions={
 fetcher?:typeof fetch;
 WebSocketCtor?:SocketConstructor;
 timeoutMs?:number;
};

export async function openBrowserSocket(url:string,options:OpenBrowserSocketOptions={}):Promise<BrowserSocket>{
 const timeoutMs=Math.max(1000,Math.min(30000,options.timeoutMs??15000));
 const fetcher=options.fetcher??fetch;
 try{
  const response=await fetcher(url.replace(/^wss:/,'https:'),{headers:{Upgrade:'websocket'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  const socket=(response as Response&{webSocket?:BrowserSocket}).webSocket;
  if(socket){socket.accept?.();return socket;}
 }catch{}
 const Ctor=options.WebSocketCtor??(globalThis.WebSocket as unknown as SocketConstructor|undefined);
 if(typeof Ctor!=='function')throw new Error('The browser control connection is unavailable in this runtime.');
 return new Promise<BrowserSocket>((resolve,reject)=>{
  let settled=false,socket:BrowserSocket;
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){try{socket.close();}catch{}reject(error);}else resolve(socket);};
  const timer=setTimeout(()=>finish(new Error('Browser control connection timed out.')),timeoutMs);
  try{socket=new Ctor(url);}catch{clearTimeout(timer);reject(new Error('The browser control connection could not be opened.'));return;}
  socket.addEventListener('open',()=>finish());
  socket.addEventListener('error',()=>finish(new Error('The browser control connection failed.')));
  socket.addEventListener('close',()=>finish(new Error('The browser control connection closed before it was ready.')));
 });
}
