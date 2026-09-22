export function safeProviderDetail(value:unknown,key=''){
 let text=typeof value==='string'?value:'';if(key)text=text.split(key).join('[redacted]');
 return text.replace(/(?:sk-|bb_live_|bb_test_)[A-Za-z0-9_-]{8,}/g,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,650);
}
export function providerHint(status:number,code:string,provider=''){
 if(/insufficient_quota|credit_balance_exhausted/.test(code))return 'API credit or quota is exhausted. Check the connected provider’s API billing and usage limits. Chat subscriptions do not supply API credit.';
 if(/spend_limit|usage_limit/.test(code))return 'The connected API account has reached a spending or usage limit. Review that account’s limits before retrying.';
 if(status===401)return 'The service rejected this API key. Check that it belongs to this provider and has not expired or been revoked.';
 if(status===403)return provider==='browserbase'?'Browserbase rejected this session feature. Check account permissions and plan support; AstraForge persistent sessions require keep-alive support.':'The API account is not permitted to use this service or feature. Check model entitlement, project permissions and plan restrictions.';
 if(status===404||code==='model_not_found')return 'This model ID is unavailable to the API account. Refresh available models and select an ID returned by the provider.';
 if(status===429)return provider==='browserbase'?'Browserbase reported a session, concurrency, or rate limit. Check active sessions and the account limit before retrying.':'The service reported a rate or quota limit. Check the error code and API billing; wait for the reported reset before retrying a temporary rate limit.';
 if(status>=500)return 'The upstream service is temporarily unavailable. Try again later.';
 if(provider==='browserbase')return 'The API key identifies the Browserbase project. Check session availability and plan features; AstraForge persistent sessions require keep-alive support.';
 return 'Check the provider’s reported request error and selected model settings.';
}
export async function readProviderError(response:Response,key='',provider=''){
 let value:any;try{value=await response.json();}catch{value={};}
 const error=value.error||value;const code=safeProviderDetail(typeof error==='object'?error.code||error.type||'':'',key);const detail=safeProviderDetail(typeof error==='string'?error:error.message||value.message,key);
 return {code,detail,hint:providerHint(response.status,code,provider),httpStatus:response.status};
}
