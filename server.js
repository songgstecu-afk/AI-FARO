// AURA AI backend — Node.js 18+
// 1) npm install
// 2) salin .env.example menjadi .env dan isi OPENROUTER_API_KEY
// 3) node server.js
const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||3000;
try{require("dotenv").config()}catch{}
const KEY=process.env.OPENROUTER_API_KEY;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"};
function send(res,status,body,type="application/json"){res.writeHead(status,{"Content-Type":type,"Access-Control-Allow-Origin":"*"});res.end(body)}
async function openrouter(url,options){return fetch("https://openrouter.ai/api/v1"+url,{...options,headers:{"Authorization":`Bearer ${KEY}`,"Content-Type":"application/json","HTTP-Referer":"http://localhost:"+PORT,"X-Title":"AURA AI",...(options.headers||{})}})}
const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/api/models"){
    if(!KEY)return send(res,500,JSON.stringify({error:"OPENROUTER_API_KEY belum diatur"}));
    try{const r=await openrouter("/models",{method:"GET"});const t=await r.text();send(res,r.status,t)}catch(e){send(res,500,JSON.stringify({error:e.message}))}return;
  }
  if(req.method==="POST"&&req.url==="/api/chat"){
    if(!KEY)return send(res,500,JSON.stringify({error:"OPENROUTER_API_KEY belum diatur"}));
    let raw="";req.on("data",c=>raw+=c);req.on("end",async()=>{
      try{
        const body=JSON.parse(raw);let messages=Array.isArray(body.messages)?body.messages:[];
        if(body.system_prompt)messages=[{role:"system",content:body.system_prompt},...messages];
        const r=await openrouter("/chat/completions",{method:"POST",body:JSON.stringify({model:body.model,messages,temperature:body.temperature??.7,max_tokens:body.max_tokens??2048,stream:true})});
        if(!r.ok){const t=await r.text();return send(res,r.status,t)}
        res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-cache","Connection":"keep-alive"});
        const reader=r.body.getReader(),dec=new TextDecoder();let buf="";
        while(true){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()||"";for(const line of lines){if(!line.startsWith("data: "))continue;const data=line.slice(6).trim();if(data==="[DONE]")continue;try{const j=JSON.parse(data),delta=j.choices?.[0]?.delta?.content;if(delta)res.write(delta)}catch{}}}
        res.end();
      }catch(e){if(!res.headersSent)send(res,500,JSON.stringify({error:e.message}));else res.end()}
    });return;
  }
  let p=decodeURIComponent(req.url.split("?")[0]);if(p==="/")p="/index.html";const file=path.join(__dirname,p);
  if(!file.startsWith(__dirname)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return send(res,404,"Not found","text/plain");
  send(res,200,fs.readFileSync(file),MIME[path.extname(file)]||"application/octet-stream");
});
server.listen(PORT,()=>console.log(`AURA AI running at http://localhost:${PORT}`));
