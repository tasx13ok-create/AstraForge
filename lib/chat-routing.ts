export type InferenceRoute={provider:string;model:string};

export function selectChatRoutes<T extends InferenceRoute>(routes:T[],preferred?:unknown,model?:unknown){
 if(preferred===undefined||preferred===null||preferred==='')return routes;
 if(typeof preferred!=='string'||preferred.length>80)throw new Error('Invalid preferred provider.');
 const match=routes.find(route=>route.provider===preferred);
 if(!match)throw new Error('Selected AI provider is not connected. Choose Auto route or connect it in Settings.');
 if(model!==undefined&&(typeof model!=='string'||!model.trim()||model.length>180))throw new Error('Invalid model.');
 return [{...match,model:typeof model==='string'?model:match.model}];
}
