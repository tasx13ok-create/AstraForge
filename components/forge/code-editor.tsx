'use client';
import {useEffect,useState} from 'react';
import type {Files} from '@/lib/templates';
export function language(path:string){const ext=path.split('.').pop();return ({js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',json:'json',html:'html',css:'css',md:'markdown',py:'python',ps1:'powershell',sh:'shell',yml:'yaml',yaml:'yaml'} as Record<string,string>)[ext||'']||'plaintext';}
export default function CodeEditor({path,value,onChange,theme='vs-dark'}:{path:string;value:string;onChange:(value:string)=>void;theme?:string}){
 const [Editor,setEditor]=useState<any>(null);
 useEffect(()=>{let alive=true;(async()=>{
 const [{default:Editor,loader},monaco,{default:EditorWorker},{default:JsonWorker},{default:CssWorker},{default:HtmlWorker},{default:TsWorker}]=await Promise.all([import('@monaco-editor/react'),import('monaco-editor'),import('monaco-editor/editor/editor.worker.js?worker'),import('monaco-editor/language/json/json.worker.js?worker'),import('monaco-editor/language/css/css.worker.js?worker'),import('monaco-editor/language/html/html.worker.js?worker'),import('monaco-editor/language/typescript/ts.worker.js?worker')]);
 (self as any).MonacoEnvironment={getWorker(_:string,label:string){if(label==='json')return new JsonWorker();if(['css','scss','less'].includes(label))return new CssWorker();if(['html','handlebars','razor'].includes(label))return new HtmlWorker();if(['typescript','javascript'].includes(label))return new TsWorker();return new EditorWorker();}};
 loader.config({monaco});monaco.editor.defineTheme('astra-dark',{base:'vs-dark',inherit:true,rules:[{token:'comment',foreground:'64727D',fontStyle:'italic'},{token:'string',foreground:'BDD99C'},{token:'keyword',foreground:'BDABED'},{token:'tag',foreground:'D39793'},{token:'attribute.name',foreground:'C8AE76'}],colors:{'editor.background':'#15191E','editorLineNumber.foreground':'#48515B','editorLineNumber.activeForeground':'#C4D2DD','editor.selectionBackground':'#2C4657','editor.lineHighlightBackground':'#1A2027','editorCursor.foreground':'#A4E3E8','editorIndentGuide.background1':'#242B33'}});if(alive)setEditor(()=>Editor);
 })().catch(()=>{});return()=>{alive=false;};},[]);
 if(!Editor)return <textarea aria-label={'Edit '+path} className="editor-fallback" spellCheck={false} value={value} onChange={e=>onChange(e.target.value)}/>;
 return <Editor path={path} value={value} language={language(path)} theme={theme==='light'?'vs':'astra-dark'} onChange={(v:string|undefined)=>onChange(v||'')} options={{fontSize:12.5,fontFamily:'"SFMono-Regular", Consolas, "Liberation Mono", monospace',lineHeight:22,minimap:{enabled:false},padding:{top:16,bottom:16},scrollBeyondLastLine:false,automaticLayout:true,tabSize:2,wordWrap:'on',renderLineHighlight:'line',smoothScrolling:true,bracketPairColorization:{enabled:true},ariaLabel:'Code editor for '+path}}/>;
}
export function buildPreview(files:Files){
 let html=files['index.html'];if(!html)return '<!doctype html><html><body style="font:14px system-ui;padding:40px;color:#76808a;background:#15191e"><h2>No web entry point</h2><p>Add index.html to preview a static web project. Node and Python projects run in a connected sandbox.</p></body></html>';
 html=html.replace(/<link\b[^>]*href=["'](?:\.\/)?([^"']+)["'][^>]*>/gi,(all,path)=>files[path]!==undefined&&path.endsWith('.css')?'<style>'+files[path].replace(/<\/style/gi,'<\\/style')+'</style>':all);
 html=html.replace(/<script\b([^>]*?)src=["'](?:\.\/)?([^"']+)["']([^>]*)>\s*<\/script>/gi,(all,before,path,after)=>files[path]!==undefined?'<script'+before+after+'>'+files[path].replace(/<\/script/gi,'<\\/script')+'</script>':all);
 const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none';">`;
 return '<!doctype html>'+csp+html.replace(/<!doctype[^>]*>/gi,'');
}
