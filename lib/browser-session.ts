export function browserSessionExpiry(value:unknown,now=Date.now(),maxLifetimeMs=600000){
 const fallback=now+maxLifetimeMs;
 if(value===undefined||value===null||value==='')return fallback;
 if(typeof value!=='string')throw new Error('Browser service returned an invalid session expiry.');
 const parsed=Date.parse(value);
 if(!Number.isFinite(parsed)||parsed<=now)throw new Error('Browser service returned an invalid session expiry.');
 return Math.min(parsed,fallback);
}
