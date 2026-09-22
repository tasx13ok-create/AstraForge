export type Files = Record<string,string>;
export const templates: Record<string,{name:string;description:string;files:Files}> = {
  web:{name:'Web starter',description:'HTML, CSS and JavaScript. Instant live preview.',files:{
    'index.html':`<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Orbit — make room for focus</title><link rel="stylesheet" href="styles.css"></head>
<body>
  <nav><a class="brand" href="#">◈ orbit</a><span>A little space for your best work.</span><button id="theme" aria-label="Change theme">◐</button></nav>
  <main>
    <div class="eyebrow"><i></i> YOUR TIME, WELL SPENT</div>
    <h1>Make room<br>for <em>focus.</em></h1>
    <p>One task. A clear mind. A little momentum.<br>Your next great idea starts here.</p>
    <section class="timer"><div class="timer-top"><span>FOCUS SESSION</span><span id="session">01 / 04</span></div><div id="clock">25:00</div><div class="controls"><button id="start">Start focusing <span>↗</span></button><button id="reset" aria-label="Reset timer">↺</button></div></section>
    <div class="footnote">✦ Built for the moments that matter.</div>
  </main>
  <footer><span>Less noise. More possibility.</span><span>MADE WITH ASTRAFORGE ↗</span></footer>
  <script src="app.js"></script>
</body>
</html>`,
    'styles.css':`* { box-sizing: border-box; }
body { margin: 0; color: #24332c; background: #f4f4ee; font-family: Arial, sans-serif; min-height: 100vh; }
nav { padding: 25px 7%; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #dfe2d9; }
.brand { font-size: 26px; font-weight: 700; color: inherit; text-decoration: none; letter-spacing: -1px; }
nav span, footer { font-size: 11px; color: #6e786d; }
button { cursor: pointer; font: inherit; }
#theme { border: 1px solid #d1d7ca; background: transparent; color: inherit; border-radius: 50%; width: 30px; height: 30px; }
main { max-width: 700px; margin: auto; padding: 60px 24px 45px; text-align: center; }
.eyebrow { font-size: 10px; letter-spacing: 2px; color: #6b7c65; }
i { display: inline-block; height: 6px; width: 6px; border-radius: 50%; background: #6a875a; margin-right: 7px; }
h1 { font-size: clamp(48px, 7vw, 70px); line-height: 1.03; letter-spacing: -3px; margin: 25px 0 20px; font-weight: 500; }
em { font-family: Georgia, serif; font-weight: 400; color: #708562; }
p { font-size: 13px; line-height: 1.9; color: #74806e; }
.timer { text-align: left; background: #fffef9; border: 1px solid #dfe3d7; border-radius: 16px; max-width: 310px; margin: 32px auto 20px; padding: 23px; box-shadow: 0 8px 22px #24332c06; }
.timer-top { display: flex; justify-content: space-between; font-size: 9px; letter-spacing: 1.2px; color: #87917e; }
#clock { font-size: 65px; font-weight: 400; letter-spacing: -3px; text-align: center; padding: 18px 0; font-variant-numeric: tabular-nums; }
.controls { display: flex; gap: 8px; }
#start { color: #fff; background: #364d3c; border: 0; border-radius: 7px; padding: 12px 16px; flex: 1; font-size: 11px; display: flex; justify-content: space-between; }
#reset { border: 1px solid #dfe3d7; background: transparent; border-radius: 7px; width: 38px; color: #6e786d; }
.footnote { font-size: 10px; color: #87917e; }
footer { display: flex; justify-content: space-between; margin: 0 7%; padding: 24px 0; border-top: 1px solid #dfe2d9; }
footer span:last-child { font-size: 8px; letter-spacing: 1px; }
body.dark { background: #24332c; color: #f4f4ee; } body.dark .timer { background: #304237; border-color: #465447; } body.dark #start { background: #708562; }
@media(max-width:500px) { nav span { display: none; } main { padding-top: 38px; } footer { font-size: 9px; } }`,
    'app.js':`// A small, real focus timer. Make it your own.
let remaining = 25 * 60;
let running = false;
let interval;
const clock = document.querySelector('#clock');
const start = document.querySelector('#start');
function render() {
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  clock.textContent = minutes + ':' + seconds;
  start.innerHTML = running ? 'Pause session <span>Ⅱ</span>' : 'Start focusing <span>↗</span>';
}
start.addEventListener('click', () => {
  running = !running;
  clearInterval(interval);
  if (running) interval = setInterval(() => { if (remaining > 0) remaining--; else { running = false; clearInterval(interval); } render(); }, 1000);
  render();
});
document.querySelector('#reset').addEventListener('click', () => { clearInterval(interval); running = false; remaining = 25 * 60; render(); });
document.querySelector('#theme').addEventListener('click', () => document.body.classList.toggle('dark'));`,
    'README.md':'# Orbit\n\nA tiny focus timer, built with plain HTML, CSS and JavaScript.\n\nEdit any file and open Preview to see your changes. No build step required.\n\n## Try this\n- Change the accent color in styles.css\n- Add a short-break mode\n- Save a snapshot before a big change\n'
  }},
  node:{name:'Node.js',description:'A minimal Node HTTP server with a test.',files:{'package.json':'{"name":"my-app","private":true,"type":"module","scripts":{"start":"node index.js","test":"node --test"}}','index.js':"import {createServer} from 'node:http';\ncreateServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/plain'});res.end('Hello from AstraForge!');}).listen(3000);\n",'sum.js':'export const sum = (a,b) => a+b;\n','sum.test.js':"import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {sum} from './sum.js';\ntest('adds numbers',()=>assert.equal(sum(2,3),5));\n",'README.md':'# Node starter\nConnect a sandbox in Settings, then run `npm test`.\nLong-running preview servers require a persistent runtime; the current runner executes bounded commands.\n'}},
  python:{name:'Python',description:'A small Python module and unit test.',files:{'main.py':'def greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nif __name__ == "__main__":\n    print(greet("AstraForge"))\n','test_main.py':'import unittest\nfrom main import greet\n\nclass GreetingTest(unittest.TestCase):\n    def test_greet(self):\n        self.assertEqual(greet("world"), "Hello, world!")\n\nif __name__ == "__main__":\n    unittest.main()\n','README.md':'# Python starter\nConnect a sandbox and run `python -m unittest`.\n'}},
  blank:{name:'Blank project',description:'A clean slate for your next idea.',files:{'index.html':'<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><title>My project</title></head><body><h1>Hello, possibility.</h1></body></html>\n','README.md':'# My project\n\nBuilt with AstraForge.\n'}}
};
export function validateFiles(input: unknown): Files {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A file map is required.');
 const files=input as Files; const paths=Object.keys(files);
 if(paths.length>150||JSON.stringify(files).length>1_500_000) throw new Error('Project limit: 150 text files / 1.5 MB.');
 for(const path of paths) if(!path||path.length>240||path.startsWith('/')||path.includes('\\')||path.split('/').some(s=>!s||s==='.'||s==='..')||/[\u0000-\u001f]/.test(path)||typeof files[path]!=='string') throw new Error('Invalid workspace path.');
 return files;
}
