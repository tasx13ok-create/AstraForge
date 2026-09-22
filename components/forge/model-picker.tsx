'use client';
import {useMemo,useState} from 'react';
import {Check,ChevronDown,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem} from '@/components/ui/command';
import type {ModelPickerItem} from '@/lib/model-picker-items';

export default function ModelPicker({value,onChange,items,onRefresh,refreshing}:{value:string;onChange:(value:string)=>void;items:ModelPickerItem[];onRefresh:()=>void;refreshing:boolean}){
 const [open,setOpen]=useState(false);
 const groups=useMemo(()=>Array.from(new Set(items.map(item=>item.group))),[items]);
 const choose=(next:string)=>{onChange(next);setOpen(false);};
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" role="combobox" aria-label="AI model" aria-expanded={open} className="model-picker-trigger"><span>{items.find(m=>m.value===value)?.label||value}</span><ChevronDown size={13}/></Button></PopoverTrigger><PopoverContent className="model-picker-popup" align="end"><Command filter={(entry,search)=>entry.toLowerCase().includes(search.toLowerCase())?1:0}><CommandInput placeholder="Search models or providers…" aria-label="Search AI models"/><CommandList><CommandEmpty>No matching model. Add an exact model ID in Connections.</CommandEmpty>{groups.map(group=><CommandGroup key={group} heading={group}>{items.filter(item=>item.group===group).map(item=><CommandItem key={item.value} value={item.value+' '+item.label+' '+item.group} onSelect={()=>choose(item.value)}><Check size={13} style={{opacity:value===item.value?1:0}}/><span>{item.label}</span></CommandItem>)}</CommandGroup>)}</CommandList></Command><div className="model-picker-footer"><span>{items.length-1} model routes</span><Button size="sm" variant="ghost" disabled={refreshing} onClick={onRefresh}><RefreshCw size={12} className={refreshing?'spin':''}/>Refresh catalogs</Button></div></PopoverContent></Popover>;
}
