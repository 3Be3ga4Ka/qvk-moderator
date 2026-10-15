const stamp=()=>Math.floor(Date.now()/1000);
const day=()=>Math.floor(stamp()/86400);
const uid=x=>String(x??"");
const valid=x=>/^[1-9]\d{2,19}$/.test(uid(x));
export function modeAllowed(mode,owner,actor){
 return mode==="users"||(mode==="testers"&&uid(owner)!==""&&uid(actor)===uid(owner));
}
export async function repMode(e,chat){
 const row=await e.DB.prepare("SELECT value FROM settings WHERE chat_id=? AND key='reputation_mode'").bind(String(chat)).first();
 return ["users","testers"].includes(row?.value)?row.value:null;
}
export async function setupRep(e,chat,mode,actor){
 if(!valid(e.REPUTATION_OWNER_ID)||uid(actor)!==uid(e.REPUTATION_OWNER_ID))throw Error("Только владелец с REPUTATION_OWNER_ID может назначать тип группы");
 if(!["users","testers"].includes(mode))throw Error("Тип: users или testers");
 const other=await e.DB.prepare("SELECT chat_id FROM settings WHERE key='reputation_mode' AND value=? AND chat_id<>? LIMIT 1").bind(mode,String(chat)).first();
 if(other)throw Error("Этот тип уже назначен другому чату: "+other.chat_id);
 await e.DB.prepare("INSERT INTO settings(chat_id,key,value) VALUES(?,'reputation_mode',?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value").bind(String(chat),mode).run();
 return mode;
}
export async function addRep(e,params){
 const {chat,actor,target,sourceMessage,amount=1}=params;
 const c=uid(chat),a=uid(actor),t=uid(target);
 if(!valid(a)||!valid(t)||a===t)throw Error("Нельзя начислять репутацию самому себе");
 const mode=await repMode(e,c);
 if(!mode)throw Error("Владелец должен назначить тип группы через /rep_setup");
 if(!modeAllowed(mode,e.REPUTATION_OWNER_ID,a))throw Error("Только владелец может повышать репутацию тестировщиков");
 if(mode==="users"&&amount!==1)throw Error("Участникам доступно только +1");
 if(mode==="testers"&&(!Number.isInteger(amount)||amount<1||amount>5))throw Error("Баллы: от 1 до 5");
 const key=mode==="users"?("daily:"+day()+":"+a+":"+t):("owner:"+a+":"+uid(sourceMessage));
 // Only insert and increment in a single atomic SQLite statement through D1 batch,
 // using a conditional SQL insertion based on changes() from the preceding statement.
 const statements=[
  e.DB.prepare("INSERT OR IGNORE INTO reputation_votes(chat_id,vote_key,giver_id,receiver_id,amount,ts) VALUES(?,?,?,?,?,?)").bind(c,key,a,t,amount,stamp()),
  e.DB.prepare("INSERT INTO reputation_scores(chat_id,user_id,score,updated) SELECT ?,?,?,? WHERE changes()=1 ON CONFLICT(chat_id,user_id) DO UPDATE SET score=score+excluded.score,updated=excluded.updated").bind(c,t,amount,stamp())
 ];
 const out=await e.DB.batch(statements);
 return {mode,added:!!out[0]?.meta?.changes};
}
export async function getRep(e,chat,user){
 const row=await e.DB.prepare("SELECT score FROM reputation_scores WHERE chat_id=? AND user_id=?").bind(uid(chat),uid(user)).first();
 return Number(row?.score||0);
}
export async function topRep(e,chat){
 const rows=await e.DB.prepare("SELECT user_id,score FROM reputation_scores WHERE chat_id=? ORDER BY score DESC,user_id LIMIT 10").bind(uid(chat)).all();
 return rows.results;
}
