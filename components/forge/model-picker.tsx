'use client';
import {useState} from 'react';
import {Check,ChevronDown,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Command,CommandInput,CommandList,CommandEmpty,CommandItem} from '@/components/ui/command';
export default function ModelPicker({value,onChange,items,onRefresh,refreshing}:{value:string;onChange:(value:string)=>void;items:{value:string;label:string}[];onRefresh:()=>void;refreshing:boolean}){
 const [open,setOpen]=useState(false);
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" role="combobox" aria-label="AI model" aria-expanded={open} className="model-picker-trigger"><span>{items.find(m=>m.value===value)?.label||value}</span><ChevronDown size={13}/></Button></PopoverTrigger><PopoverContent className="model-picker-popup" align="end"><Command filter={(value,search)=>value.toLowerCase().includes(search.toLowerCase())?1:0}><CommandInput placeholder="Search models or providers…" aria-label="Search AI models"/><CommandList><CommandEmpty>No matching model. Add an exact model ID in Connections.</CommandEmpty>{items.map(m=><CommandItem key={m.value} value={m.value+' '+m.label} onSelect={()=>{onChange(m.value);setOpen(false);}}><Check size={13} style={{opacity:value===m.value?1:0}}/><span>{m.label}</span></CommandItem>)}</CommandList></Command><div className="model-picker-footer"><span>{items.length-1} model routes</span><Button size="sm" variant="ghost" disabled={refreshing} onClick={onRefresh}><RefreshCw size={12} className={refreshing?'spin':''}/>Refresh catalogs</Button></div></PopoverContent></Popover>;
}
