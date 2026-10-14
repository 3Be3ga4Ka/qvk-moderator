// QVK support assistant: replies only on explicit /qvk requests.
// Reads the owner's structured support articles from QVK_KB binding if configured.
// No moderation or ticket privileges are inferred from the FAQ.
const normalize=t=>String(t||"").toLowerCase().replace(/ё/g,"е").replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim();
const fallback={answer:"Уточни, пожалуйста, что именно не работает и в каком разделе QVK. Не нужно сбрасывать данные или выходить из аккаунта.",clarifying_question:"Что ожидалось и что произошло вместо этого?",steps:[]};
export function selectArticle(articles,query,isAdmin=false){
 const q=normalize(query);
 if(!q||q.length<5)return null;
 const tokens=q.split(" ").filter(t=>t.length>3);
 const ranked=articles.filter(x=>x.status!=="admin_only"||isAdmin).map(x=>{
  const triggers=(x.triggers||[]).map(normalize);
  const exact=triggers.filter(t=>t.length>3&&q.includes(t)).reduce((n,t)=>n+Math.min(12,t.length),0);
  const hits=triggers.reduce((n,t)=>n+t.split(" ").filter(w=>w.length>4&&tokens.includes(w)).length,0);
  const score=exact*2+hits-(x.id==="unknown"?1000:0);
  return {x,score};
 }).sort((a,b)=>b.score-a.score);
 if((ranked[0]?.score||0)<7)return null;
 return ranked[0].x;
}
export function compose(article,previous="",maxSteps=3){
 const a=article||fallback;
 const prev=normalize(previous);
 const choices=(a.steps||[]).filter(step=>{
  const words=normalize(step).split(" ").filter(w=>w.length>5);
  return !words.some(w=>prev.includes(w))&&!/(?:не помогло|пробовал|уже включено|уже сделал)/i.test(previous)&&words.length>0;
 }).slice(0,maxSteps);
 const head=String(a.answer||fallback.answer).slice(0,430);
 const parts=[head,...choices.map((s,i)=>(i+1)+". "+s)];
 if(!choices.length&&previous)parts.push("Если безопасные шаги уже проверены, лучше составить краткий отчёт: версия QVK, Android, симптом, текст ошибки и что пробовал.");
 if(a.clarifying_question)parts.push(a.clarifying_question);
 return parts.join("\n\n").slice(0,950);
}
export async function supportMessage(e,m,query,isAdmin,send){
 const row=await e.DB.prepare("SELECT value FROM settings WHERE chat_id=? AND key=?").bind("_registry","support_kb").first();
 const raw=row?.value;
 if(!raw){await send(e,m.chat.id,"База знаний пока не загружена владельцем.",{message_thread_id:m.message_thread_id});return true;}
 let kb;try{kb=JSON.parse(raw)}catch{return false;}
 const c=String(m.chat.id),u=String(m.from?.id||""),key="support:"+u;
 const previous=await e.DB.prepare("SELECT value FROM settings WHERE chat_id=? AND key=?").bind(c,key).first();
 let state;try{state=JSON.parse(previous?.value||"{}")}catch{state={}}
 const chosen=selectArticle(kb.articles||[],query,isAdmin);
 if(!chosen){await send(e,c,compose(null,""),{message_thread_id:m.message_thread_id});return true;}
 const repeated=state.id===chosen.id&&Date.now()-Number(state.time||0)<300000;
 if(repeated&&state.query===normalize(query))return true;
 const prevText=repeated?state.steps||"":"";
 const answer=compose(chosen,prevText);
 await send(e,c,answer,{message_thread_id:m.message_thread_id});
 await e.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(c,key,JSON.stringify({id:chosen.id,query:normalize(query),steps:(prevText+" "+(chosen.steps||[]).join(" ")).slice(-1000),time:Date.now()})).run();
 return true;
}
