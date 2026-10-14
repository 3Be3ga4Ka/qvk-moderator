import {LABELS} from "./rules.js";
const label=(s,n=55)=>String(s||"").replace(/[\r\n]/g," ").slice(0,n);
export const isGroup=m=>["supergroup","group"].includes(m?.chat?.type);
export async function discover(env,m){
 if(!isGroup(m))return;
 const id=String(m.chat.id);
 await env.DB.prepare("INSERT OR IGNORE INTO settings(chat_id,key,value) VALUES('_registry',?,?)").bind("chat:"+id,JSON.stringify({id,title:label(m.chat.title,90)})).run();
 const t=m.message_thread_id;
 if(t==null)return;
 const name=m.forum_topic_created?.name||m.forum_topic_edited?.name;
 if(name){
  await env.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(id,"topic:"+t,label(name,90)).run();
 }else{
  await env.DB.prepare("INSERT OR IGNORE INTO settings(chat_id,key,value) VALUES(?,?,?)").bind(id,"topic:"+t,"Тема #"+t).run();
 }
}
async function groups(env){
 const r=await env.DB.prepare("SELECT key,value FROM settings WHERE chat_id='_registry' AND key LIKE 'chat:%' ORDER BY key LIMIT 100").all();
 return r.results.map(v=>{try{return JSON.parse(v.value)}catch{return null}}).filter(Boolean);
}
async function topics(env,id){
 const r=await env.DB.prepare("SELECT x.thread_id,x.kind,COALESCE(s.value,'Тема #'||x.thread_id) AS title FROM topics x LEFT JOIN settings s ON s.chat_id=x.chat_id AND s.key='topic:'||x.thread_id WHERE x.chat_id=?").bind(id).all();
 const p=await env.DB.prepare("SELECT substr(key,7) AS thread_id,value AS title FROM settings WHERE chat_id=? AND key LIKE 'topic:%'").bind(id).all();
 const a=new Map(p.results.map(x=>[String(x.thread_id),{...x,kind:null}]));
 for(const x of r.results)a.set(String(x.thread_id),{...a.get(String(x.thread_id)),...x});
 return [...a.values()].sort((a,b)=>Number(a.thread_id)-Number(b.thread_id)).slice(0,80);
}
const b=(text,data)=>({text,callback_data:data});
const kb=rows=>({inline_keyboard:rows});
const settings=[["enabled","Модерация"],["ai","ИИ"],["antispam","Антиспам"],["links","Проверка ссылок"],["join_cleanup","Очистка вступлений"],["self_test","Самопроверка"]];
export async function dmHome(env,chat,send){
 const g=await groups(env);
 const rows=g.map(x=>[b("👥 "+label(x.title||x.id,45),"dm:g:"+x.id)]);
 rows.push([b("🔄 Обновить","dm:home")]);
 await send(env,chat,"💜 QVK Moderator — группы\n"+(g.length?"Выбери группу для настройки:":"Пока не нашла группы. Добавь бота в группу и отправь там /panel — группа появится здесь."),{reply_markup:kb(rows)});
}
async function dmGroup(env,chat,id,send){
 const r=await env.DB.prepare("SELECT value FROM settings WHERE chat_id='_registry' AND key=?").bind("chat:"+id).first();
 if(!r)return send(env,chat,"Группа не зарегистрирована. Отправь /panel внутри группы.");
 const name=JSON.parse(r.value).title;
 await send(env,chat,"⚙️ "+label(name)+"\nГруппа: "+id+"\nВыбирай раздел:",{reply_markup:kb([[b("🗂 Ветки и назначение правил","dm:t:"+id)],[b("⚙️ Переключатели","dm:s:"+id)],[b("📊 Статистика","dm:stats:"+id),b("📜 Журнал","dm:logs:"+id)],[b("🩺 Права бота","dm:rights:"+id)],[b("➕ Добавить ветку вручную","dm:new:"+id)],[b("⬅️ Все группы","dm:home")]])});
}
async function dmTopics(env,chat,id,send){
 const arr=await topics(env,id);
 const rows=arr.map(x=>[b(label(x.title,24)+" · "+(LABELS[x.kind]||"Без правил"),"dm:k:"+id+":"+x.thread_id)]);
 rows.push([b("➕ Ветка по ID","dm:new:"+id)],[b("⬅️ Группа","dm:g:"+id)]);
 await send(env,chat,"🗂 Ветки группы "+id+"\n"+(arr.length?"Нажми на ветку, чтобы назначить правила.":"Пока ветки не обнаружены. Напиши любое сообщение в каждой ветке или добавь её ID вручную."),{reply_markup:kb(rows)});
}
async function dmKinds(env,chat,id,t,send){
 const rows=Object.entries(LABELS).map(([k,l])=>[b(l,"dm:a:"+id+":"+t+":"+k)]);
 rows.push([b("🚫 Без тематических правил","dm:a:"+id+":"+t+":none")],[b("✏️ Изменить название","dm:rename:"+id+":"+t)],[b("⬅️ Ветки","dm:t:"+id)]);
 await send(env,chat,"🧭 Настроить ветку #"+t+"\nВыбери назначение:",{reply_markup:kb(rows)});
}
async function dmSettings(env,chat,id,send){
 const r=await env.DB.prepare("SELECT key,value FROM settings WHERE chat_id=?").bind(id).all();
 const vals=Object.fromEntries(r.results.map(x=>[x.key,x.value]));
 const rows=settings.map(([k,name])=>[b((vals[k]??(k==="self_test"?"on":"on"))==="on"?"✅ "+name:"⏸ "+name,"dm:toggle:"+id+":"+k)]);
 rows.push([b("🧭 Оффтоп: "+(vals.topic_action||"delete"),"dm:toggle:"+id+":topic_action")],[b("🛡 Реакция на спам: "+(vals.spam_action||"warn"),"dm:toggle:"+id+":spam_action")],[b("⬅️ Группа","dm:g:"+id)]);
 await send(env,chat,"⚙️ Настройки группы "+id+"\nКнопки переключают параметры:",{reply_markup:kb(rows)});
}
async function dmStats(env,chat,id,send){
 const count=await env.DB.prepare("SELECT COALESCE(SUM(count),0) n FROM warnings WHERE chat_id=?").bind(id).first();
 const total=await env.DB.prepare("SELECT COUNT(*) n FROM events WHERE chat_id=? AND ts>=?").bind(id,Math.floor(Date.now()/1000)-86400).first();
 const rows=await env.DB.prepare("SELECT action,COUNT(*) n FROM events WHERE chat_id=? GROUP BY action ORDER BY n DESC LIMIT 12").bind(id).all();
 const info=rows.results.map(x=>label(x.action,35)+": "+x.n).join("\\n");
 await send(env,chat,["📊 Статистика группы",id,"Предупреждений всего: "+(count?.n||0),"Событий за 24 часа: "+(total?.n||0),info||"Событий пока нет"].join("\\n").replaceAll("\\n","\n"),{reply_markup:kb([[b("📜 Журнал","dm:logs:"+id)],[b("⬅️ Группа","dm:g:"+id)]])});
}
async function dmLogs(env,chat,id,send){
 const rows=await env.DB.prepare("SELECT action,thread_id,user_id,reason,ts FROM events WHERE chat_id=? ORDER BY id DESC LIMIT 15").bind(id).all();
 const events=rows.results.map(x=>{
  const when=new Date(x.ts*1000).toISOString().slice(0,16).replace("T"," ");
  return when+" UTC · "+label(x.action,30)+"\n↳ ветка "+label(x.thread_id,15)+", пользователь "+label(x.user_id,20)+"\n"+label(x.reason,110);
 });
 await send(env,chat,"📜 Последние 15 действий\n"+(events.length?events.join("\n\n"):"Пока нет записей."),{reply_markup:kb([[b("🔄 Обновить","dm:logs:"+id)],[b("⬅️ Группа","dm:g:"+id)]])});
}
async function dmRights(env,chat,id,send){
 try{
  const bot=await fetch("https://api.telegram.org/bot"+env.BOT_TOKEN+"/getMe").then(r=>r.json());
  if(!bot.ok)throw Error(bot.description||"getMe failed");
  const raw=await fetch("https://api.telegram.org/bot"+env.BOT_TOKEN+"/getChatMember",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:id,user_id:bot.result.id})}).then(r=>r.json());
  if(!raw.ok)throw Error(raw.description||"getChatMember failed");
  const p=raw.result;
  await send(env,chat,["🩺 Права бота", "Статус: "+p.status, "Удалять сообщения: "+(p.can_delete_messages?"✅":"❌"),"Ограничивать участников: "+(p.can_restrict_members?"✅":"❌"),"Управлять темами: "+(p.can_manage_topics?"✅":"❌"),"Чтобы бот удалял оффтоп, ему нужно право удалять сообщения."].join("\n"),{reply_markup:kb([[b("🔄 Проверить снова","dm:rights:"+id)],[b("⬅️ Группа","dm:g:"+id)]])});
 }catch(err){await send(env,chat,"Не удалось проверить права: "+label(err.message));}
}
export async function dmCallback(env,q,send,ack){
 if(q.message?.chat?.type!=="private"||!q.data?.startsWith("dm:"))return false;
 const [_,action,id,t,k]=q.data.split(":");
 try{
  if(action==="home")await dmHome(env,q.message.chat.id,send);
  else if(action==="g")await dmGroup(env,q.message.chat.id,id,send);
  else if(action==="t")await dmTopics(env,q.message.chat.id,id,send);
  else if(action==="k")await dmKinds(env,q.message.chat.id,id,t,send);
  else if(action==="s")await dmSettings(env,q.message.chat.id,id,send);
  else if(action==="stats")await dmStats(env,q.message.chat.id,id,send);
  else if(action==="logs")await dmLogs(env,q.message.chat.id,id,send);
  else if(action==="rights")await dmRights(env,q.message.chat.id,id,send);
  else if(action==="a"){
   if(!Object.hasOwn(LABELS,k)&&k!=="none")throw Error("Неизвестный тип");
   if(k==="none")await env.DB.prepare("DELETE FROM topics WHERE chat_id=? AND thread_id=?").bind(id,t).run();
   else await env.DB.prepare("INSERT INTO topics(chat_id,thread_id,kind) VALUES(?,?,?) ON CONFLICT(chat_id,thread_id) DO UPDATE SET kind=excluded.kind").bind(id,t,k).run();
   await send(env,q.message.chat.id,"✅ Ветка #"+t+": "+(LABELS[k]||"Без правил"));
   await dmTopics(env,q.message.chat.id,id,send);
  }else if(action==="toggle"){
   if(![...settings.map(x=>x[0]),"topic_action","spam_action"].includes(t))throw Error("Неизвестная настройка");
   const previous=await env.DB.prepare("SELECT value FROM settings WHERE chat_id=? AND key=?").bind(id,t).first();
   const old=previous?.value??(t==="spam_action"?"warn":t==="topic_action"?"delete":"on");
   const next=t==="spam_action"?(old==="warn"?"delete":"warn"):t==="topic_action"?(old==="delete"?"warn":"delete"):(old==="on"?"off":"on");
   await env.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(id,t,next).run();
   await dmSettings(env,q.message.chat.id,id,send);
  }else if(action==="new"||action==="rename"){
   await env.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(String(q.from.id),"dm_pending",JSON.stringify({action,id,thread:t})).run();
   await send(env,q.message.chat.id,action==="new"?"Отправь ID темы и название через пробел, например: 9 Баги":"Отправь новое название ветки #"+t);
  }
 }catch(err){console.error("DM panel",String(err));await send(env,q.message.chat.id,"⚠️ "+label(err.message));}
 finally{await ack(env,q.id);}
 return true;
}
export async function dmText(env,m,send){
 if(m.chat.type!=="private")return false;
 const id=String(m.from.id);
 const state=await env.DB.prepare("SELECT value FROM settings WHERE chat_id=? AND key='dm_pending'").bind(id).first();
 if(!state)return false;
 const v=JSON.parse(state.value),text=String(m.text||"").trim();
 if(text.startsWith("/cancel")){await env.DB.prepare("DELETE FROM settings WHERE chat_id=? AND key='dm_pending'").bind(id).run();await send(env,m.chat.id,"Отменено");return true;}
 let thread=v.thread, title=text;
 if(v.action==="new"){
  const match=text.match(/^(\d+)\s+(.{1,90})$/s);
  if(!match){await send(env,m.chat.id,"Укажи номер и название, например: 9 Баги. Для отмены /cancel");return true;}
  thread=match[1];title=match[2];
 }
 if(!title||title.length>90){await send(env,m.chat.id,"Название должно быть длиной 1–90 символов");return true;}
 await env.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(v.id,"topic:"+thread,label(title,90)).run();
 await env.DB.prepare("DELETE FROM settings WHERE chat_id=? AND key='dm_pending'").bind(id).run();
 await send(env,m.chat.id,"✅ Ветка #"+thread+": "+label(title));
 await dmTopics(env,m.chat.id,v.id,send);
 return true;
}
