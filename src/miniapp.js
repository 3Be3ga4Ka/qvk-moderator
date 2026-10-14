const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
async function hmac(key,data){const k=await crypto.subtle.importKey("raw",key,{name:"HMAC",hash:"SHA-256"},false,["sign"]);return new Uint8Array(await crypto.subtle.sign("HMAC",k,encoder.encode(data)));}
export async function authorized(e,init){
 if(typeof init!=="string"||init.length>8192||!e.BOT_TOKEN)return null;
 const p=new URLSearchParams(init),signature=p.get("hash");if(!signature||!(/^[a-f0-9]{64}$/i.test(signature)))return null;
 const auth=Number(p.get("auth_date"));if(!auth||Math.abs(Date.now()/1000-auth)>3600)return null;
 const lines=[...p.entries()].filter(([k])=>k!=="hash").sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>k+"="+v).join("\n");
 const secret=await hmac(encoder.encode("WebAppData"),e.BOT_TOKEN);
 const actual=hex(await hmac(secret,lines));
 if(actual!==signature.toLowerCase())return null;
 let user;try{user=JSON.parse(p.get("user")||"null");}catch{return null;}
 if(!user?.id||!String(e.ADMIN_IDS||"").split(",").map(s=>s.trim()).includes(String(user.id)))return null;
 return user;
}
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>QVK Moderator</title><style>
:root{color-scheme:dark;--bg:#100f1b;--panel:#211c32;--accent:#bb96ff;--text:#f6efff;--sub:#aa9ebc}*{box-sizing:border-box}body{background:linear-gradient(140deg,#171225,#0d0e19);color:var(--text);font:15px system-ui,Arial;margin:0;padding:22px 16px 80px}main{max-width:750px;margin:auto}h1{font-size:26px;margin:8px 0}h2{font-size:17px}small,p{color:var(--sub)}.panel{background:var(--panel);border:1px solid #433452;border-radius:18px;padding:18px;margin:16px 0;box-shadow:0 12px 30px #0002}select,button{border:1px solid #68577e;background:#332945;color:var(--text);padding:12px;border-radius:12px;font:inherit}select{width:100%}button{cursor:pointer}button.primary{background:#7353b0;border-color:#9c73ed}.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.metric{padding:14px;border-radius:12px;background:#322840}.metric b{display:block;font-size:23px;color:var(--accent)}.bars{display:flex;align-items:end;gap:8px;height:116px;padding:12px 2px}.bar{flex:1;background:linear-gradient(#c9aaff,#7454b9);min-height:4px;border-radius:7px 7px 2px 2px;position:relative}.bar span{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--sub)}.setting{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #493954}.setting button{min-width:85px}#status{min-height:22px}ul{padding-left:18px}li{margin:6px 0}footer{text-align:center;color:var(--sub);font-size:12px}</style></head><body><main><h1>💜 QVK Moderator</h1><p>Панель управления группой и аналитика</p><div id="status">Авторизация Telegram…</div><section class="panel"><h2>👥 Группа</h2><select id="group"></select></section><section class="panel"><h2>📊 За 7 дней</h2><div class="metrics" id="metrics"></div><div class="bars" id="bars" aria-label="Активность по дням"></div><h2>Последние действия</h2><ul id="events"></ul></section><section class="panel"><h2>🛡 Модерация и безопасность</h2><div id="settings"></div><div class="setting"><span>⚙️ Порог антирейда (входов/мин)</span><button id="raidLimit">8</button></div><div class="setting"><span>⚖️ Порог предупреждений</span><button id="punishLimit">3</button></div></section><footer>Настройки сохраняются в Cloudflare D1 • опасные санкции выключены по умолчанию</footer></main><script src="https://telegram.org/js/telegram-web-app.js"></script><script>
const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();const init=tg?.initData||"";
const el=id=>document.getElementById(id);let current="";
const names={enabled:"Модерация",ai:"Проверка ИИ",raid_watch:"Антирейд: уведомления",auto_punish:"Контроль порога наказаний",join_cleanup:"Удалять приветствия",antispam:"Антиспам"};
async function call(op,extra={}){const r=await fetch("/api/app",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({init,op,...extra})});const j=await r.json();if(!r.ok)throw Error(j.error||"Ошибка API");return j;}
async function load(){try{if(!init)throw Error("Открой панель кнопкой из Telegram, а не в обычном браузере");const g=await call("groups");el("group").replaceChildren();for(const x of g.groups){const o=document.createElement("option");o.value=x.id;o.textContent=x.title||x.id;el("group").append(o)}current=el("group").value;el("group").onchange=()=>{current=el("group").value;refresh()};await refresh()}catch(e){el("status").textContent="⚠️ "+e.message;}}
async function refresh(){if(!current)return;try{const d=await call("dashboard",{chat:current});const total=d.analytics.events.reduce((n,x)=>n+x.total,0);el("metrics").replaceChildren();for(const [name,value] of [["Событий",total],["Предупреждений",d.warnings],["Активных веток",d.topics]]){const x=document.createElement("div");x.className="metric";x.textContent=name;const b=document.createElement("b");b.textContent=value;x.prepend(b);el("metrics").append(x)}el("bars").replaceChildren();const perDay=new Map();for(const x of d.analytics.events)perDay.set(x.day,(perDay.get(x.day)||0)+x.total);const peak=Math.max(1,...perDay.values());const today=Math.floor(Date.now()/86400000);for(let day=today-6;day<=today;day++){const total=perDay.get(day)||0;const bar=document.createElement("div");bar.className="bar";bar.style.height=Math.max(4,Math.round(total/peak*100))+"%";bar.title=total+" событий";const caption=document.createElement("span");caption.textContent=new Date(day*86400000).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"});bar.append(caption);el("bars").append(bar)}el("events").replaceChildren();for(const x of d.analytics.events.slice(-12).reverse()){const li=document.createElement("li");li.textContent=x.action+" — "+x.total+" · день "+new Date(x.day*86400000).toLocaleDateString("ru-RU");el("events").append(li)}for(const [k,field,min,max] of [["raid_threshold","raidLimit",3,100],["punish_threshold","punishLimit",2,20]]){const btn=el(field);btn.textContent=d.settings[k]||String(k==="raid_threshold"?8:3);btn.onclick=async()=>{const value=prompt("Введите новый порог",btn.textContent);if(value===null)return;const num=Number(value);if(!Number.isInteger(num)||num<min||num>max){el("status").textContent="Недопустимое значение";return;}try{await call("threshold",{chat:current,key:k,value:num});await refresh()}catch(e){el("status").textContent=e.message}}}el("settings").replaceChildren();for(const [key,name] of Object.entries(names)){const row=document.createElement("div");row.className="setting";const title=document.createElement("span");title.textContent=name;const btn=document.createElement("button");btn.textContent=d.settings[key]==="on"?"✅ Вкл":"⏸ Выкл";btn.onclick=async()=>{btn.disabled=true;el("status").textContent="⏳ Сохраняю настройку…";try{const changed=await call("toggle",{chat:current,key});d.settings[key]=changed.value;btn.textContent=changed.value==="on"?"✅ Вкл":"⏸ Выкл";el("status").textContent="✅ "+name+": "+(changed.value==="on"?"включено":"выключено")}catch(e){el("status").textContent="❌ "+e.message}finally{btn.disabled=false}};row.append(title,btn);el("settings").append(row)}if(!el("status").textContent.includes("Сохраняю"))el("status").textContent="✅ Настройки синхронизированы с ботом"}catch(e){el("status").textContent="⚠️ "+e.message;}}
load();</script></body></html>`;
export function page(){return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self' https://telegram.org; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org"}});}
export async function appApi(req,e,analytics){
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 let b;try{b=await req.json();}catch{return Response.json({error:"Неверный JSON"},{status:400})}
 const user=await authorized(e,b.init);if(!user)return Response.json({error:"Проверка данных Telegram не пройдена. Обнови Mini App через меню бота; если ошибка осталась, проверь ADMIN_IDS и BOT_TOKEN в Cloudflare.",code:"INVALID_TELEGRAM_INIT_DATA"},{status:401});
 const groups=await e.DB.prepare("SELECT value FROM settings WHERE chat_id='_registry' AND key LIKE 'chat:%' ORDER BY key").all();
 const list=groups.results.map(r=>{try{return JSON.parse(r.value)}catch{return null}}).filter(Boolean);
 if(b.op==="groups")return Response.json({groups:list});
 const id=String(b.chat||"");if(!list.some(g=>g.id===id))return Response.json({error:"Неизвестная группа"},{status:403});
 if(b.op==="dashboard"){
  const a=await analytics(e,id,7);
  const w=await e.DB.prepare("SELECT COALESCE(SUM(count),0) n FROM warnings WHERE chat_id=?").bind(id).first();
  const t=await e.DB.prepare("SELECT COUNT(*) n FROM topics WHERE chat_id=?").bind(id).first();
  const s=await e.DB.prepare("SELECT key,value FROM settings WHERE chat_id=? AND key IN ('enabled','ai','raid_watch','auto_punish','join_cleanup','antispam','raid_threshold','punish_threshold')").bind(id).all();
  const defaults={enabled:"on",ai:"on",raid_watch:"on",auto_punish:"off",join_cleanup:"on",antispam:"on",raid_threshold:"8",punish_threshold:"3"};
  return Response.json({analytics:a,warnings:w?.n||0,topics:t?.n||0,settings:{...defaults,...Object.fromEntries(s.results.map(x=>[x.key,x.value]))}});
 }
 if(b.op==="threshold"){
  const bounds={raid_threshold:[3,100],punish_threshold:[2,20]};const range=bounds[b.key];const value=Number(b.value);
  if(!range||!Number.isInteger(value)||value<range[0]||value>range[1])return Response.json({error:"Недопустимый порог"},{status:400});
  await e.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(id,b.key,String(value)).run();
  return Response.json({ok:true});
 }
 if(b.op==="toggle"){
  const keys=["enabled","ai","raid_watch","auto_punish","join_cleanup","antispam"];
  if(!keys.includes(b.key))return Response.json({error:"Запрещённая настройка"},{status:400});
  const row=await e.DB.prepare("SELECT value FROM settings WHERE chat_id=? AND key=?").bind(id,b.key).first();
  const fallback=b.key==="auto_punish"?"off":"on";
  const next=(row?.value||fallback)==="on"?"off":"on";
  await e.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(id,b.key,next).run();
  return Response.json({ok:true,value:next});
 }
 return Response.json({error:"Неизвестная операция"},{status:400});
}
