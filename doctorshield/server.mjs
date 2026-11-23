// Local static server. Applies the same security headers as production (vercel.json), so local
// testing runs under the production Content-Security-Policy. HSTS is skipped on plain http.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.pdf':'application/pdf'};
let security={};
try{const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));security=Object.fromEntries((config.headers?.find(h=>h.source==='/(.*)')?.headers||[]).filter(h=>h.key!=='Strict-Transport-Security').map(h=>[h.key,h.value]));}catch{}
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,body)=>{
  if(err){res.writeHead(404,security).end('Not found');return;}
  // Temporary QA pages (dist/_qa*.html, never committed) need inline test scripts, so they are served without the CSP.
  const headers=path.basename(file).startsWith('_qa')?{}:security;
  res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
 });
}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+(process.env.PORT||4173)));
