import type {DiscoveredModel} from './model-discovery.ts';
import {providerCatalog} from './providers.ts';

export type PickerConnection={provider:string;model:string};
export type ModelPickerItem={value:string;label:string;group:string};

export function buildModelPickerItems(discovered:DiscoveredModel[],connections:PickerConnection[]):ModelPickerItem[]{
 const configured=new Set(connections.map(connection=>connection.provider));
 const group=(provider:string)=>providerCatalog[provider]?.label||provider;
 const items:ModelPickerItem[]=[
  {value:'auto',label:'Astra Max · Auto route',group:'Astra'},
  ...discovered.map(model=>({value:model.provider+':'+model.id,label:model.label+(configured.has(model.provider)?'':' · connect'),group:group(model.provider)})),
  ...connections.filter(connection=>['openai','anthropic','google'].includes(providerCatalog[connection.provider]?.kind)).map(connection=>({value:connection.provider+':'+connection.model,label:connection.model+' · configured',group:group(connection.provider)}))
 ];
 return Array.from(new Map(items.map(item=>[item.value,item])).values());
}

export function manualModelNeedsConnection(value:string,connections:PickerConnection[]){
 if(value==='auto')return false;
 const split=value.indexOf(':');
 if(split<=0)return true;
 return !connections.some(connection=>connection.provider===value.slice(0,split));
}
